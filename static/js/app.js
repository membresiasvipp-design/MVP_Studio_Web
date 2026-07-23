// ==========================================
    // 5. PROCESAMIENTO DE IA (RESTAURADO AL ORIGINAL)
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
            // PASO 1: Subir el archivo a /api/upload
            const formData = new FormData();
            formData.append("file", fileInput.files[0]);

            const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) throw new Error("Error al subir archivo.");

            statusDiv.innerHTML = "⏳ Iniciando separación con Inteligencia Artificial...";

            // PASO 2: Iniciar el proceso en /api/procesar
            const processRes = await fetch("/api/procesar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Asumimos un mode predeterminado, cámbialo si tu HTML tiene un selector de modo
                body: JSON.stringify({ file_path: uploadData.file_path, mode: "vocal_instrumental" })
            });

            const processData = await processRes.json();
            if (!processRes.ok) throw new Error("Error al iniciar el motor de IA.");

            const taskId = processData.task_id;

            // PASO 3: Consultar el estado de la tarea (Polling)
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
                        // Asumiendo que statusData.result trae los links de descarga desde Python
                        resultDiv.innerHTML = `<p style="color:#03dac6;">Pistas listas. Revisa la carpeta de resultados o descárgalas.</p>`;
                    }
                } else if (statusData.status === "error") {
                    clearInterval(checkStatus);
                    throw new Error(statusData.message || "La IA falló al separar el audio.");
                }
            }, 3000); // Consulta cada 3 segundos

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
