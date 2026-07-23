document.addEventListener('DOMContentLoaded', async () => {
    const actScreen = document.getElementById('activation-screen');
    const mainScreen = document.getElementById('main-screen');

    // --- 1. AUTENTICACIÓN ---
    try {
        const statusRes = await fetch('/api/status');
        const statusData = await statusRes.json();
        if(statusData.activated) {
            actScreen.classList.remove('active'); actScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden'); mainScreen.classList.add('active');
        }
    } catch(e) {}

    document.getElementById('activate-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const code = document.getElementById('license-code').value.trim();
        const err = document.getElementById('error-msg');
        if(!code) return;
        btn.textContent = "Autorizando..."; btn.disabled = true;
        try {
            const res = await fetch('/api/activar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: code })
            });
            if (res.ok) {
                actScreen.classList.remove('active'); actScreen.classList.add('hidden');
                mainScreen.classList.remove('hidden'); mainScreen.classList.add('active');
            } else { err.textContent = "Acceso Denegado."; err.classList.remove('hidden'); }
        } catch(e) { err.textContent = "Fallo de conexión."; err.classList.remove('hidden'); } 
        finally { btn.textContent = "Autenticar Sistema"; btn.disabled = false; }
    });

    // --- 2. MODO CLARO / OSCURO (CON MEMORIA) ---
    const themeBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('mvp_theme');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeBtn.textContent = '☀️';
    }

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        themeBtn.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('mvp_theme', isLight ? 'light' : 'dark');
    });

    // --- 3. NAVEGACIÓN DE VISTAS ---
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const targetId = item.getAttribute('data-target');
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetId) view.classList.add('active');
            });
            
            if (targetId === 'view-historial') renderHistory();
        });
    });

    // --- 4. VENTANAS MODALES ---
    const modalTriggers = document.querySelectorAll('.modal-trigger');
    const closeButtons = document.querySelectorAll('.close-modal');

    modalTriggers.forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            document.getElementById(modalId).classList.remove('hidden');
        });
    });

    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

    // --- 5. FILTROS DE RESULTADOS ---
    const tabs = document.querySelectorAll('.tab');
    const resultsContainer = document.getElementById('results-container');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const filter = tab.getAttribute('data-filter');
            const items = resultsContainer.querySelectorAll('.result-card');
            
            items.forEach(item => {
                if (filter === 'all') item.style.display = 'flex';
                else if (item.getAttribute('data-type') === filter) item.style.display = 'flex';
                else item.style.display = 'none';
            });
        });
    });

    // --- 6. GESTIÓN DE AUDIO Y DESCARGAS ---
    let currentFile = null;
    const downloadBtn = document.getElementById('download-btn');
    const ytUrl = document.getElementById('youtube-url');
    const statusText = document.getElementById('download-status');
    const dropZone = document.getElementById('drop-zone');
    const dropContent = document.getElementById('drop-content');
    const fileInput = document.getElementById('file-input');
    
    const btnKaraoke = document.getElementById('btn-karaoke');
    const btnStems = document.getElementById('btn-stems');
    const processStatus = document.getElementById('process-status');

    function setFileReady(filePath, title) {
        currentFile = filePath;
        // Ajuste visual centrado y en negrita para la caja de subida
        dropContent.innerHTML = `
            <span class="cloud-icon" style="color:#10B981; margin-bottom: 5px;">✔</span>
            <p style="color:var(--text-main); font-weight:700; word-break: break-word; padding: 0 10px;">${title}</p>
            <span class="formats" style="color:#10B981; font-weight:700; display:block; margin-top:15px; font-size: 14px;">Audio listo para IA</span>
        `;
        dropZone.classList.add('file-loaded');
        btnKaraoke.disabled = false; btnStems.disabled = false;
    }

    downloadBtn.addEventListener('click', async () => {
        if(!ytUrl.value) return;
        downloadBtn.disabled = true;
        statusText.textContent = "Descargando audio..."; statusText.style.color = "#8B5CF6"; statusText.classList.remove('hidden');
        try {
            const res = await fetch('/api/descargar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ytUrl.value })
            });
            const data = await res.json();
            if(res.ok) { 
                statusText.style.color = "#10B981"; 
                statusText.textContent = "¡Completado!"; // Ajuste de texto solicitado
                setFileReady(data.file_path, data.title + ".wav"); 
            }
            else throw new Error();
        } catch(e) { statusText.style.color = "#EF4444"; statusText.textContent = "Fallo en descarga."; } 
        finally { downloadBtn.disabled = false; }
    });

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if(e.dataTransfer.files.length > 0) await handleFileUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', async (e) => {
        if(e.target.files.length > 0) await handleFileUpload(e.target.files[0]);
    });

    async function handleFileUpload(file) {
        dropContent.innerHTML = `<p style="color:#8B5CF6; font-weight: 700;">Subiendo...</p>`;
        const formData = new FormData(); formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if(res.ok) setFileReady(data.file_path, data.title);
        } catch(e) { dropContent.innerHTML = `<span class="cloud-icon">☁</span><p style="color:#EF4444; font-weight: 700;">Error.</p>`; }
    }

    // --- 7. IA Y GUARDADO EN HISTORIAL LOCAL ---
    async function executeAI(mode, button) {
        if(!currentFile) return;
        btnKaraoke.disabled = true; btnStems.disabled = true;
        const originalText = button.innerHTML;
        button.innerHTML = "⏳ Procesando...";
        processStatus.style.color = "#8B5CF6"; processStatus.textContent = "Conectando con MVSEP..."; processStatus.classList.remove('hidden');

        try {
            const res = await fetch('/api/procesar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_path: currentFile, mode: mode })
            });
            const data = await res.json();
            if(res.ok && data.task_id) pollTaskStatus(data.task_id, mode, button, originalText);
            else throw new Error("Error del servidor");
        } catch(e) {
            processStatus.style.color = "#EF4444"; processStatus.textContent = "Error.";
            button.innerHTML = originalText; btnKaraoke.disabled = false; btnStems.disabled = false;
        }
    }

    function pollTaskStatus(taskId, mode, button, originalText) {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/task/${taskId}`);
                const data = await res.json();

                if (data.status === "processing") {
                    processStatus.textContent = data.message;
                } else if (data.status === "success") {
                    clearInterval(interval);
                    processStatus.classList.add('hidden');
                    
                    saveToHistory(data.files, mode);
                    renderWaveforms(data.files, mode, resultsContainer);
                    
                    button.innerHTML = originalText; btnKaraoke.disabled = false; btnStems.disabled = false;
                } else if (data.status === "error") {
                    clearInterval(interval);
                    processStatus.style.color = "#EF4444"; processStatus.textContent = `Error: ${data.message}`;
                    button.innerHTML = originalText; btnKaraoke.disabled = false; btnStems.disabled = false;
                }
            } catch (e) {}
        }, 3000);
    }

    btnKaraoke.addEventListener('click', () => executeAI("2stems", btnKaraoke));
    btnStems.addEventListener('click', () => executeAI("7stems", btnStems));

    // --- 8. FUNCIONES DE RENDERIZADO Y MEMORIA ---
    function saveToHistory(filesArray, mode) {
        const history = JSON.parse(localStorage.getItem('mvp_history') || '[]');
        history.unshift({ date: new Date().toLocaleString(), mode: mode, files: filesArray });
        localStorage.setItem('mvp_history', JSON.stringify(history));
    }

    function renderHistory() {
        const historyContainer = document.getElementById('history-container');
        const history = JSON.parse(localStorage.getItem('mvp_history') || '[]');
        
        if(history.length === 0) {
            historyContainer.innerHTML = `<div class="empty-state">Aún no has procesado ninguna canción.</div>`;
            return;
        }

        historyContainer.innerHTML = '';
        history.forEach((item) => {
            const tempDiv = document.createElement('div');
            tempDiv.style.marginBottom = "20px";
            renderWaveforms(item.files, item.mode, tempDiv, `(${item.date})`);
            historyContainer.appendChild(tempDiv);
        });
    }

    function renderWaveforms(filesArray, mode, targetContainer, extraTitle = "") {
        const baseId = Math.floor(Math.random() * 100000);
        const typeClass = mode === "2stems" ? "karaoke" : "stems";
        const title = mode === "2stems" ? "Separación de Karaoke" : "Separación Multistem";
        const badge = mode === "2stems" ? "KARAOKE" : "STEMS";
        
        let tracksHtml = filesArray.map((fileName, idx) => {
            const uniqueId = `wave-${baseId}-${idx}`;
            return `
            <div class="track-row">
                <button class="play-btn btn-primary" id="btn-${uniqueId}">▶</button>
                <div class="track-info">
                    <div class="track-name">${fileName.replace('.wav', '')}</div>
                    <div id="${uniqueId}" class="waveform-container"></div>
                </div>
                <a href="/output/${fileName}" download="${fileName}" class="btn-dl-small">⬇ Guardar</a>
            </div>`;
        }).join('');

        const emptyState = document.getElementById('empty-state');
        if(emptyState && targetContainer === resultsContainer) emptyState.classList.add('hidden');
        
        const wrapper = document.createElement('div');
        wrapper.className = "result-card";
        wrapper.setAttribute("data-type", typeClass);
        wrapper.style.flexDirection = "column";
        wrapper.style.alignItems = "stretch";
        
        wrapper.innerHTML = `
            <div class="result-info" style="margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
                <div class="result-icon">🎧</div>
                <div class="result-details">
                    <h4>${title} ${extraTitle} <span class="badge">${badge}</span></h4>
                </div>
            </div>
            <div class="tracks-container">${tracksHtml}</div>
        `;
        
        targetContainer.prepend(wrapper);

        if(targetContainer === resultsContainer) {
            const activeTab = document.querySelector('.tab.active').getAttribute('data-filter');
            if (activeTab !== 'all' && activeTab !== typeClass) wrapper.style.display = 'none';
        }

        filesArray.forEach((fileName, idx) => {
            const uniqueId = `wave-${baseId}-${idx}`;
            const wavesurfer = WaveSurfer.create({
                container: `#${uniqueId}`,
                waveColor: '#6B7280', progressColor: '#8B5CF6', cursorColor: '#10B981',
                barWidth: 2, barGap: 1, barRadius: 2, height: 50,
                url: `/output/${fileName}`
            });

            const playBtn = document.getElementById(`btn-${uniqueId}`);
            playBtn.addEventListener('click', () => {
                wavesurfer.playPause();
                playBtn.textContent = wavesurfer.isPlaying() ? '⏸' : '▶';
            });
            wavesurfer.on('finish', () => playBtn.textContent = '▶');
        });
    }
});