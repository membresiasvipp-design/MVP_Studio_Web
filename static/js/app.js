document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. SISTEMA DE AUTENTICACIÓN (LOGIN)
    // ==========================================
    const activateBtn = document.getElementById("activate-btn");
    
    if(activateBtn) {
        activateBtn.addEventListener("click", async () => {
            const code = document.getElementById("license-code").value.trim();
            const errorMsg = document.getElementById("error-msg");
            
            if (!code) {
                errorMsg.innerText = "Por favor, ingresa un código válido.";
                errorMsg.classList.remove("hidden");
                return;
            }
            
            errorMsg.innerText = "Autenticando en la nube...";
            errorMsg.style.color = "#03dac6";
            errorMsg.classList.remove("hidden");

            try {
                const res = await fetch("/api/activar", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({codigo: code})
                });
                
                if (res.ok) {
                    localStorage.setItem("MVP_WEB_ACTIVE", "true");
                    document.getElementById("activation-screen").classList.remove("active");
                    document.getElementById("activation-screen").classList.add("hidden");
                    document.getElementById("main-screen").classList.remove("hidden");
                } else {
                    errorMsg.style.color = "#cf6679";
                    errorMsg.innerText = "Código incorrecto, expirado o denegado.";
                }
            } catch(e) {
                errorMsg.style.color = "#cf6679";
                errorMsg.innerText = "Error de conexión con el servidor.";
            }
        });
    }

    if (localStorage.getItem("MVP_WEB_ACTIVE") === "true") {
        const activationScreen = document.getElementById("activation-screen");
        const mainScreen = document.getElementById("main-screen");
        if(activationScreen && mainScreen) {
            activationScreen.classList.remove("active");
            activationScreen.classList.add("hidden");
            mainScreen.classList.remove("hidden");
        }
    }

    // ==========================================
    // 2. DESCARGA DE YOUTUBE (YT Search And Download MP3 - CORREGIDO)
    // ==========================================
    const downloadBtn = document.getElementById("download-btn");
    
    if(downloadBtn) {
        downloadBtn.addEventListener("click", async () => {
            const urlInput = document.getElementById("youtube-url").value.trim();
            const statusText = document.getElementById("download-status");

            if (!urlInput) {
                alert("Por favor, pega un enlace válido de YouTube.");
                return;
            }

            statusText.classList.remove("hidden");
            statusText.style.color = "#03dac6"; 
            statusText.innerHTML = "⏳ Consultando la nueva API de MP3...";

            try {
                // CORRECCIÓN: Le enviamos la URL completa encriptada en formato web en lugar del ID
                const apiUrl = `https://yt-search-and-download-mp3.p.rapidapi.com/mp3?url=${encodeURIComponent(urlInput)}`;

                const resApi = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        "x-rapidapi-key": "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
                        "x-rapidapi-host": "yt-search-and-download-mp3.p.rapidapi.com"
                    }
                });

                const dataApi = await resApi.json();

                if (!resApi.ok || dataApi.message === "You are not subscribed to this API.") {
                    throw new Error(`RapidAPI: ${dataApi.message || "Error desconocido. Revisa si le diste a 'Subscribe to Test' en RapidAPI."}`);
                }

                // Si la API dice explícitamente "success: false", lanzamos el error
                if (dataApi.success === false) {
                    throw new Error(dataApi.error || "La API rechazó el enlace.");
                }

                // Intentamos capturar el enlace de descarga en sus diferentes nombres posibles
                let finalLink = null;
                if (dataApi.link) finalLink = dataApi.link;
                else if (dataApi.download) finalLink = dataApi.download;
                else if (dataApi.url) finalLink = dataApi.url;
                else if (dataApi.mp3) finalLink = dataApi.mp3;
                else {
                    // Modo Diagnóstico (por si ahora el error es otro o nos da el enlace con otro nombre)
                    statusText.innerHTML = `
                        <div style="margin-top: 15px; padding: 15px; background: rgba(207, 102, 121, 0.1); border-radius: 8px; border: 1px solid #cf6679; overflow-x: auto;">
                            <p style="color: #cf6679; margin-bottom: 10px;">⚠️ La API respondió con éxito, pero con un formato distinto. Cópiale esto a la IA:</p>
                            <pre style="color: #fff; font-size: 0.8rem;">${JSON.stringify(dataApi, null, 2)}</pre>
                        </div>
                    `;
                    return;
                }

                // Generamos el botón verde directo
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
    // 3. CONTROL DE MENÚS Y VENTANAS MODALES
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
