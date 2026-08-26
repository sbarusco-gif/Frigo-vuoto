import logging
import os
import re
import json
from typing import List
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chefmind")

app = FastAPI(title="ChefMind Pro API", version="4.0.0")

# =========================================================
# CORS
# =========================================================
origins_env = os.getenv("ALLOWED_ORIGINS", "*").strip()
allow_origins = ["*"] if origins_env == "*" else [
    origin.strip().rstrip("/")
    for origin in origins_env.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# =========================================================
# GROQ
# =========================================================
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# =========================================================
# OPENVERSE
# =========================================================
OPENVERSE_API = "https://api.openverse.org/v1/images/"
OPENVERSE_USER_AGENT = "ChefMindPro/4.0"

# =========================================================
# MODELLI
# =========================================================
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
    ricette: List[Ricetta] = Field(min_length=3, max_length=3)


class RicettaRequest(BaseModel):
    lista: List[str] = Field(..., min_length=1, max_length=30)
    mode: str = "ai"
    strict: bool = False


# =========================================================
# JSON SCHEMA
# =========================================================
RECIPE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "ricette": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "titolo": {"type": "string"},
                    "tempo": {"type": "string"},
                    "calorie": {"type": "integer"},
                    "fonte": {"type": "string"},
                    "immagine_keyword": {"type": "string"},
                    "ingredienti_con_dosi": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "passaggi": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "segreto_chef": {"type": "string"},
                    "vino": {"type": "string"},
                    "impiattamento": {"type": "string"},
                    "ingredienti_mancanti": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "domanda_utente": {"type": "string"}
                },
                "required": [
                    "titolo",
                    "tempo",
                    "calorie",
                    "fonte",
                    "immagine_keyword",
                    "ingredienti_con_dosi",
                    "passaggi",
                    "segreto_chef",
                    "vino",
                    "impiattamento",
                    "ingredienti_mancanti",
                    "domanda_utente"
                ]
            }
        }
    },
    "required": ["ricette"]
}


# =========================================================
# FILTRO IMMAGINI
# =========================================================
SYNONYMS = {
    "pollo": {"pollo", "chicken"},
    "chicken": {"pollo", "chicken"},
    "curry": {"curry"},
    "riso": {"riso", "rice"},
    "rice": {"riso", "rice"},
    "pasta": {"pasta"},
    "spaghetti": {"spaghetti", "pasta"},
    "manzo": {"manzo", "beef"},
    "beef": {"manzo", "beef"},
    "maiale": {"maiale", "pork"},
    "pork": {"maiale", "pork"},
    "salmone": {"salmone", "salmon"},
    "salmon": {"salmone", "salmon"},
    "patata": {"patata", "patate", "potato", "potatoes"},
    "patate": {"patata", "patate", "potato", "potatoes"},
    "pomodoro": {"pomodoro", "pomodori", "tomato", "tomatoes"},
    "pomodori": {"pomodoro", "pomodori", "tomato", "tomatoes"},
    "funghi": {"funghi", "mushroom", "mushrooms"},
    "uovo": {"uovo", "uova", "egg", "eggs"},
    "uova": {"uovo", "uova", "egg", "eggs"},
}

FORBIDDEN = {
    "statue", "sculpture", "monument", "building", "car",
    "person", "portrait", "dog", "cat", "bird", "horse",
    "logo", "map", "poster", "drawing", "illustration",
    "painting", "museum", "landscape", "dosa", "crepe",
    "pancake", "chapati", "naan", "tortilla"
}


def clean(value: str) -> str:
    value = re.sub(r"[^a-zA-ZÀ-ÿ0-9\s-]", " ", value or "")
    return re.sub(r"\s+", " ", value).strip().lower()


def tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-ZÀ-ÿ0-9]+", clean(value))
        if len(token) >= 3
    }


def required_groups(recipe: Ricetta) -> list[set[str]]:
    groups = []

    for token in tokens(recipe.titolo):
        group = SYNONYMS.get(token)
        if group and group not in groups:
            groups.append(set(group))

    query = clean(recipe.immagine_keyword)

    if "curry" in query and {"curry"} not in groups:
        groups.append({"curry"})

    return groups[:3]


def find_image(recipe: Ricetta) -> dict:
    groups = required_groups(recipe)

    if not groups:
        return {}

    queries = list(dict.fromkeys([
        f"{clean(recipe.titolo)} food photography",
        clean(recipe.immagine_keyword)
    ]))

    candidates = []

    for query in queries:
        try:
            params = urlencode({
                "q": query[:200],
                "page_size": 30,
                "page": 1,
                "license_type": "commercial,modification",
                "mature": "false",
                "filter_dead": "true",
                "size": "medium,large"
            })

            request = Request(
                f"{OPENVERSE_API}?{params}",
                headers={
                    "User-Agent": OPENVERSE_USER_AGENT,
                    "Accept": "application/json"
                }
            )

            with urlopen(request, timeout=10) as response:
                data = json.loads(
                    response.read().decode("utf-8")
                )

            for item in data.get("results", []):
                title = clean(item.get("title", ""))
                description = clean(item.get("description", ""))

                tags = " ".join(
                    clean(
                        tag.get("name", "")
                        if isinstance(tag, dict)
                        else str(tag)
                    )
                    for tag in (item.get("tags") or [])
                )

                searchable = f"{title} {description} {tags}"

                if not all(
                    any(term in searchable for term in group)
                    for group in groups
                ):
                    continue

                if any(term in searchable for term in FORBIDDEN):
                    continue

                score = 50

                for group in groups:
                    if any(term in title for term in group):
                        score += 30
                    elif any(term in tags for term in group):
                        score += 20
                    else:
                        score += 10

                if int(item.get("width") or 0) >= 700:
                    score += 5

                if int(item.get("height") or 0) >= 400:
                    score += 5

                candidates.append((score, item))

        except Exception as exc:
            logger.warning("Errore Openverse: %s", exc)

    if not candidates:
        return {}

    candidates.sort(
        key=lambda item: item[0],
        reverse=True
    )

    score, best = candidates[0]

    # Soglia alta: meglio nessuna foto che una foto sbagliata.
    if score < 70:
        return {}

    return {
        "immagine_url": (
            best.get("thumbnail")
            or best.get("url")
            or ""
        ),
        "immagine_page_url": (
            best.get("foreign_landing_url")
            or ""
        ),
        "immagine_autore": best.get("creator") or "",
        "immagine_licenza": (
            f"{best.get('license', '')} "
            f"{best.get('license_version', '')}"
        ).strip()
    }


# =========================================================
# PROMPT
# =========================================================
def create_prompt(request: RicettaRequest) -> str:
    products = ", ".join(
        str(item).strip().lower()
        for item in request.lista
        if str(item).strip()
    )

    if not products:
        raise ValueError("La lista degli ingredienti è vuota.")

    if request.strict:
        rule = """
MODALITÀ RIGOROSA:
usa esclusivamente gli ingredienti disponibili.
Acqua, sale e normali tecniche di cottura sono ammessi.
ingredienti_mancanti deve essere vuoto.
"""
    else:
        rule = """
MODALITÀ LIBERA:
puoi aggiungere ingredienti complementari realmente necessari.
Indicali in ingredienti_mancanti.
"""

    return f"""
Sei ChefMind Pro, un assistente culinario italiano.

Ingredienti disponibili:
{products}

{rule}

Genera ESATTAMENTE 3 ricette diverse.

Per ogni ricetta:
- titolo: nome preciso del piatto
- tempo: tempo totale
- calorie: numero intero di kcal per porzione
- fonte: "ChefMind Pro"
- immagine_keyword: descrizione inglese molto precisa per cercare
  una fotografia reale del piatto; includi il nome del piatto,
  gli ingredienti distintivi e "food photography"
- ingredienti_con_dosi: quantità e unità
- passaggi: massimo 5 passaggi ordinati
- segreto_chef: consiglio pratico
- vino: abbinamento
- impiattamento: indicazione estetica
- ingredienti_mancanti: eventuali ingredienti aggiuntivi
- domanda_utente: domanda cordiale finale

Non inserire URL.
Non inventare fonti.
Non inserire markdown.
Restituisci esclusivamente JSON conforme allo schema.
"""


# =========================================================
# API
# =========================================================
@app.get("/")
@app.head("/")
def home():
    return {
        "status": "ChefMind Pro Online",
        "provider": "Groq",
        "model": GROQ_MODEL,
        "groq_configured": bool(GROQ_API_KEY),
        "image_provider": "Openverse"
    }


@app.post("/genera", response_model=RispostaRicette)
async def genera(request: RicettaRequest):

    if client is None:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY non configurata sul server."
        )

    if request.mode not in {"ai", "web"}:
        raise HTTPException(
            status_code=400,
            detail="mode deve essere 'ai' oppure 'web'."
        )

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Sei ChefMind Pro. "
                        "Rispondi in italiano. "
                        "Rispetta rigorosamente lo schema JSON."
                    )
                },
                {
                    "role": "user",
                    "content": create_prompt(request)
                }
            ],
            temperature=0.4,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "chefmind_recipes",
                    "strict": True,
                    "schema": RECIPE_SCHEMA
                }
            }
        )

        content = response.choices[0].message.content or ""

        if not content:
            raise RuntimeError(
                "Il modello ha restituito una risposta vuota."
            )

        result = RispostaRicette.model_validate_json(content)

        if len(result.ricette) != 3:
            raise RuntimeError(
                "Il modello ha restituito "
                f"{len(result.ricette)} ricette invece di 3."
            )

        if request.strict:
            for recipe in result.ricette:
                recipe.ingredienti_mancanti = []

        # La ricerca delle immagini è separata dalla generazione.
        for recipe in result.ricette:
            try:
                image = find_image(recipe)

                for key, value in image.items():
                    setattr(recipe, key, value)

            except Exception:
                logger.exception(
                    "Errore ricerca immagine: %s",
                    recipe.titolo
                )

        return result

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Errore generazione IA")

        message = str(exc)

        if "429" in message or "rate limit" in message.lower():
            raise HTTPException(
                status_code=429,
                detail=(
                    "Limite Groq temporaneamente raggiunto. "
                    "Riprova tra poco."
                )
            ) from exc

        raise HTTPException(
            status_code=502,
            detail=f"Errore nella generazione IA: {message}"
        ) from exc



# =========================================================
# HEALTH CHECK RENDER
# =========================================================
@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


# =========================================================
# AVVIO
# =========================================================
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "10000"))

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port
    )
