# MVP Studio IA WEB – Render V2 Login

Esta versión reemplaza la clave de activación por **usuario + contraseña** y conserva:
- Subida desde PC.
- YouTube.
- Google Drive / Dropbox / MEGA.
- Catálogo completo de modelos.
- MP3 320 / WAV 16-bit / FLAC 16-bit.
- Cola y estados del servidor.
- Resultados reproducidos/descargados directamente desde MVSep.
- Archivos temporales eliminados de Render.

## Sesión persistente
El usuario inicia sesión una vez. Render entrega una cookie:
- HttpOnly
- Secure
- SameSite=Lax
- duración 90 días
- renovada en cada visita válida

La contraseña nunca se guarda en localStorage ni en una cookie.

## Un solo Google Sheet
Crea un archivo:
`MVP_STUDIO_IA_CONTROL`

Pega `GOOGLE_APPS_SCRIPT_CODE.gs` en:
Google Sheet -> Extensiones -> Apps Script.

Ejecuta una vez:
`configurarSistema()`

Se crean:
- `USUARIOS`
- `API_KEYS`

También se generan internamente:
- BACKEND_SECRET
- PASSWORD_PEPPER

El registro mostrará:
`CONTROL_BACKEND_SECRET=...`

## Crear usuarios
Después de recargar el Google Sheet tendrás un menú:
`MVP Studio IA`

Usa:
- Crear usuario
- Cambiar contraseña
- Bloquear / Activar usuario

Las contraseñas quedan guardadas como hash HMAC-SHA256 + salt + pepper, nunca como texto.

## API_KEYS
Agrega filas debajo de los encabezados:
- ID
- API_KEY
- ACTIVA
- USOS
- ULTIMO_USO
- OBSERVACION

Ejemplo:
`API-01 | TU_API | SI | 0 | | Principal`

El script selecciona una API activa con menor cantidad de usos e incrementa USOS.

## Deploy Apps Script
Implementar -> Nueva implementación -> Aplicación web
- Ejecutar como: Yo
- Acceso: Cualquier usuario

Copia la URL que termina en `/exec`.

## Variables Render
Obligatorias:
- `CONTROL_SCRIPT_URL` = URL `/exec`
- `CONTROL_BACKEND_SECRET` = secreto generado por `configurarSistema()`

Opcionales:
- `SESSION_SECRET` = otra clave larga. Si falta, se usa CONTROL_BACKEND_SECRET.
- `SESSION_DAYS=90`

Ya no uses:
- licencia de activación
- activation.json
- APPS_SCRIPT_URL antiguo

## Bloqueo y vencimiento
Antes de abrir una sesión y antes de iniciar cada trabajo se comprueba el usuario.

`ESTADO=ACTIVO` permite uso.
`ESTADO=BLOQUEADO` lo bloquea.
`FECHA_VENCE` vacía = sin vencimiento.

Los sondeos de progreso NO consultan Google Sheets cada segundo.
