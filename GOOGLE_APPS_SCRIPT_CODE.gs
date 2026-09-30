/**
 * MVP STUDIO IA CONTROL
 * Un solo Apps Script para:
 *   - USUARIOS
 *   - API_KEYS
 *
 * INSTALACION:
 * 1) Crea un Google Sheet nuevo: MVP_STUDIO_IA_CONTROL
 * 2) Extensiones -> Apps Script.
 * 3) Borra el contenido de Code.gs y pega TODO este archivo.
 * 4) Guarda y ejecuta UNA VEZ: configurarSistema()
 * 5) Acepta permisos.
 * 6) Copia del registro de ejecución:
 *      CONTROL_BACKEND_SECRET=...
 *    Ese valor se coloca en Render.
 * 7) Implementar -> Nueva implementación -> Aplicación web.
 *    Ejecutar como: Yo
 *    Quién tiene acceso: Cualquier usuario
 * 8) Copia la URL /exec y colócala en Render como CONTROL_SCRIPT_URL.
 *
 * SEGURIDAD:
 * - Las contraseñas NO se guardan en texto plano.
 * - Se guarda HMAC-SHA256 con salt individual + pepper privado.
 * - Todas las llamadas del backend requieren CONTROL_BACKEND_SECRET.
 */

const CFG = Object.freeze({
  USERS_SHEET: 'USUARIOS',
  API_SHEET: 'API_KEYS',
  USERS_HEADERS: [
    'ID', 'USUARIO', 'PASSWORD_HASH', 'SALT', 'ESTADO',
    'PLAN', 'FECHA_INICIO', 'FECHA_VENCE', 'ULTIMO_ACCESO'
  ],
  API_HEADERS: [
    'ID', 'API_KEY', 'ACTIVA', 'USOS', 'ULTIMO_USO', 'OBSERVACION'
  ]
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MVP Studio IA')
    .addItem('Configurar sistema', 'configurarSistema')
    .addSeparator()
    .addItem('Crear usuario', 'menuCrearUsuario')
    .addItem('Cambiar contraseña', 'menuCambiarPassword')
    .addItem('Bloquear / Activar usuario', 'menuCambiarEstado')
    .addToUi();
}

function configurarSistema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();

  props.setProperty('SPREADSHEET_ID', ss.getId());

  let backendSecret = props.getProperty('BACKEND_SECRET');
  if (!backendSecret) {
    backendSecret = randomHex_(32);
    props.setProperty('BACKEND_SECRET', backendSecret);
  }

  if (!props.getProperty('PASSWORD_PEPPER')) {
    props.setProperty('PASSWORD_PEPPER', randomHex_(32));
  }

  ensureSheet_(ss, CFG.USERS_SHEET, CFG.USERS_HEADERS);
  ensureSheet_(ss, CFG.API_SHEET, CFG.API_HEADERS);

  Logger.log('CONTROL_BACKEND_SECRET=' + backendSecret);
  try {
    SpreadsheetApp.getUi().alert(
      'Configuración completada',
      'Se crearon/verificaron las hojas USUARIOS y API_KEYS.\n\n' +
      'Abre el registro de ejecución y copia CONTROL_BACKEND_SECRET para Render.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (_) {}

  return backendSecret;
}

function doGet(e) {
  return json_({
    success: true,
    app: 'MVP Studio IA Control',
    status: 'online'
  });
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    verifyBackendSecret_(body);

    const action = String(body.accion || body.action || '').trim().toLowerCase();

    switch (action) {
      case 'login':
        return json_(login_(body));
      case 'validar_usuario':
        return json_(validarUsuario_(body));
      case 'get_api_key':
        return json_(getApiKey_());
      default:
        return json_({ success: false, message: 'Acción no reconocida.' });
    }
  } catch (err) {
    return json_({
      success: false,
      message: err && err.message ? err.message : String(err)
    });
  }
}

/* ======================== USUARIOS ======================== */

function menuCrearUsuario() {
  const ui = SpreadsheetApp.getUi();

  const u = ui.prompt('Crear usuario', 'Usuario:', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;

  const p = ui.prompt('Crear usuario', 'Contraseña:', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;

  const plan = ui.prompt(
    'Crear usuario',
    'Plan (ej.: MENSUAL, ANUAL, PRO):',
    ui.ButtonSet.OK_CANCEL
  );
  if (plan.getSelectedButton() !== ui.Button.OK) return;

  const vence = ui.prompt(
    'Crear usuario',
    'Fecha de vencimiento YYYY-MM-DD. Déjalo vacío para sin vencimiento:',
    ui.ButtonSet.OK_CANCEL
  );
  if (vence.getSelectedButton() !== ui.Button.OK) return;

  const result = crearUsuario_(
    u.getResponseText(),
    p.getResponseText(),
    'ACTIVO',
    plan.getResponseText() || 'PRO',
    vence.getResponseText()
  );

  ui.alert(result.message);
}

function menuCambiarPassword() {
  const ui = SpreadsheetApp.getUi();
  const u = ui.prompt('Cambiar contraseña', 'Usuario:', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  const p = ui.prompt('Cambiar contraseña', 'Nueva contraseña:', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;

  const result = cambiarPassword_(u.getResponseText(), p.getResponseText());
  ui.alert(result.message);
}

function menuCambiarEstado() {
  const ui = SpreadsheetApp.getUi();
  const u = ui.prompt('Cambiar estado', 'Usuario:', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  const s = ui.prompt(
    'Cambiar estado',
    'Escribe ACTIVO o BLOQUEADO:',
    ui.ButtonSet.OK_CANCEL
  );
  if (s.getSelectedButton() !== ui.Button.OK) return;

  const result = cambiarEstado_(u.getResponseText(), s.getResponseText());
  ui.alert(result.message);
}

function crearUsuario_(usuario, password, estado, plan, fechaVence) {
  usuario = normalizeUser_(usuario);
  password = String(password || '');

  if (!usuario) return { success: false, message: 'El usuario está vacío.' };
  if (password.length < 6) {
    return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  const sheet = sheet_(CFG.USERS_SHEET);
  const found = findUser_(sheet, usuario);
  if (found) return { success: false, message: 'Ese usuario ya existe.' };

  const salt = randomHex_(16);
  const hash = passwordHash_(password, salt);
  const id = 'U' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
  const now = new Date();
  const vence = parseDateInput_(fechaVence);

  sheet.appendRow([
    id,
    usuario,
    hash,
    salt,
    normalizeEstado_(estado || 'ACTIVO'),
    String(plan || 'PRO').trim().toUpperCase(),
    now,
    vence || '',
    ''
  ]);

  return { success: true, message: 'Usuario creado: ' + usuario };
}

function cambiarPassword_(usuario, newPassword) {
  usuario = normalizeUser_(usuario);
  newPassword = String(newPassword || '');
  if (newPassword.length < 6) {
    return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  const sheet = sheet_(CFG.USERS_SHEET);
  const found = findUser_(sheet, usuario);
  if (!found) return { success: false, message: 'Usuario no encontrado.' };

  const salt = randomHex_(16);
  const hash = passwordHash_(newPassword, salt);
  sheet.getRange(found.row, 3).setValue(hash);
  sheet.getRange(found.row, 4).setValue(salt);
  return { success: true, message: 'Contraseña actualizada.' };
}

function cambiarEstado_(usuario, estado) {
  usuario = normalizeUser_(usuario);
  estado = normalizeEstado_(estado);

  if (!['ACTIVO', 'BLOQUEADO'].includes(estado)) {
    return { success: false, message: 'Usa ACTIVO o BLOQUEADO.' };
  }

  const sheet = sheet_(CFG.USERS_SHEET);
  const found = findUser_(sheet, usuario);
  if (!found) return { success: false, message: 'Usuario no encontrado.' };

  sheet.getRange(found.row, 5).setValue(estado);
  return { success: true, message: usuario + ' ahora está ' + estado + '.' };
}

function login_(body) {
  const usuario = normalizeUser_(body.usuario);
  const password = String(body.password || '');

  if (!usuario || !password) {
    return { success: false, message: 'Ingresa usuario y contraseña.' };
  }

  const sheet = sheet_(CFG.USERS_SHEET);
  const found = findUser_(sheet, usuario);
  if (!found) {
    Utilities.sleep(250);
    return { success: false, message: 'Usuario o contraseña incorrectos.' };
  }

  const row = found.values;
  const estado = normalizeEstado_(row[4]);
  const plan = String(row[5] || '').trim();
  const fechaVence = row[7];

  const access = checkAccount_(estado, fechaVence);
  if (!access.ok) return { success: false, message: access.message };

  const storedHash = String(row[2] || '');
  const salt = String(row[3] || '');
  const incomingHash = passwordHash_(password, salt);

  if (!constantTimeEqual_(storedHash, incomingHash)) {
    Utilities.sleep(250);
    return { success: false, message: 'Usuario o contraseña incorrectos.' };
  }

  sheet.getRange(found.row, 9).setValue(new Date());

  return {
    success: true,
    user: {
      id: String(row[0] || ''),
      usuario: usuario,
      plan: plan || 'PRO',
      estado: estado,
      fecha_vence: dateToIso_(fechaVence)
    }
  };
}

function validarUsuario_(body) {
  const usuario = normalizeUser_(body.usuario);
  if (!usuario) return { success: false, message: 'Usuario inválido.' };

  const sheet = sheet_(CFG.USERS_SHEET);
  const found = findUser_(sheet, usuario);
  if (!found) return { success: false, message: 'Usuario no encontrado.' };

  const row = found.values;
  const access = checkAccount_(normalizeEstado_(row[4]), row[7]);
  if (!access.ok) return { success: false, message: access.message };

  sheet.getRange(found.row, 9).setValue(new Date());

  return {
    success: true,
    user: {
      id: String(row[0] || ''),
      usuario: usuario,
      plan: String(row[5] || 'PRO'),
      estado: normalizeEstado_(row[4]),
      fecha_vence: dateToIso_(row[7])
    }
  };
}

function checkAccount_(estado, fechaVence) {
  if (estado !== 'ACTIVO') {
    return { ok: false, message: 'Tu usuario está bloqueado. Contacta al administrador.' };
  }

  const parsed = coerceDate_(fechaVence);
  if (parsed) {
    const fin = new Date(parsed);
    fin.setHours(23, 59, 59, 999);
    if (new Date().getTime() > fin.getTime()) {
      return { ok: false, message: 'Tu acceso ha vencido. Contacta al administrador.' };
    }
  }

  return { ok: true };
}

/* ======================== API KEYS ======================== */

function getApiKey_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = sheet_(CFG.API_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No hay APIs registradas.' };
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, CFG.API_HEADERS.length).getValues();

    let bestIndex = -1;
    let bestUses = Number.MAX_SAFE_INTEGER;

    rows.forEach((r, i) => {
      const key = String(r[1] || '').trim();
      const active = String(r[2] || '').trim().toUpperCase();
      const uses = Number(r[3] || 0);

      if (key && ['SI', 'SÍ', 'TRUE', '1', 'ACTIVA', 'ACTIVO'].includes(active)) {
        if (uses < bestUses) {
          bestUses = uses;
          bestIndex = i;
        }
      }
    });

    if (bestIndex < 0) {
      return { success: false, message: 'No hay APIs activas disponibles.' };
    }

    const sheetRow = bestIndex + 2;
    const apiKey = String(rows[bestIndex][1] || '').trim();
    const newUses = Number(rows[bestIndex][3] || 0) + 1;

    sheet.getRange(sheetRow, 4).setValue(newUses);
    sheet.getRange(sheetRow, 5).setValue(new Date());

    return {
      success: true,
      api_key: apiKey,
      api_id: String(rows[bestIndex][0] || ''),
      usos: newUses
    };
  } finally {
    lock.releaseLock();
  }
}

/* ======================== HELPERS ======================== */

function verifyBackendSecret_(body) {
  const expected = PropertiesService.getScriptProperties().getProperty('BACKEND_SECRET') || '';
  const incoming = String(body.backend_secret || '');

  if (!expected || !constantTimeEqual_(expected, incoming)) {
    throw new Error('Acceso backend no autorizado.');
  }
}

function passwordHash_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER') || '';
  const raw = String(salt || '') + ':' + String(password || '');
  const bytes = Utilities.computeHmacSha256Signature(raw, pepper, Utilities.Charset.UTF_8);
  return bytesToHex_(bytes);
}

function findUser_(sheet, usuario) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, CFG.USERS_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (normalizeUser_(values[i][1]) === usuario) {
      return { row: i + 2, values: values[i] };
    }
  }
  return null;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const mismatch = headers.some((h, i) => String(current[i] || '').trim() !== h);
    if (mismatch) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function sheet_(name) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Ejecuta configurarSistema() una vez.');
  const ss = SpreadsheetApp.openById(id);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('No existe la hoja ' + name + '.');
  return sh;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (_) {
    return e.parameter || {};
  }
}

function normalizeUser_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEstado_(value) {
  return String(value || '').trim().toUpperCase();
}

function parseDateInput_(text) {
  text = String(text || '').trim();
  if (!text) return null;
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('La fecha debe tener formato YYYY-MM-DD.');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function coerceDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = String(value || '').trim();
  if (!text) return null;
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function dateToIso_(value) {
  const d = coerceDate_(value);
  if (!d) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function randomHex_(bytes) {
  let result = '';
  while (result.length < bytes * 2) {
    result += Utilities.getUuid().replace(/-/g, '');
  }
  return result.slice(0, bytes * 2);
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function constantTimeEqual_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
