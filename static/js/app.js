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
    // 2. DESCARGA DE YOUTUBE (PUENTE DE REDIRECCIÓN)
    // ==========================================
    const downloadBtn = document.getElementById("download-btn");
    
    if(downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            const urlInput = document.getElementById("youtube-url").value.trim();
            const statusText = document.getElementById("download-status");

            if (!urlInput) {
                alert("Por favor, pega un enlace válido de YouTube.");
                return;
            }

            // Mostramos el puente de redirección instantáneamente (sin fetch, sin bloqueos)
            statusText.classList.remove("hidden");
            statusText.innerHTML = `
                <div style="margin-top: 15px; padding: 15px; background: rgba(3, 218, 198, 0.1); border-radius: 8px; border: 1px solid #03dac6;">
                    <p style="color: #fff; margin-bottom: 10px;">✅ ¡Enlace preparado!</p>
                    <p style="color: #a2a5b5; font-size: 0.9rem; margin-bottom: 10px;">Para evitar bloqueos del servidor, usa nuestra herramienta externa aliada:</p>
                    
                    <a href="https://cobalt.tools/?u=${encodeURIComponent(urlInput)}" target="_blank" style="display: inline-block; padding: 12px 20px; background: #03dac6; color: #000; font-weight: bold; text-decoration: none; border-radius: 5px; width: 100%; text-align: center; margin-bottom: 10px;">🚀 OBTENER AUDIO AHORA</a>
                    
                    <div style="text-align: left; color: #a2a5b5; font-size: 0.85rem;">
                        <b>Pasos rápidos:</b><br>
                        1. Haz clic en el botón de arriba.<br>
                        2. En la nueva pestaña, selecciona <b>Audio</b> y descarga.<br>
                        3. Vuelve aquí y arrastra el archivo a la caja "2. Subir audio".
                    </div>
                </div>
            `;
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
