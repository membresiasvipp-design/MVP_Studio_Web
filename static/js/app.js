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
                    // Guardar sesión y mostrar pantalla principal
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

    // Auto-ingreso si ya estabas logueado previamente
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
    // 2. DESCARGA DE YOUTUBE (VÍA COBALT FRONTEND)
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
            statusText.innerHTML = "⏳ Extrayendo audio en alta calidad...";

            try {
                // Hacemos la petición directa a los servidores de Cobalt
                const resApi = await fetch("https://api.cobalt.tools/api/json", {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        url: urlInput,
                        isAudioOnly: true,
                        aFormat: "wav" // Pedimos WAV directo para que tu IA no falle
                    })
                });

                if (!resApi.ok) {
                    throw new Error("El servidor de extracción está ocupado. Intenta de nuevo.");
                }

                const dataApi = await resApi.json();
                
                // Cobalt devuelve la url final en dataApi.url
                if (dataApi.status === "error" || !dataApi.url) {
                    throw new Error(dataApi.text || "No se pudo extraer el audio de este enlace.");
                }

                // Generamos el botón de descarga con el enlace limpio
                statusText.innerHTML = `
                    <div style="margin-top: 15px; padding: 15px; background: rgba(3, 218, 198, 0.1); border-radius: 8px; border: 1px solid #03dac6;">
                        <p style="color: #fff; margin-bottom: 10px;">✅ ¡Audio WAV procesado con éxito!</p>
                        <a href="${dataApi.url}" target="_blank" style="display: inline-block; padding: 12px 20px; background: #03dac6; color: #000; font-weight: bold; text-decoration: none; border-radius: 5px; width: 100%; text-align: center;">⬇️ DESCARGAR WAV AHORA</a>
                        <p style="color: #a2a5b5; font-size: 0.8rem; margin-top: 10px;">* Al descargar, arrastra el archivo a la caja 2.</p>
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
    
    // Navegación de la barra lateral
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Quitar clase active a todos
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Ocultar todas las vistas
            document.querySelectorAll('.view-section').forEach(v => {
                v.classList.add('hidden');
                v.classList.remove('active');
            });
            
            // Mostrar la vista seleccionada
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

    // Abrir Modales (Ajustes, Ayuda, Acerca de)
    document.querySelectorAll('.modal-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            if(modalId) {
                document.getElementById(modalId).classList.remove('hidden');
            }
        });
    });

    // Cerrar Modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

});
