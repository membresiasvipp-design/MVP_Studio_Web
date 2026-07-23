import time
import threading
import requests
from pathlib import Path

# --- RUTAS SEGURAS ---
USER_MUSIC_DIR = Path.home() / "Music" / "MVP Studio AI"
OUTPUT_DIR = USER_MUSIC_DIR / "Resultados"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class MvsepCloudInference:
    def __init__(self):
        self.api_keys = [
            "njoobBB92WXfpOrPHcxPQbgKv61e8A", "cGu6dBxwGEiLHRZCw78jfQFiqyhy9z",
            "PJOnyg2Le5mWOJWnW41mrzp0Uctxsf", "YcRw9Sv4D6YxRVzLDnbcnFOVBZ2itb",
            "AqKOAKIgGO8gV82Z9kbrBIK9HeSIf5", "6a1ejcdaU6aHN48WXgiiInYFT3sTpL",
            "YGQVWwKNxGiEqkVKgCQ0zyQJcOQ80G",
        ]
        self._key_index = 0
        self._key_lock = threading.Lock()
        
        self.labels_2 = ["Vocals", "Instrumental"]
        self.labels_7 = ["Bass", "Drums", "Other", "Vocals", "Guitar", "Piano", "Instrumental"]
        print("[*] Motor MVSEP Cloud API Inicializado.")

    def _get_key(self):
        with self._key_lock:
            key = self.api_keys[self._key_index % len(self.api_keys)]
            self._key_index = (self._key_index + 1) % len(self.api_keys)
        return key

    def process_audio_task(self, input_wav: str, mode: str, task_id: str, tasks_dict: dict):
        try:
            sep_type = 63 if mode == "7stems" else 40
            add_opt1 = None if mode == "7stems" else 81
            add_opt2 = None if mode == "7stems" else 2
            
            song_name = Path(input_wav).stem.replace(" ", "_")
            mensaje = "Subiendo archivo pesado a los servidores de MVP..."
            print(f"[IA] {mensaje}")
            tasks_dict[task_id]["message"] = mensaje
            
            with open(input_wav, "rb") as f:
                data = {"api_token": self._get_key(), "sep_type": str(sep_type), "output_format": "1", "is_demo": "0"}
                if add_opt1: data["add_opt1"] = str(add_opt1)
                if add_opt2: data["add_opt2"] = str(add_opt2)
                resp = requests.post("https://mvsep.com/api/separation/create", data=data, files={"audiofile": f}, timeout=180)
            
            result = resp.json()
            if not result.get("success"):
                error_txt = result.get("data", {}).get("message", "Error de servidor")
                print(f"[IA] Error en subida: {error_txt}")
                tasks_dict[task_id] = {"status": "error", "message": error_txt}
                return
            
            hash_tarea = result["data"]["hash"]
            print(f"[IA] Archivo subido con éxito. Hash: {hash_tarea}. Iniciando espera...")
            elapsed = 0
            
            while elapsed < 1800:
                time.sleep(5)
                elapsed += 5
                try:
                    status_resp = requests.get("https://mvsep.com/api/separation/get", params={"hash": hash_tarea}, timeout=60).json()
                    if not status_resp.get("success"): continue
                    
                    estado = status_resp.get("status", "")
                    
                    if estado == "waiting":
                        mensaje = "En cola del servidor. Esperando turno..."
                        tasks_dict[task_id]["message"] = mensaje
                        print(f"[IA] {mensaje}")
                    elif estado == "processing":
                        mensaje = "Extrayendo pistas con Red Neuronal..."
                        tasks_dict[task_id]["message"] = mensaje
                        print(f"[IA] {mensaje}")
                    elif estado == "done":
                        print("[IA] ¡Proceso terminado en la nube! Iniciando descarga de Stems.")
                        files_data = status_resp.get("data", {}).get("files", [])
                        rutas_generadas = []
                        
                        for i, file_info in enumerate(files_data):
                            mensaje_dl = f"Descargando pista {i+1} de {len(files_data)}..."
                            tasks_dict[task_id]["message"] = mensaje_dl
                            print(f"[IA] {mensaje_dl}")
                            
                            stem_url = file_info.get("url", "")
                            if not stem_url: continue
                            
                            if mode == "7stems":
                                label = self.labels_7[i] if i < len(self.labels_7) else f"Stem_{i}"
                            else:
                                label = self.labels_2[i] if i < len(self.labels_2) else f"Stem_{i}"
                                
                            final_name = f"{label}_{song_name}.wav"
                            dest_path = OUTPUT_DIR / final_name
                            
                            stem_resp = requests.get(stem_url, stream=True, timeout=300)
                            with open(dest_path, "wb") as f_out:
                                for chunk in stem_resp.iter_content(chunk_size=8192): f_out.write(chunk)
                                
                            rutas_generadas.append(final_name)
                        
                        print("[IA] ¡Operación Completada 100%!")
                        tasks_dict[task_id] = {"status": "success", "message": "¡Procesamiento exitoso!", "files": rutas_generadas}
                        return
                    elif estado == "failed":
                        print("[IA] El servidor MVP falló al procesar.")
                        tasks_dict[task_id] = {"status": "error", "message": "Fallo en el procesamiento de MVSEP"}
                        return
                except Exception as poll_e: 
                    print(f"[IA] Intento de conexión fallido (reintentando): {poll_e}")
                    pass
                    
            tasks_dict[task_id] = {"status": "error", "message": "Tiempo de espera agotado (30 min)."}
        except Exception as e:
            print(f"[IA] Error crítico general: {e}")
            tasks_dict[task_id] = {"status": "error", "message": str(e)}

ai_engine = MvsepCloudInference()