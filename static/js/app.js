document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. AUTENTICACIÓN (LOGIN REPARADO Y CONECTADO)
    // ==========================================
    const activateBtn = document.getElementById("activate-btn");
    const activationScreen = document.getElementById("activation-screen");
    const mainScreen = document.getElementById("main-screen");

    if (localStorage.getItem("MVP_LICENCIA") === "MVP-STUDIO") {
        if (activationScreen && mainScreen) {
            activationScreen.classList.remove("active");
            activationScreen.classList.add("hidden");
            mainScreen.classList.remove("hidden");
        }
    } else {
        localStorage.clear();
        if (activationScreen && mainScreen) {
            activationScreen.classList.remove("hidden");
            activationScreen.classList.add("active");
            mainScreen.classList.add("hidden");
        }
    }
    
    if (activateBtn) {
        activateBtn.addEventListener("click", async () => {
            const codeInput = document.getElementById("license-code").value.trim().toUpperCase();
            const errorMsg = document.getElementById("error-msg");
            
            if (!codeInput) {
                errorMsg.innerText = "Por favor, ingresa un código válido.";
                errorMsg.classList.remove("hidden");
                return;
            }
            
            errorMsg.innerText = "Verificando licencia en el servidor...";
            errorMsg.style.color = "#03dac6";
            errorMsg.classList.remove("hidden");

            try {
                // Conexión exacta al endpoint /api/activar de tu Python
                const res = await fetch("/api/activar", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({codigo: codeInput})
                });
                
                if (res.ok) {
                    localStorage.setItem("MVP_LICENCIA", "MVP-STUDIO");
                    activationScreen.classList.remove("active");
                    activationScreen.classList.add("hidden");
                    mainScreen.classList.remove("hidden");
                } else {
                    errorMsg.style.color = "#cf6679";
                    errorMsg.innerText = "Código incorrecto. Usa MVP-STUDIO.";
                }
            } catch(e) {
                errorMsg.style.color = "#cf6679";
                errorMsg.innerText = "Error crítico: El servidor de Python no está respondiendo.";
            }
        });
    }

    // ==========================================
    // 2. DESCARGA DE YOUTUBE (5 APIS INTEGRADAS)
    // ==========================================
    const rapidApiKeys = [
        "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
        "888f464c07msh621e9af27d21c95p1cdb4bjsne25a8dadb01",
        "1600ab41b0mshba51e6268dbfa6bp1557e9jsn5433bc7b4a41",
        "6e26ba6b63msh3faa503b0918aa0p1b4bbdjsn3256a17b8c58",
        "6fcde4fc19msh99b815da3f28394p163d8ajsn270a16c240d3"
    ];

    const downloadBtn = document.getElementById("download-btn");
    
    if (downloadBtn) {
        downloadBtn.addEventListener("click", async () => {
            const urlInput = document.getElementById("youtube-url").value.trim();
            const statusText = document.getElementById("download-status");

            if (!urlInput) {
                alert("Por favor, pega un enlace válido de YouTube.");
                return;
            }

            statusText.classList.remove("hidden");
            statusText.style.color = "#03dac6"; 
            statusText.innerHTML = "⏳ Consultando la API (Rotando llave)...";

            try {
                const randomIndex = Math.floor(Math.random() * rapidApiKeys.length);
                const selectedKey = rapidApiKeys[randomIndex];
                const apiUrl = `https://yt-search-and-download-mp3.p.rapidapi.com/mp3?url=${encodeURIComponent(urlInput)}`;

                const resApi = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        "x-rapidapi-key": selectedKey,
                        "x-rapidapi-host": "yt-search-and-download-mp3.p.rapidapi.com"
                    }
                });

                const dataApi = await resApi.json();

                if (!resApi.ok || dataApi.message === "You are not subscribed to this API.") {
                    throw new Error("Límite alcanzado con esta llave de RapidAPI.");
                }
                if (dataApi.success === false) {
                    throw new Error(dataApi.error || "La API rechazó el enlace.");
                }

                let finalLink = dataApi.link || dataApi.download || dataApi.url || dataApi.mp3;
                if (!finalLink) {
                    statusText.innerHTML = `<p style="color: #cf6679;">⚠️ Error de formato en la API.</p>`;
                    return;
                }

                statusText.innerHTML = `
                    <div style="margin-top: 15px; padding: 15px; background: rgba(3, 218, 198, 0.1); border-radius: 8px; border: 1px solid #03dac6;">
                        <p style="color: #fff; margin-bottom: 10px;">✅ ¡Enlace MP3 listo!</p>
                        <a href="${finalLink}" target="_blank" style="display: inline-block; padding: 12px 20px; background: #03dac6; color: #000; font-weight: bold; text-decoration: none; border-radius: 5px; width: 100%; text-align: center;">⬇️ DESCARGAR MP3 AHORA</a>
                    </div>
                `;
            } catch (error) {
                statusText.style.color = "#cf6679"; 
                statusText.innerText = `❌ Error: ${error.message}`;
            }
        });
    }

    // ==========================================
    // 3. SUBIDA MANUAL DE ARCHIVOS (CLIC Y ARRASTRE)
    // ==========================================
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        const dropZone = input.closest('.drop-zone') || input.parentElement;

        if (dropZone) {
            dropZone.addEventListener('click', (e) => {
                if (e.target !== input) input.click(); 
            });
            dropZone.style.cursor = "pointer";

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault(); e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = "#03dac6";
                    dropZone.style.background = "rgba(3, 218, 198, 0.05)";
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = "";
                    dropZone.style.background = "";
                }, false);
            });

            dropZone.addEventListener('drop', (e) => {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    input.files = e.dataTransfer.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }

        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                let textDisplay = dropZone ? (dropZone.querySelector('.file-name') || dropZone.querySelector('p')) : null;
                if (textDisplay) {
                    textDisplay.innerText = `✅ Archivo listo: ${fileName}`;
                    textDisplay.style.color = "#03dac6";
                    textDisplay.style.fontWeight = "bold";
                }
            }
        });
    });

    // ==========================================
    // 4. CONTROL DE MENÚS Y VENTANAS
    // ==========================================
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.view-section').forEach(v => {
                v.classList.add('hidden');
                v.classList.remove('active');
            });
            
            const targetId = item.getAttribute('data-target');
            if(targetId) {
                const targetView = document.getElementById(targetId);
                if(targetView) targetView.classList.remove('hidden').classList.add('active');
            }
        });
    });

    document.querySelectorAll('.modal-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            if(modalId) document.getElementById(modalId).classList.remove('hidden');
        });
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

    // ==========================================
    // 5. CAJA 3: PROCESAMIENTO CONECTADO AL BACKEND
    // ==========================================
    const processForm = document.getElementById("process-form");
    const processBtn = document.getElementById("process-btn");
    
    const handleProcess = async (e) => {
        if(e) e.preventDefault();
        
        const fileInput = document.querySelector('input[type="file"]');
        const statusDiv = document.getElementById("processing-status");
        const resultDiv = document.getElementById("results-area");

        if (!fileInput || fileInput.files.length === 0) {
            alert("Por favor, sube un archivo de audio primero.");
            return;
        }

        if (statusDiv) {
            statusDiv.classList.remove("hidden");
            statusDiv.style.color = "#03dac6";
            statusDiv.innerHTML = "⏳ Subiendo archivo al servidor...";
        }

        try {
            // FASE 1: Subir audio a tu servidor Python
            const formData = new FormData();
            formData.append("file", fileInput.files[0]);

            const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error("Error al subir archivo.");

            statusDiv.innerHTML = "⏳ Iniciando separación con Inteligencia Artificial...";

            // FASE 2: Iniciar motor IA
            const processRes = await fetch("/api/procesar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file_path: uploadData.file_path, mode: "vocal_instrumental" })
            });

            const processData = await processRes.json();
            if (!processRes.ok) throw new Error("Error al iniciar el motor de IA.");

            const taskId = processData.task_id;

            // FASE 3: Consultar progreso en segundo plano
            const checkStatus = setInterval(async () => {
                const statusRes = await fetch(`/api/task/${taskId}`);
                const statusData = await statusRes.json();

                if (statusData.status === "processing") {
                    statusDiv.innerHTML = `⏳ Procesando: ${statusData.message || 'Separando pistas...'}`;
                } else if (statusData.status === "completed") {
                    clearInterval(checkStatus);
                    statusDiv.innerHTML = "✅ ¡Procesamiento completado con éxito!";
                    if (resultDiv) {
                        resultDiv.classList.remove("hidden");
                        resultDiv.innerHTML = `<p style="color:#03dac6;">Pistas listas. Revisa la carpeta de resultados o descárgalas.</p>`;
                    }
                } else if (statusData.status === "error") {
                    clearInterval(checkStatus);
                    throw new Error(statusData.message || "La IA falló al separar el audio.");
                }
            }, 3000);

        } catch (error) {
            if (statusDiv) {
                statusDiv.innerHTML = `❌ Error: ${error.message}`;
                statusDiv.style.color = "#cf6679";
            }
        }
    };

    if (processForm) processForm.addEventListener("submit", handleProcess);
    else if (processBtn) processBtn.addEventListener("click", handleProcess);
});
