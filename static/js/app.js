document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. SISTEMA DE AUTENTICACIÓN (RECUERDA LA SESIÓN)
    // ==========================================
    const activateBtn = document.getElementById("activate-btn");
    const activationScreen = document.getElementById("activation-screen");
    const mainScreen = document.getElementById("main-screen");

    // Al iniciar, verificamos si ya ingresaste la clave correcta antes
    if (localStorage.getItem("MVP_LICENCIA") === "MVP-STUDIO") {
        if (activationScreen && mainScreen) {
            activationScreen.classList.remove("active");
            activationScreen.classList.add("hidden");
            mainScreen.classList.remove("hidden");
        }
    } else {
        // Si hay sesiones antiguas o bugueadas, las limpiamos para empezar fresco
        localStorage.clear();
        if (activationScreen && mainScreen) {
            activationScreen.classList.remove("hidden");
            activationScreen.classList.add("active");
            mainScreen.classList.add("hidden");
        }
    }
    
    if (activateBtn) {
        activateBtn.addEventListener("click", () => {
            // Convertimos todo a mayúsculas para que acepte "mvp-studio" o "MVP-STUDIO"
            const codeInput = document.getElementById("license-code").value.trim().toUpperCase();
            const errorMsg = document.getElementById("error-msg");
            
            if (!codeInput) {
                errorMsg.innerText = "Por favor, ingresa un código válido.";
                errorMsg.classList.remove("hidden");
                return;
            }
            
            if (codeInput === "MVP-STUDIO") {
                // Borramos todo rastro viejo y guardamos la llave maestra definitiva
                localStorage.clear();
                localStorage.setItem("MVP_LICENCIA", "MVP-STUDIO");
                
                activationScreen.classList.remove("active");
                activationScreen.classList.add("hidden");
                mainScreen.classList.remove("hidden");
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
            statusText.innerHTML = "⏳ Consultando la API (Rotando llave de seguridad)...";

            try {
                // Selecciona una llave aleatoria para no gastar siempre la misma
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
    // 3. SUBIDA Y ARRASTRE DE ARCHIVOS (CAJA 2 REPARADA AL 100%)
    // ==========================================
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        // Encontramos la caja contenedora real (ya sea por clase o por su padre directo)
        const dropZone = input.closest('.drop-zone') || input.parentElement;

        if (dropZone) {
            // Bloqueamos el navegador para que no abra el archivo en una pestaña nueva
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            // Luces al arrastrar
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = "#03dac6";
                    dropZone.style.background = "rgba(3, 218, 198, 0.05)";
                }, false);
            });

            // Apagar luces al soltar
            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.style.borderColor = "";
                    dropZone.style.background = "";
                }, false);
            });

            // Atrapamos el archivo al soltarlo
            dropZone.addEventListener('drop', (e) => {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    input.files = e.dataTransfer.files; // Forzamos al sistema a aceptar el archivo
                    // Le decimos a la página que el archivo cambió
                    const event = new Event('change', { bubbles: true });
                    input.dispatchEvent(event);
                }
            });
        }

        // Lógica visual para cuando el archivo ya está adentro (por clic o por arrastre)
        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                
                // Buscamos si hay un texto tipo "p" para reemplazar
                let textDisplay = dropZone ? (dropZone.querySelector('.file-name') || dropZone.querySelector('p')) : null;
                
                if (textDisplay) {
                    textDisplay.innerText = `✅ Archivo cargado: ${fileName}`;
                    textDisplay.style.color = "#03dac6";
                    textDisplay.style.fontWeight = "bold";
                } else if (dropZone) {
                    // Si no había texto antes, lo creamos forzosamente para confirmar
                    const successMsg = document.createElement('p');
                    successMsg.innerText = `✅ Archivo cargado: ${fileName}`;
                    successMsg.style.color = "#03dac6";
                    successMsg.style.fontWeight = "bold";
                    dropZone.appendChild(successMsg);
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
