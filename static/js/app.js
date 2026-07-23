document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. AUTENTICACIÓN UNIVERSAL (CONECTADA AL BACKEND)
    // ==========================================
    const activateBtn = document.getElementById("activate-btn");
    const activationScreen = document.getElementById("activation-screen");
    const mainScreen = document.getElementById("main-screen");

    // Verificar sesión guardada
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
            
            errorMsg.innerText = "Verificando licencia...";
            errorMsg.style.color = "#03dac6";
            errorMsg.classList.remove("hidden");

            try {
                // Conexión con tu backend en Python (main.py)
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
                errorMsg.innerText = "Error de conexión con el servidor local.";
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
    // 3. SUBIDA MANUAL DE ARCHIVOS (CAJA 2)
    // ==========================================
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        const dropZone = input.closest('.drop-zone') || input.parentElement;

        if (dropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
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
                    const event = new Event('change', { bubbles: true });
                    input.dispatchEvent(event);
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
                }
            }
        });
    });

    // ==========================================
    // 4. PROCESAMIENTO DE IA (CONEXIÓN AL BACKEND)
    // ==========================================
    const processForm = document.getElementById("process-form"); // Asegúrate de que tu form tenga este ID en HTML
    const processBtn = document.getElementById("process-btn"); // O si usas un botón suelto
    
    // Función que envía el archivo a Python
    const handleProcess = async (e) => {
        if(e) e.preventDefault();
        
        const fileInput = document.querySelector('input[type="file"]');
        const statusDiv = document.getElementById("processing-status"); // Asegúrate de tener este div en tu HTML
        const resultDiv = document.getElementById("results-area"); // Asegúrate de tener este div en tu HTML

        if (!fileInput || fileInput.files.length === 0) {
            alert("Por favor, sube un archivo de audio primero.");
            return;
        }

        if (statusDiv) {
            statusDiv.classList.remove("hidden");
            statusDiv.innerHTML = "⏳ Enviando archivo a la Inteligencia Artificial...";
            statusDiv.style.color = "#03dac6";
        }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        try {
            // Llama a tu motor de Python original
            const response = await fetch("/api/procesar", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error("El motor de Python devolvió un error.");
            }

            const data = await response.json();
            
            if (statusDiv) statusDiv.innerHTML = "✅ ¡Separación completada!";
            
            // Muestra los resultados devueltos por Python
            if (resultDiv) {
                resultDiv.classList.remove("hidden");
                resultDiv.innerHTML = data.html || `<p style="color:#03dac6;">Pistas generadas. Revisa tu carpeta de descargas.</p>`;
            }

        } catch (error) {
            if (statusDiv) {
                statusDiv.innerHTML = `❌ Error: ${error.message}`;
                statusDiv.style.color = "#cf6679";
            }
        }
    };

    if (processForm) {
        processForm.addEventListener("submit", handleProcess);
    } else if (processBtn) {
        processBtn.addEventListener("click", handleProcess);
    }
});
