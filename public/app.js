(() => {
"use strict";

const state = {
  mode: "file", file: null, taskId: "", xhr: null, pollTimer: null, polling: false,
  maxBytes: 40 * 1024 * 1024, maxYoutubeSeconds: 1800, cancelled: false,
  authenticated: false, appBound: false, appInitialized: false, user: null
};
const $ = id => document.getElementById(id);
const els = {
  tabFile:$("tab-file"), tabYoutube:$("tab-youtube"), tabLink:$("tab-link"),
  panelFile:$("panel-file"), panelYoutube:$("panel-youtube"), panelLink:$("panel-link"),
  fileInput:$("file-input"), dropZone:$("drop-zone"), fileCard:$("file-card"), fileName:$("file-name"), fileSize:$("file-size"), removeFile:$("remove-file"),
  youtubeUrl:$("youtube-url"), remoteUrl:$("remote-url"), providerBadge:$("provider-badge"),
  model:$("model-select"), format:$("format-select"), process:$("process-btn"),
  progressSection:$("progress-section"), statusTitle:$("status-title"), statusMessage:$("status-message"),
  uploadWrap:$("upload-progress-wrap"), uploadProgress:$("upload-progress"), uploadPercent:$("upload-percent"), uploadStats:$("upload-stats"),
  indeterminate:$("indeterminate"), queueInfo:$("queue-info"), cancel:$("cancel-btn"),
  results:$("results-section"), tracks:$("tracks-grid"), resultModel:$("result-model"), newJob:$("new-job-btn"),
  toast:$("toast"), serverLabel:$("server-label"),
  authScreen:$("auth-screen"), appShell:$("app-shell"), loginForm:$("login-form"),
  loginUser:$("login-user"), loginPassword:$("login-password"), loginBtn:$("login-btn"),
  loginError:$("login-error"), togglePassword:$("toggle-password"), logoutBtn:$("logout-btn"),
  userBox:$("user-box"), userName:$("user-name"), userPlan:$("user-plan")
};

document.addEventListener("DOMContentLoaded", bootstrapAuth);

async function bootstrapAuth(){
  bindAuth();
  const remembered = localStorage.getItem("mvp_last_user") || "";
  if(els.loginUser && remembered) els.loginUser.value = remembered;

  try{
    const r = await fetch("/api/auth/me", {cache:"no-store"});
    const d = await r.json().catch(()=>({}));
    if(r.ok && d.ok){
      showApp(d.user || {});
      return;
    }
  }catch(_){}

  showLogin();
}

function bindAuth(){
  els.loginForm?.addEventListener("submit", login);
  els.logoutBtn?.addEventListener("click", logout);
  els.togglePassword?.addEventListener("click", ()=>{
    const isPassword = els.loginPassword.type === "password";
    els.loginPassword.type = isPassword ? "text" : "password";
    els.togglePassword.textContent = isPassword ? "Ocultar" : "Ver";
  });
}

async function login(e){
  e?.preventDefault();
  const usuario = String(els.loginUser?.value || "").trim();
  const password = String(els.loginPassword?.value || "");
  if(!usuario || !password){
    showLoginError("Ingresa usuario y contraseña.");
    return;
  }

  els.loginBtn.disabled = true;
  showLoginError("");
  try{
    const r = await fetch("/api/auth/login", {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({usuario,password})
    });
    const d = await r.json().catch(()=>({}));
    if(!r.ok || !d.ok) throw new Error(d.detail || d.message || "No se pudo iniciar sesión.");
    localStorage.setItem("mvp_last_user", usuario);
    els.loginPassword.value = "";
    showApp(d.user || {usuario});
  }catch(err){
    showLoginError(err.message || "Usuario o contraseña incorrectos.");
  }finally{
    els.loginBtn.disabled = false;
  }
}

async function logout(){
  clearPoll();
  if(state.xhr){ try{state.xhr.abort()}catch(_){} state.xhr=null; }
  try{ await fetch("/api/auth/logout", {method:"POST"}); }catch(_){}
  state.authenticated=false;
  state.user=null;
  state.taskId="";
  showLogin();
}

function showLogin(){
  state.authenticated=false;
  els.appShell?.classList.add("hidden");
  els.userBox?.classList.add("hidden");
  els.authScreen?.classList.remove("hidden");
  setTimeout(()=>els.loginUser?.focus(),50);
}

function showApp(user){
  state.authenticated=true;
  state.user=user || {};
  els.authScreen?.classList.add("hidden");
  els.appShell?.classList.remove("hidden");
  els.userBox?.classList.remove("hidden");
  if(els.userName) els.userName.textContent = user?.usuario || "Usuario";
  if(els.userPlan) els.userPlan.textContent = user?.plan || "PRO";
  if(!state.appInitialized) initApp();
}

function showLoginError(message){
  if(!els.loginError) return;
  els.loginError.textContent = message || "";
  els.loginError.classList.toggle("hidden", !message);
}

function sessionExpired(message="Tu sesión terminó. Inicia sesión nuevamente."){
  clearPoll();
  state.taskId="";
  showLogin();
  showLoginError(message);
}

async function initApp(){
  if(state.appInitialized) return;
  state.appInitialized=true;
  bind();
  try{
    const r=await fetch("/api/config",{cache:"no-store"}), d=await r.json();
    if(d.maxUploadBytes) state.maxBytes=Number(d.maxUploadBytes);
    if(d.maxYoutubeDurationSeconds) state.maxYoutubeSeconds=Number(d.maxYoutubeDurationSeconds);
    $("drop-zone").querySelector("small").textContent=`MP3 · WAV · FLAC · M4A · AAC · máximo ${(state.maxBytes/1024/1024).toFixed(0)} MB`;
    els.serverLabel.textContent="Render IA conectado";
  }catch{ els.serverLabel.textContent="Servidor IA"; }
  syncQuick();
  refresh();
}

function bind(){
  if(state.appBound) return;
  state.appBound=true;
  els.tabFile?.addEventListener("click",()=>setMode("file"));
  els.tabYoutube?.addEventListener("click",()=>setMode("youtube"));
  els.tabLink?.addEventListener("click",()=>setMode("link"));
  els.dropZone?.addEventListener("click",()=>els.fileInput.click());
  els.fileInput?.addEventListener("change",()=>selectFile(els.fileInput.files?.[0]));
  ["dragenter","dragover"].forEach(ev=>els.dropZone?.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.add("dragover")}));
  ["dragleave","drop"].forEach(ev=>els.dropZone?.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.remove("dragover")}));
  els.dropZone?.addEventListener("drop",e=>selectFile(e.dataTransfer?.files?.[0]));
  els.removeFile?.addEventListener("click",resetFile);
  els.youtubeUrl?.addEventListener("input",refresh);
  els.remoteUrl?.addEventListener("input",()=>{updateProvider();refresh();});
  els.model?.addEventListener("change",syncQuick);
  document.querySelectorAll(".quick-model").forEach(b=>b.addEventListener("click",()=>{els.model.value=b.dataset.model;syncQuick();}));
  els.process?.addEventListener("click",start);
  els.cancel?.addEventListener("click",cancel);
  els.newJob?.addEventListener("click",resetAll);
}

function setMode(mode){
  if(state.taskId||state.xhr)return;
  state.mode=mode;
  [["file",els.tabFile,els.panelFile],["youtube",els.tabYoutube,els.panelYoutube],["link",els.tabLink,els.panelLink]]
    .forEach(([m,t,p])=>{t?.classList.toggle("active",m===mode);p?.classList.toggle("active",m===mode)});
  refresh();
}
function syncQuick(){const v=String(els.model.value);document.querySelectorAll(".quick-model").forEach(b=>b.classList.toggle("active",b.dataset.model===v))}
function selectedModelLabel(){return els.model.options[els.model.selectedIndex]?.textContent?.trim()||`Modelo ${els.model.value}`}
function selectFile(file){
  if(!file)return;
  if(file.size>state.maxBytes){toast(`El archivo supera ${(state.maxBytes/1024/1024).toFixed(0)} MB. Para archivos grandes usa Drive, Dropbox o MEGA.`,true);return;}
  if(!(file.type?.startsWith("audio/")||/\.(mp3|wav|wave|flac|m4a|aac|ogg)$/i.test(file.name||""))){toast("Selecciona un archivo de audio compatible.",true);return;}
  state.file=file;els.fileName.textContent=file.name;els.fileSize.textContent=formatBytes(file.size);
  els.dropZone.classList.add("hidden");els.fileCard.classList.remove("hidden");refresh();
}
function resetFile(){state.file=null;els.fileInput.value="";els.dropZone.classList.remove("hidden");els.fileCard.classList.add("hidden");refresh()}
function detectProvider(raw){
  try{const h=new URL(raw).hostname.toLowerCase().replace(/^www\./,"");
    if(h==="drive.google.com")return{name:"Google Drive",ok:true};
    if(h==="dropbox.com"||h.endsWith(".dropbox.com")||h.endsWith(".dropboxusercontent.com"))return{name:"Dropbox",ok:true};
    if(h==="mega.nz"||h.endsWith(".mega.nz")||h==="mega.io"||h.endsWith(".mega.io")||h.endsWith(".mega.co.nz"))return{name:"MEGA",ok:true};
  }catch{} return{name:"No compatible",ok:false};
}
function updateProvider(){const p=detectProvider(els.remoteUrl.value.trim());els.providerBadge.textContent=p.name;els.providerBadge.classList.toggle("ok",p.ok)}
function validYoutube(v){return /^(https?:\/\/)?(www\.)?(youtube\.com\/|youtu\.be\/)/i.test((v||"").trim())}
function refresh(){
  const ready=state.mode==="file"?!!state.file:state.mode==="youtube"?validYoutube(els.youtubeUrl.value):detectProvider(els.remoteUrl.value.trim()).ok;
  els.process.disabled=!ready||!!state.taskId||!!state.xhr;
}

async function start(){
  state.cancelled=false;clearPoll();els.results.classList.add("hidden");els.tracks.innerHTML="";
  els.progressSection.classList.remove("hidden");els.cancel.disabled=false;els.process.disabled=true;els.queueInfo.classList.add("hidden");
  try{
    let taskId;
    if(state.mode==="file")taskId=await uploadFile();
    else if(state.mode==="youtube")taskId=await startJson("/api/youtube",{url:els.youtubeUrl.value.trim(),model_id:+els.model.value,output_format:+els.format.value});
    else taskId=await startJson("/api/link",{url:els.remoteUrl.value.trim(),model_id:+els.model.value,output_format:+els.format.value});
    if(!taskId)throw new Error("No se recibió identificador de trabajo.");
    state.taskId=taskId;els.uploadWrap.classList.add("hidden");els.indeterminate.classList.remove("hidden");
    await poll();
  }catch(e){if(!state.cancelled)showError(e.message||"No se pudo iniciar el proceso.");}
}
function uploadFile(){
  return new Promise((resolve,reject)=>{
    const fd=new FormData();fd.append("file",state.file);fd.append("model_id",els.model.value);fd.append("output_format",els.format.value);
    const xhr=new XMLHttpRequest();state.xhr=xhr;const start=performance.now();
    xhr.open("POST","/api/upload");xhr.responseType="json";
    setStatus("Subiendo a MVP Studio IA","Recibiendo tu audio temporalmente en Render…");els.uploadWrap.classList.remove("hidden");els.indeterminate.classList.add("hidden");
    xhr.upload.onprogress=e=>{if(!e.lengthComputable)return;const pct=e.loaded/e.total*100,sec=Math.max(.2,(performance.now()-start)/1000),speed=e.loaded/sec;
      els.uploadProgress.style.width=`${pct.toFixed(1)}%`;els.uploadPercent.textContent=`${Math.round(pct)}%`;els.uploadStats.textContent=`${formatBytes(e.loaded)} / ${formatBytes(e.total)} · ${formatBytes(speed)}/s`;
      if(pct>=100)setStatus("Audio recibido","Preparando envío al servidor IA…");
    };
    xhr.onload=()=>{state.xhr=null;const d=xhr.response||{};if(xhr.status===401){sessionExpired(d.detail||"Tu sesión terminó.");reject(new Error(d.detail||"Sesión finalizada."));return;}if(xhr.status>=200&&xhr.status<300)resolve(d.task_id);else reject(new Error(d.detail||d.error||`HTTP ${xhr.status}`));};
    xhr.onerror=()=>{state.xhr=null;reject(new Error("Se perdió la conexión durante la subida."));};
    xhr.onabort=()=>{state.xhr=null;reject(new Error("Subida cancelada."));};
    xhr.send(fd);
  });
}
async function startJson(url,body){
  setStatus(state.mode==="youtube"?"Preparando YouTube":"Preparando enlace","Iniciando trabajo…");els.indeterminate.classList.remove("hidden");
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(r.status===401){sessionExpired(d.detail||"Tu sesión terminó.");throw new Error(d.detail||"Sesión finalizada.");}
  if(!r.ok)throw new Error(d.detail||d.error||"No se pudo iniciar.");
  return d.task_id;
}
async function poll(){
  if(!state.taskId||state.cancelled||state.polling)return;
  state.polling=true;
  try{
    const r=await fetch(`/api/task/${encodeURIComponent(state.taskId)}`,{cache:"no-store"}),d=await r.json().catch(()=>({}));
    if(r.status===401){sessionExpired(d.detail||"Tu sesión terminó.");return;}
    if(!r.ok)throw new Error(d.detail||"No se pudo consultar el proceso.");
    renderTask(d);
    if(!["done","error","cancelled"].includes(String(d.status||"").toLowerCase())&&!state.cancelled)state.pollTimer=setTimeout(poll,1200);
  }catch{if(!state.cancelled){setStatus("Reconectando","La consulta tardó más de lo esperado. Reintentando…");state.pollTimer=setTimeout(poll,3000)}}finally{state.polling=false}
}
function renderTask(d){
  const s=String(d.status||"").toLowerCase();
  setStatus(titleFor(s),d.message||"Procesando…");
  if(Number.isFinite(Number(d.progress))){els.uploadWrap.classList.remove("hidden");els.indeterminate.classList.add("hidden");const p=Math.max(0,Math.min(100,Number(d.progress)));els.uploadProgress.style.width=`${p}%`;els.uploadPercent.textContent=`${Math.round(p)}%`;els.uploadStats.textContent=d.transfer_speed_mbps?`${d.transfer_speed_mbps} MB/s`:d.transfer_speed||"";}
  else{els.uploadWrap.classList.add("hidden");if(!["done","error","cancelled"].includes(s))els.indeterminate.classList.remove("hidden");}
  if(s==="waiting"){renderQueue(d)}else els.queueInfo.classList.add("hidden");
  if(s==="done"){clearPoll();els.indeterminate.classList.add("hidden");els.cancel.disabled=true;renderResults(d.files||[]);return;}
  if(s==="error"){clearPoll();showError(d.message||"El proceso falló.");return;}
  if(s==="cancelled"){clearPoll();resetAfterCancel("Proceso cancelado.");}
}
function titleFor(s){return({queued:"Preparando",youtube_info:"Analizando YouTube",youtube_downloading:"Descargando YouTube",youtube_ready:"YouTube listo",uploading_mvsep:"Enviando a servidor IA",waiting:"En cola",processing:"Procesando",distributing:"Procesando por bloques",merging:"Uniendo resultados",reconnecting:"Reconectando",done:"Pistas listas",cancelling:"Cancelando"}[s]||"Procesando")}
function renderQueue(d){const a=[];if(d.queue_position)a.push(`Posición: <strong>${d.queue_position}</strong>`);if(d.queue_ahead)a.push(`${d.queue_ahead} por delante`);if(d.estimated_wait_seconds)a.push(`Espera estimada: ${formatDuration(d.estimated_wait_seconds)}`);if(!a.length)return;els.queueInfo.innerHTML=a.join(" <span>·</span> ");els.queueInfo.classList.remove("hidden")}
function renderResults(files){
  const list=normalizeFiles(files);if(!list.length){showError("El trabajo terminó pero no se recibieron archivos.");return;}
  list.sort((a,b)=>priority(a.label)-priority(b.label));els.tracks.innerHTML="";
  list.forEach((t,i)=>{const c=document.createElement("article");c.className="track-card";const name=friendly(t.label,i),kind=mediaKind(t.url);const player=kind==="audio"?`<audio controls preload="none" src="${esc(t.url)}"></audio>`:kind==="video"?`<video controls preload="metadata" src="${esc(t.url)}"></video>`:`<div class="generic-file">Archivo listo</div>`;
    c.innerHTML=`<div class="track-top"><span class="track-title">${html(name)}</span><span class="track-type">${kind==="audio"?"PISTA":fileType(t.url)}</span></div>${player}<div class="track-actions"><a class="download-btn" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Descargar directamente ↗</a></div>`;els.tracks.appendChild(c);});
  els.resultModel.textContent=selectedModelLabel();els.results.classList.remove("hidden");els.results.scrollIntoView({behavior:"smooth",block:"start"});state.taskId="";refresh();
}
function normalizeFiles(files){const out=[],seen=new Set();const visit=(v,h="")=>{if(!v)return;if(typeof v==="string"){if(/^https?:\/\//i.test(v)&&!seen.has(v)){seen.add(v);out.push({url:v,label:h||filename(v)})}return}if(Array.isArray(v)){v.forEach((x,i)=>visit(x,h||`Resultado ${i+1}`));return}if(typeof v==="object"){const u=v.url||v.link||v.download_url||v.file;const l=v.label||v.name||v.stem||h;if(typeof u==="string")visit(u,l);}};visit(files);return out}
function friendly(l,i){const t=String(l||"").toLowerCase();if(/instrum|accomp/.test(t))return"Instrumental";if(/vocal|voice|voz/.test(t))return/back|choir|chor|coro/.test(t)?"Coros":"Voz";if(/drum/.test(t))return"Batería";if(/bass/.test(t))return"Bajo";if(/guitar/.test(t))return"Guitarra";if(/piano/.test(t))return"Piano";return String(l||`Resultado ${i+1}`)}
function priority(l){const t=String(l||"").toLowerCase();if(/instrum/.test(t))return 0;if(/vocal|voice|voz/.test(t))return 1;if(/drum/.test(t))return 2;if(/bass/.test(t))return 3;return 10}
function mediaKind(u){const e=ext(u);return["mp3","wav","wave","flac","m4a","aac","ogg","opus","webm"].includes(e)?"audio":["mp4","mov","mkv"].includes(e)?"video":"file"}
async function cancel(){
  state.cancelled=true;clearPoll();
  if(state.xhr){state.xhr.abort();state.xhr=null;resetAfterCancel("Subida cancelada.");return}
  if(state.taskId){try{const r=await fetch(`/api/cancel/${encodeURIComponent(state.taskId)}`,{method:"POST"});if(r.status===401){sessionExpired();return;}}catch{}}
  resetAfterCancel("Cancelación solicitada.");
}
function resetAfterCancel(msg){state.taskId="";state.cancelled=false;els.progressSection.classList.add("hidden");els.indeterminate.classList.add("hidden");els.uploadWrap.classList.add("hidden");refresh();toast(msg)}
function resetAll(){clearPoll();if(state.xhr)try{state.xhr.abort()}catch{}state.taskId="";state.cancelled=false;resetFile();els.youtubeUrl.value="";els.remoteUrl.value="";updateProvider();els.progressSection.classList.add("hidden");els.results.classList.add("hidden");els.tracks.innerHTML="";refresh();window.scrollTo({top:0,behavior:"smooth"})}
function clearPoll(){if(state.pollTimer)clearTimeout(state.pollTimer);state.pollTimer=null;state.polling=false}
function setStatus(a,b){els.statusTitle.textContent=a;els.statusMessage.textContent=b}
function showError(m){clearPoll();state.taskId="";els.indeterminate.classList.add("hidden");els.uploadWrap.classList.add("hidden");els.cancel.disabled=true;setStatus("No se pudo completar",m);refresh();toast(m,true)}
function formatBytes(n){n=Number(n)||0;if(n<1000)return`${n} B`;if(n<1e6)return`${(n/1000).toFixed(1)} KB`;return`${(n/1e6).toFixed(n>=1e7?1:2)} MB`}
function formatDuration(s){s=Math.round(Number(s)||0);return s<60?`${s} s`:`${Math.floor(s/60)} min ${s%60}s`}
function filename(u){try{return decodeURIComponent(new URL(u).pathname.split("/").pop()||"")}catch{return""}}
function ext(u){const n=filename(u),p=n.split(".");return p.length>1?p.pop().toLowerCase():""}
function fileType(u){return(ext(u)||"ARCHIVO").toUpperCase()}
function html(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function esc(v){return html(v)}
let tt;function toast(m,e=false){clearTimeout(tt);els.toast.textContent=m;els.toast.classList.toggle("error",e);els.toast.classList.add("show");tt=setTimeout(()=>els.toast.classList.remove("show"),4200)}
})();