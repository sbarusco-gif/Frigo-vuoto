import os
import json
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chefmind")

app = FastAPI()

# CORS: in produzione imposta ALLOWED_ORIGINS (es. "https://tuosito.it,https://www.tuosito.it")
# Se non impostata, resta aperta ("*") per comodità in sviluppo.
_origins_env = os.environ.get("ALLOWED_ORIGINS", "*")
allow_origins = ["*"] if _origins_env.strip() == "*" else [o.strip() for o in _origins_env.split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allow_origins, allow_methods=["*"], allow_headers=["*"])

# Configurazione Gemini (Usa la chiave GEMINI_API_KEY su Render)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY non impostata: le richieste a /genera falliranno.")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-3.6-flash')

class RicettaRequest(BaseModel):
    lista: list[str] = Field(..., min_length=1, max_length=30)
    mode: str
    strict: bool

def estrai_json(testo: str) -> dict:
    """Estrae il JSON dalla risposta del modello, tollerando blocchi markdown ```json ... ```"""
    t = testo.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        t = t[4:] if t.lower().startswith("json") else t
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Nessun oggetto JSON trovato nella risposta del modello")
    return json.loads(t[start:end + 1])

@app.get("/")
def home():
    return "ok"

@app.post("/genera")
async def genera(request: RicettaRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY non configurata sul server")
    prodotti = ", ".join(request.lista)
    # FORZIAMO 3 RICETTE
    prompt = f"""
    Sei ChefMind Pro. Rispondi in Italiano. 
    REGOLE: {"USA SOLO gli ingredienti forniti" if request.strict else "Puoi suggerire extra"}.
    Crea 3 ricette diverse con: {prodotti}. 
    Rispondi SOLO in JSON puro.
    
    Struttura obbligatoria per ogni ricetta:
    - titolo: Nome
    - tempo: min
    - calorie: kcal
    - fonte: Nome sito reale (es: GialloZafferano, Cookist, Cucchiaio d'Argento)
    - immagine_keyword: UNA parola inglese specifica di cibo (es: 'pasta', 'chicken', 'pizza')
    - ingredienti_con_dosi: lista con quantità (es: '200g di riso')
    - passaggi: lista step brevi (max 5)
    - segreto_chef: consiglio rapido
    - vino: abbinamento
    - impiattamento: estetica
    - ingredienti_mancanti: lista nomi e dosi
    - domanda_utente: domanda cordiale
    
    Struttura finale: {{ "ricette": [ {{...}}, {{...}}, {{...}} ] }}
    """

    try:
        response = model.generate_content(prompt)
        return estrai_json(response.text)
    except Exception as e:
        logger.exception("Errore nella generazione o nel parsing della risposta Gemini")
        return {"error": str(e), "ricette": []}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
