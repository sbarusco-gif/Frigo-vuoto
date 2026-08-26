import React, { useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://chefmind-pro-api.onrender.com";

export default function App() {
  const [ingredienti, setIngredienti] = useState("");
  const [mode, setMode] = useState("ai");
  const [strict, setStrict] = useState(false);
  const [ricette, setRicette] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState("");

  async function generaRicette() {
    const lista = ingredienti
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!lista.length) {
      setErrore("Inserisci almeno un ingrediente.");
      return;
    }

    setLoading(true);
    setErrore("");
    setRicette([]);

    try {
      const response = await fetch(`${API_URL}/genera`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lista,
          mode,
          strict,
        }),
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        throw new Error("Il server ha restituito una risposta non valida.");
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            `Errore del server (${response.status}).`
        );
      }

      if (!data?.ricette || !Array.isArray(data.ricette)) {
        throw new Error("Il server non ha restituito le ricette.");
      }

      setRicette(data.ricette);
    } catch (error) {
      console.error("Errore ChefMind Pro:", error);
      setErrore(
        error?.message ||
          "Impossibile collegarsi al server ChefMind Pro."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>ChefMind Pro</h1>
          <p style={styles.subtitle}>
            Il tuo assistente culinario intelligente
          </p>
        </header>

        <section style={styles.card}>
          <label style={styles.label}>
            Ingredienti disponibili
          </label>

          <textarea
            value={ingredienti}
            onChange={(event) => setIngredienti(event.target.value)}
            placeholder="Esempio: pollo, riso, curry, cipolla"
            rows={4}
            style={styles.textarea}
          />

          <div style={styles.controls}>
            <label style={styles.label}>
              Modalità
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                style={styles.select}
              >
                <option value="ai">AI</option>
                <option value="web">
                  Web
                </option>
              </select>
            </label>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={strict}
                onChange={(event) => setStrict(event.target.checked)}
              />
              Solo ingredienti disponibili
            </label>
          </div>

          <button
            type="button"
            onClick={generaRicette}
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? "Sto creando le ricette..." : "Genera ricette"}
          </button>

          {errore && (
            <div style={styles.error}>
              {errore}
            </div>
          )}
        </section>

        {ricette.length > 0 && (
          <section style={styles.results}>
            <h2 style={styles.resultsTitle}>
              Le tue ricette
            </h2>

            <div style={styles.grid}>
              {ricette.map((ricetta, index) => (
                <article
                  key={`${ricetta.titolo}-${index}`}
                  style={styles.recipeCard}
                >
                  {ricetta.immagine_url ? (
                    <img
                      src={ricetta.immagine_url}
                      alt={ricetta.titolo}
                      style={styles.image}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div style={styles.noImage}>
                      Foto specifica della ricetta non disponibile
                    </div>
                  )}

                  <div style={styles.recipeBody}>
                    <h3 style={styles.recipeTitle}>
                      {ricetta.titolo}
                    </h3>

                    <div style={styles.meta}>
                      <span>⏱ {ricetta.tempo}</span>
                      <span>🔥 {ricetta.calorie} kcal</span>
                    </div>

                    <h4>Ingredienti</h4>
                    <ul>
                      {(ricetta.ingredienti_con_dosi || []).map(
                        (item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        )
                      )}
                    </ul>

                    {ricetta.ingredienti_mancanti?.length > 0 && (
                      <>
                        <h4>Ingredienti da aggiungere</h4>
                        <ul>
                          {ricetta.ingredienti_mancanti.map(
                            (item, itemIndex) => (
                              <li key={itemIndex}>{item}</li>
                            )
                          )}
                        </ul>
                      </>
                    )}

                    <h4>Preparazione</h4>
                    <ol>
                      {(ricetta.passaggi || []).map(
                        (passaggio, itemIndex) => (
                          <li key={itemIndex}>{passaggio}</li>
                        )
                      )}
                    </ol>

                    {ricetta.segreto_chef && (
                      <>
                        <h4>👨‍🍳 Segreto dello Chef</h4>
                        <p>{ricetta.segreto_chef}</p>
                      </>
                    )}

                    {ricetta.vino && (
                      <>
                        <h4>🍷 Abbinamento</h4>
                        <p>{ricetta.vino}</p>
                      </>
                    )}

                    {ricetta.impiattamento && (
                      <>
                        <h4>🍽 Impiattamento</h4>
                        <p>{ricetta.impiattamento}</p>
                      </>
                    )}

                    {ricetta.immagine_page_url && (
                      <a
                        href={ricetta.immagine_page_url}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.source}
                      >
                        Fonte fotografia
                      </a>
                    )}

                    {ricetta.domanda_utente && (
                      <p style={styles.question}>
                        {ricetta.domanda_utente}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f5f5",
    padding: "32px 16px",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    color: "#222",
  },

  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },

  header: {
    textAlign: "center",
    marginBottom: "28px",
  },

  title: {
    margin: 0,
    fontSize: "42px",
    fontWeight: 800,
  },

  subtitle: {
    marginTop: "8px",
    color: "#666",
    fontSize: "18px",
  },

  card: {
    background: "#fff",
    borderRadius: "18px",
    padding: "24px",
    boxShadow: "0 5px 25px rgba(0,0,0,.08)",
    marginBottom: "32px",
  },

  label: {
    display: "block",
    fontWeight: 700,
    marginBottom: "8px",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "14px",
    fontSize: "16px",
    outline: "none",
  },

  controls: {
    display: "flex",
    gap: "24px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "18px",
  },

  select: {
    display: "block",
    marginTop: "8px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    background: "#fff",
  },

  checkboxLabel: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    fontWeight: 600,
  },

  button: {
    width: "100%",
    marginTop: "22px",
    padding: "14px 18px",
    border: 0,
    borderRadius: "12px",
    background: "#222",
    color: "#fff",
    fontSize: "17px",
    fontWeight: 700,
    cursor: "pointer",
  },

  error: {
    marginTop: "18px",
    padding: "12px 14px",
    borderRadius: "10px",
    background: "#fff0f0",
    color: "#a00000",
  },

  results: {
    marginTop: "20px",
  },

  resultsTitle: {
    textAlign: "center",
    marginBottom: "22px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "24px",
  },

  recipeCard: {
    background: "#fff",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 5px 25px rgba(0,0,0,.08)",
  },

  image: {
    display: "block",
    width: "100%",
    height: "230px",
    objectFit: "cover",
    background: "#eee",
  },

  noImage: {
    height: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "#eee",
    color: "#666",
    textAlign: "center",
  },

  recipeBody: {
    padding: "20px",
  },

  recipeTitle: {
    marginTop: 0,
    marginBottom: "10px",
    fontSize: "24px",
  },

  meta: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    color: "#666",
    marginBottom: "16px",
  },

  source: {
    display: "inline-block",
    marginTop: "10px",
    color: "#444",
    fontSize: "14px",
  },

  question: {
    marginTop: "18px",
    fontWeight: 600,
  },
};
