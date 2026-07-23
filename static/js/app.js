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
    // 2. DESCARGA DE YOUTUBE (SIN USAR EL SERVIDOR)
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
            statusText.style.color = "#03dac6"; // Verde éxito
            statusText.innerText = "⏳ Generando enlace premium desde tu red...";

            try {
                // Extraemos el código del video
                const match = urlInput.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
                if (!match) throw new Error("La URL no es de YouTube o no es válida.");
                const videoId = match[1];

                // Petición directa a RapidAPI desde el navegador
                const resApi = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
                    method: "GET",
                    headers: {
                        "x-rapidapi-key": "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
                        "x-rapidapi-host": "youtube-mp36.p.rapidapi.com"
                    }
                });

                const dataApi = await resApi.json();
                if (!dataApi.link) throw new Error("La API no pudo generar el enlace. Intenta otro video.");

                // Forzamos la descarga en el navegador del usuario
                statusText.innerText = "✅ ¡Listo! Descargando a tu dispositivo...";
                
                const a = document.createElement("a");
                a.href = dataApi.link;
                a.target = "_blank"; 
                a.download = `Audio_${videoId}.mp3`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                statusText.innerText = "⬇️ Audio descargado localmente. Ahora arrástralo a la caja '2. Subir audio'.";

            } catch (error) {
                statusText.style.color = "#cf6679"; // Rojo error
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
