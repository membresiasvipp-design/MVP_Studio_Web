// Busca el evento de clic de tu botón de descarga y reemplázalo por esto:
document.getElementById("download-btn").addEventListener("click", async () => {
    const urlInput = document.getElementById("youtube-url").value.trim();
    const statusText = document.getElementById("download-status");

    if (!urlInput) {
        alert("Por favor, pega un enlace válido de YouTube.");
        return;
    }

    // Mostramos estado en la interfaz
    statusText.classList.remove("hidden");
    statusText.style.color = "#03dac6"; // Color verde de éxito
    statusText.innerText = "⏳ Generando enlace premium usando tu red local...";

    try {
        // Extraemos el ID del video
        const match = urlInput.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (!match) throw new Error("La URL no es de YouTube o no es válida.");
        const videoId = match[1];

        // 1. LLAMAMOS A LA API DESDE TU NAVEGADOR (Bypass total de Render)
        const resApi = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
            method: "GET",
            headers: {
                "x-rapidapi-key": "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
                "x-rapidapi-host": "youtube-mp36.p.rapidapi.com"
            }
        });

        const dataApi = await resApi.json();
        if (!dataApi.link) throw new Error("La API no pudo generar el enlace. Intenta con otro video.");

        // 2. FORZAMOS LA DESCARGA DIRECTO A TU CARPETA "DESCARGAS"
        statusText.innerText = "✅ ¡Listo! Guardando en tu carpeta de Descargas...";
        
        const a = document.createElement("a");
        a.href = dataApi.link;
        a.target = "_blank"; // Se abre en segundo plano para que el navegador inicie la descarga
        a.download = `Audio_${videoId}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // 3. INSTRUCCIÓN FINAL AL USUARIO
        statusText.innerText = "⬇️ Audio descargado en tu dispositivo. Ahora arrástralo a la caja '2. Subir audio'.";

    } catch (error) {
        statusText.style.color = "#cf6679"; // Color rojo de error
        statusText.innerText = `❌ Error: ${error.message}`;
    }
});
