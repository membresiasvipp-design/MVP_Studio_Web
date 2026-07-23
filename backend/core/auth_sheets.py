import requests

def validar_y_activar(codigo: str) -> bool:
    # TU ENLACE EXACTO DE GOOGLE APPS SCRIPT
    url = "https://script.google.com/macros/s/AKfycbzrLxLRizIDqbi_huLhyT3iW2o-4DvfylJj2ghpk-9MSnLEPsV907wgT5kWyjZcLAYq/exec"
    
    try:
        print(f"[*] Verificando licencia '{codigo}' en la nube...")
        
        # Le enviamos el código a tu script de Google
        parametros = {"codigo": codigo}
        respuesta = requests.get(url, params=parametros, timeout=15)
        
        # Leemos la respuesta de tu script
        texto_respuesta = respuesta.text.strip().lower()
        
        # Validamos si la respuesta indica éxito
        # (Acepta múltiples formas comunes en las que un script responde)
        if "true" in texto_respuesta or "valido" in texto_respuesta or "success" in texto_respuesta or "éxito" in texto_respuesta or "exito" in texto_respuesta:
            print("[*] ¡Licencia válida! Acceso concedido.")
            return True
        else:
            print(f"[X] Licencia rechazada. Respuesta del servidor: {texto_respuesta}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"[X] Error de internet al conectar con Google: {e}")
        return False