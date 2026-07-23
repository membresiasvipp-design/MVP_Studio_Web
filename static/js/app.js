document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. SISTEMA DE AUTENTICACIÓN (LICENCIA UNIVERSAL)
    // ==========================================
    const activateBtn = document.getElementById("activate-btn");

    // 1.1 Comprobar si ya ingresaste la clave antes (para no pedirla a cada rato)
    if (localStorage.getItem("MVP_WEB_ACTIVE") === "true") {
        const activationScreen = document.getElementById("activation-screen");
        const mainScreen = document.getElementById("main-screen");
        if (activationScreen && mainScreen) {
            activationScreen.classList.remove("active");
            activationScreen.classList.add("hidden");
            mainScreen.classList.remove("hidden");
        }
    }
    
    // 1.2 Validación offline de la licencia universal
    if (activateBtn) {
        activateBtn.addEventListener("click", () => {
            const codeInput = document.getElementById("license-code").value.trim();
            const errorMsg = document.getElementById("error-msg");
            
            if (!codeInput) {
                errorMsg.innerText = "Por favor, ingresa un código válido.";
                errorMsg.classList.remove("hidden");
                return;
            }
            
            // Validamos que sea MVP-STUDIO (convirtiendo a mayúsculas para aceptar minúsculas también)
            if (codeInput.toUpperCase() === "MVP-STUDIO") {
                localStorage.setItem("MVP_WEB_ACTIVE", "true");
                document.getElementById("activation-screen").classList.remove("active");
                document.getElementById("activation-screen").classList.add("hidden");
                document.getElementById("main-screen").classList.remove("hidden");
            } else {
                errorMsg.style.color = "#cf6679";
                errorMsg.innerText = "Código incorrecto. La licencia universal es MVP-STUDIO.";
                errorMsg.classList.remove("hidden");
            }
        });
    }

    // ==========================================
    // 2. DESCARGA DE YOUTUBE (MULTIPLICADOR DE APIS)
    // ==========================================
    
    // ⚠️ PEGA AQUÍ TODAS TUS LLAVES (API KEYS)
    // Agrega tantas líneas como correos te crees, siempre entre comillas y separadas por comas.
    const rapidApiKeys = [
        "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c", // Tu llave actual
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
            statusText.innerHTML = "⏳ Consultando la API (Rotando llave de seguridad)...";

            try {
                // Elegir una llave al azar del arreglo
                const randomIndex = Math.floor(Math.random() * rapidApiKeys.length);
                let selectedKey = rapidApiKeys[randomIndex];
                
                // Si por accidente elige una de prueba que dice "pega_aqui", usa la primera por defecto
                if (selectedKey.includes("pega_aqui")) {
                    selectedKey = rapidApiKeys[0];
                }

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
                    throw new Error(`RapidAPI: Límite mensual alcanzado con esta llave o no estás suscrito.`);
                }

                if (dataApi.success === false) {
                    throw new Error(dataApi.error || "La API rechazó el enlace.");
                }

                let finalLink = null;
                if (dataApi.link) finalLink = dataApi.link;
                else if (dataApi.download) finalLink = dataApi.download;
                else if (dataApi.url) finalLink = dataApi.url;
                else if (dataApi.mp3) finalLink = dataApi.mp3;
                else {
                    statusText.innerHTML = `
                        <div style="margin-top: 15px; padding: 15px; background: rgba(207, 102, 121, 0.1); border-radius: 8px; border: 1px solid #cf6679; overflow-x: auto;">
                            <p style="color: #cf6679; margin-bottom: 10px;">⚠️ API OK, pero formato distinto:</p>
                            <pre style="color: #fff; font-size: 0.8rem;">${JSON.stringify(dataApi, null, 2)}</pre>
                        </div>
                    `;
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
    // 3. SUBIDA Y ARRASTRE DE ARCHIVOS (CAJA 2 REPARADA)
    // ==========================================
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        const dropZone = input.closest('.drop-zone') || input.parentElement;

        if (dropZone) {
            // Cancelar el comportamiento del navegador de abrir el archivo en otra pestaña
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false);
            });

            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }

            // Efectos de luces al arrastrar
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

            // Procesar el archivo cuando se suelta el clic
            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;

                if (files.length) {
                    input.files = files; // Forzamos al input a recibir el archivo
                    // Lanzamos el evento "change" para que reaccione visualmente
                    const event = new Event('change', { bubbles: true });
                    input.dispatchEvent(event);
                }
            });
        }

        // Mostrar texto verde de confirmación
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                const textDisplay = dropZone.querySelector('.file-name') || dropZone.querySelector('p');
                
                if (textDisplay) {
                    textDisplay.innerText = `✅ Archivo adjuntado: ${fileName}`;
                    textDisplay.style.color = "#03dac6";
                    textDisplay.style.fontWeight = "bold";
                }
            }
        });
    });

    // ==========================================
    // 4. CONTROL DE MENÚS Y VENTANAS MODALES
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
                if(targetView) {
                    targetView.classList.remove('hidden');
                    targetView.classList.add('active');
                }
            }
        });
    });

    document.querySelectorAll('.modal-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            if(modalId) {
                document.getElementById(modalId).classList.remove('hidden');
            }
        });
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

});
