import logging
import os
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chefmind")

app = FastAPI(title="ChefMind Pro API", version="2.0.0")

# -----------------------------
# CORS
# -----------------------------
_origins_env = os.getenv("ALLOWED_ORIGINS", "*").strip()

if _origins_env == "*":
    allow_origins = ["*"]
else:
    allow_origins = [
        origin.strip().rstrip("/")
        for origin in _origins_env.split(",")
        if origin.strip()
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# -----------------------------
# Gemini
# -----------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# -----------------------------
# Schemi Pydantic
# -----------------------------
class Ricetta(BaseModel):
    titolo: str
    tempo: str
    calorie: int = Field(ge=0)
    fonte: str
    immagine_keyword: str
    ingredienti_con_dosi: List[str]
    passaggi: List[str]
    segreto_chef: str
    vino: str
    impiattamento: str
    ingredienti_mancanti: List[str]
    domanda_utente: str


class RispostaRicette(BaseModel):
    ricette: List[Ricetta] = Field(min_length=1, max_length=3)


class RicettaRequest(BaseModel):
    lista: List[str] = Field(..., min_length=1, max_length=30)
    mode: str = Field(default="ai")
    strict: bool = False


# -----------------------------
# Prompt
# -----------------------------
def crea_prompt(request: RicettaRequest) -> str:
    prodotti = ", ".join(
        str(item).strip().lower()
        for item in request.lista
        if str(item).strip()
    )

    if not prodotti:
        raise ValueError("La lista degli ingredienti è vuota.")

    if request.mode == "web":
        modalita = """
MODALITÀ WEB:
usa la ricerca web disponibile per verificare ricette e fonti reali.
La voce "fonte" deve indicare una fonte effettivamente consultata.
Non inventare siti, ricette o riferimenti.
"""
    else:
        modalita = """
MODALITÀ AI:
genera ricette originali sulla base degli ingredienti indicati.
Non dichiarare come consultata una fonte web che non è stata realmente verificata.
Se non stai usando una fonte esterna, usa "ChefMind Pro" come fonte.
"""

    if request.strict:
        regola = """
MODALITÀ RIGOROSA:
usa esclusivamente gli ingredienti presenti nella dispensa.
Sono consentiti soltanto acqua, sale e normali tecniche di cottura.
Non proporre ingredienti mancanti.
ingredienti_mancanti deve essere una lista vuota.
"""
    else:
        regola = """
MODALITÀ LIBERA:
puoi aggiungere ingredienti complementari realmente necessari.
Indica gli ingredienti aggiuntivi in ingredienti_mancanti.
"""

    return f"""
Sei ChefMind Pro, un assistente culinario italiano.

Ingredienti disponibili:
{prodotti}

{modalita}
{regola}

Genera esattamente 3 ricette diverse.

Per ogni ricetta:
- titolo: nome chiaro della ricetta
- tempo: tempo totale, ad esempio "30 minuti"
- calorie: stima numerica delle kcal per porzione
- fonte: fonte reale solo se effettivamente consultata; altrimenti "ChefMind Pro"
- immagine_keyword: una sola keyword inglese specifica per il cibo
- ingredienti_con_dosi: lista con quantità e unità
- passaggi: massimo 5 passaggi brevi e ordinati
- segreto_chef: consiglio pratico
- vino: abbinamento
- impiattamento: indicazione estetica
- ingredienti_mancanti: lista degli ingredienti aggiuntivi necessari; vuota in modalità rigorosa
- domanda_utente: domanda cordiale finale

Non inventare dati di ricerca.
Non inserire markdown.
Restituisci esclusivamente la struttura JSON richiesta dallo schema.
"""


# -----------------------------
# Health check
# -----------------------------
@app.get("/")
def home():
    return {
        "status": "ChefMind Pro Online",
        "model": GEMINI_MODEL,
        "gemini_configured": bool(GEMINI_API_KEY),
    }


# -----------------------------
# Generazione ricette
# -----------------------------
@app.post("/genera", response_model=RispostaRicette)
async def genera(request: RicettaRequest):
    if client is None:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY non configurata sul server."
        )

    if request.mode not in {"ai", "web"}:
        raise HTTPException(
            status_code=400,
            detail="mode deve essere 'ai' oppure 'web'."
        )

    try:
        prompt = crea_prompt(request)

        tools = None

        if request.mode == "web":
            tools = [
                types.Tool(
                    google_search=types.GoogleSearch()
                )
            ]

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RispostaRicette,
            temperature=0.7,
            tools=tools,
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )

        if not response.text:
            raise RuntimeError("Gemini ha restituito una risposta vuota.")

        # Con output strutturato, il JSON è già vincolato allo schema.
        risultato = RispostaRicette.model_validate_json(response.text)

        if len(risultato.ricette) != 3:
            raise RuntimeError(
                f"Gemini ha restituito {len(risultato.ricette)} ricette invece di 3."
            )

        # Sicurezza applicativa: in modalità rigorosa non devono comparire
        # ingredienti mancanti.
        if request.strict:
            for ricetta in risultato.ricette:
                ricetta.ingredienti_mancanti = []

        return risultato

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Errore nella generazione delle ricette")
        raise HTTPException(
            status_code=502,
            detail=f"Errore nella generazione Gemini: {str(exc)}"
        ) from exc


# -----------------------------
# Avvio locale / Render
# -----------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "10000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
