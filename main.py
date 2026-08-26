import json
import logging
import os
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chefmind")

app = FastAPI(title="ChefMind Pro API", version="5.0.0")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip()
PORT = int(os.getenv("PORT", "10000"))
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

origins = os.getenv("ALLOWED_ORIGINS", "*").strip()
allow_origins = ["*"] if origins == "*" else [x.strip().rstrip("/") for x in origins.split(",") if x.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "POST", "OPTIONS"],
    allow_headers=["*"],
)

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
    immagine_url: str = ""
    immagine_page_url: str = ""
    immagine_autore: str = ""
    immagine_licenza: str = ""

class RispostaRicette(BaseModel):
    ricette: List[Ricetta] = Field(min_length=1, max_length=3)

class RicettaRequest(BaseModel):
    lista: List[str] = Field(min_length=1, max_length=30)
    mode: str = "ai"
    strict: bool = False

PROP = {
    "titolo": {"type": "string"},
    "tempo": {"type": "string"},
    "calorie": {"type": "integer"},
    "fonte": {"type": "string"},
    "immagine_keyword": {"type": "string"},
    "ingredienti_con_dosi": {"type": "array", "items": {"type": "string"}},
    "passaggi": {"type": "array", "items": {"type": "string"}},
    "segreto_chef": {"type": "string"},
    "vino": {"type": "string"},
    "impiattamento": {"type": "string"},
    "ingredienti_mancanti": {"type": "array", "items": {"type": "string"}},
    "domanda_utente": {"type": "string"},
}

def schema(min_items=1, max_items=3):
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "ricette": {
                "type": "array",
                "minItems": min_items,
                "maxItems": max_items,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": PROP,
                    "required": list(PROP),
                },
            }
        },
        "required": ["ricette"],
    }

def prompt(req, count=3, existing=None):
    products = ", ".join(x.strip().lower() for x in req.lista if x.strip())
    rule = (
        "Usa esclusivamente gli ingredienti disponibili; ingredienti_mancanti deve essere []."
        if req.strict else
        "Puoi aggiungere ingredienti complementari necessari e devi indicarli in ingredienti_mancanti."
    )
    excluded = ""
    if existing:
        excluded = "Non ripetere queste ricette: " + ", ".join(existing) + "."
    return f"""
Sei ChefMind Pro, assistente culinario italiano.
Ingredienti disponibili: {products}
{rule}
Genera ESATTAMENTE {count} ricette diverse.
{excluded}
Per ogni ricetta indica titolo, tempo totale, calorie intere per porzione,
fonte="ChefMind Pro", ingredienti_con_dosi, massimo 5 passaggi,
segreto_chef, vino, impiattamento, ingredienti_mancanti e domanda_utente.
immagine_keyword deve essere una keyword INGLESE molto specifica per una
fotografia reale del piatto finito, ad esempio "chicken curry with basmati rice food photography".
Non inserire URL, markdown o fonti inventate. Restituisci solo JSON.
"""

def find_image(recipe):
    words = re.findall(r"[A-Za-zÀ-ÿ0-9]+", recipe.titolo.lower())
    query = f"{recipe.immagine_keyword} food photography"
    try:
        params = urlencode({
            "q": query[:200], "page_size": 25, "mature": "false",
            "filter_dead": "true", "size": "medium,large"
        })
        req = Request(
            "https://api.openverse.org/v1/images/?" + params,
            headers={"User-Agent": "ChefMindPro/5.0", "Accept": "application/json"},
        )
        with urlopen(req, timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))
        candidates = []
        for item in data.get("results", []):
            text = " ".join([
                str(item.get("title", "")),
                str(item.get("description", "")),
                " ".join(str(t.get("name", "")) if isinstance(t, dict) else str(t) for t in item.get("tags", [])),
            ]).lower()
            if any(x in text for x in ["statue","building","portrait","dog","cat","logo","map","painting","landscape"]):
                continue
            score = sum(1 for w in words if len(w) >= 3 and w in text)
            if score:
                candidates.append((score, item))
        if not candidates:
            return {}
        item = sorted(candidates, key=lambda x: x[0], reverse=True)[0][1]
        return {
            "immagine_url": item.get("thumbnail") or item.get("url") or "",
            "immagine_page_url": item.get("foreign_landing_url") or "",
            "immagine_autore": item.get("creator") or "",
            "immagine_licenza": f"{item.get('license','')} {item.get('license_version','')}".strip(),
        }
    except Exception as exc:
        logger.warning("Openverse: %s", exc)
        return {}

@app.get("/", include_in_schema=False)
@app.head("/", include_in_schema=False)
def root():
    return {"status": "ChefMind Pro Online", "provider": "Groq", "model": GROQ_MODEL, "groq_configured": bool(GROQ_API_KEY)}

@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
def health():
    return {"status": "ok"}

@app.post("/genera", response_model=RispostaRicette)
async def genera(req: RicettaRequest):
    if client is None:
        raise HTTPException(500, "GROQ_API_KEY non configurata sul server.")
    if req.mode not in {"ai", "web"}:
        raise HTTPException(400, "mode deve essere 'ai' oppure 'web'.")
    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "Sei ChefMind Pro. Rispondi in italiano e solo JSON valido."},
                {"role": "user", "content": prompt(req)},
            ],
            temperature=0.3,
            response_format={"type": "json_schema", "json_schema": {
                "name": "chefmind_recipes", "strict": True, "schema": schema(1, 3)
            }},
        )
        content = response.choices[0].message.content or ""
        result = RispostaRicette.model_validate_json(content)

        if len(result.ricette) < 3:
            missing = 3 - len(result.ricette)
            extra = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": "Sei ChefMind Pro. Rispondi solo JSON valido."},
                    {"role": "user", "content": prompt(req, missing, [r.titolo for r in result.ricette])},
                ],
                temperature=0.3,
                response_format={"type": "json_schema", "json_schema": {
                    "name": "chefmind_extra", "strict": True, "schema": schema(missing, missing)
                }},
            )
            extra_text = extra.choices[0].message.content or ""
            result.ricette.extend(RispostaRicette.model_validate_json(extra_text).ricette)

        if len(result.ricette) != 3:
            raise RuntimeError("Impossibile ottenere 3 ricette.")
        if req.strict:
            for r in result.ricette:
                r.ingredienti_mancanti = []

        for r in result.ricette:
            image = find_image(r)
            for key, value in image.items():
                setattr(r, key, value)
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Errore generazione")
        msg = str(exc)
        if "429" in msg or "rate limit" in msg.lower():
            raise HTTPException(429, "Limite Groq temporaneamente raggiunto. Riprova tra poco.") from exc
        raise HTTPException(502, f"Errore nella generazione IA: {msg}") from exc

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
