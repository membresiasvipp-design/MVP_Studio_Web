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
