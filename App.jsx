import React, { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://frigo-vuoto-1.onrender.com";

export default function App() {
  const [ingredienti, setIngredienti] = useState("");
  const [strict, setStrict] = useState(false);
  const [ricette, setRicette] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState("");

  async function generaRicette() {
    const lista = ingredienti.split(",").map(x => x.trim()).filter(Boolean);
    if (!lista.length) { setErrore("Inserisci almeno un ingrediente."); return; }

    setLoading(true); setErrore(""); setRicette([]);
    try {
      const res = await fetch(`${API_URL}/genera`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({lista, mode: "ai", strict})
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `Errore server ${res.status}`);
      if (!Array.isArray(data?.ricette)) throw new Error("Risposta del server non valida.");
      setRicette(data.ricette);
    } catch (e) {
      setErrore(e?.message || "Impossibile collegarsi al server ChefMind Pro.");
    } finally { setLoading(false); }
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>ChefMind Pro</h1>
          <p style={s.subtitle}>Cosa posso preparare con quello che ho in frigo?</p>
        </header>

        <section style={s.inputCard}>
          <label style={s.label}>Ingredienti disponibili</label>
          <textarea value={ingredienti} onChange={e => setIngredienti(e.target.value)}
            placeholder="Es. pollo, riso, curry, cipolla" rows={4} style={s.textarea}/>
          <label style={s.check}>
            <input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)}/>
            Usa esclusivamente gli ingredienti disponibili
          </label>
          <button onClick={generaRicette} disabled={loading} style={s.button}>
            {loading ? "Sto creando le ricette..." : "Genera 3 ricette"}
          </button>
          {errore && <div style={s.error}>{errore}</div>}
        </section>

        {ricette.length > 0 && <section>
          <h2 style={s.sectionTitle}>Le tue ricette</h2>
          <div style={s.grid}>
            {ricette.map((r, i) => (
              <article key={`${r.titolo}-${i}`} style={s.card}>
                {r.immagine_url ? <img src={r.immagine_url} alt={r.titolo} style={s.image}
                  onError={e => {e.currentTarget.style.display="none";}}/> :
                  <div style={s.noImage}>Immagine non disponibile</div>}
                <div style={s.body}>
                  <h3 style={s.recipeTitle}>{r.titolo}</h3>
                  <div style={s.meta}><span>⏱ {r.tempo}</span><span>🔥 {r.calorie} kcal</span></div>
                  <h4>Ingredienti</h4>
                  <ul>{(r.ingredienti_con_dosi || []).map((x,j)=><li key={j}>{x}</li>)}</ul>
                  {r.ingredienti_mancanti?.length > 0 && <>
                    <h4>Da aggiungere</h4>
                    <ul>{r.ingredienti_mancanti.map((x,j)=><li key={j}>{x}</li>)}</ul>
                  </>}
                  <h4>Preparazione</h4>
                  <ol>{(r.passaggi || []).map((x,j)=><li key={j}>{x}</li>)}</ol>
                  {r.segreto_chef && <><h4>👨‍🍳 Segreto dello Chef</h4><p>{r.segreto_chef}</p></>}
                  {r.vino && <><h4>🍷 Vino</h4><p>{r.vino}</p></>}
                  {r.impiattamento && <><h4>🍽 Impiattamento</h4><p>{r.impiattamento}</p></>}
                  {r.immagine_page_url && <a href={r.immagine_page_url} target="_blank" rel="noreferrer">Fonte fotografia</a>}
                  {r.domanda_utente && <p style={s.question}>{r.domanda_utente}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>}
      </div>
    </main>
  );
}

const s = {
  page:{minHeight:"100vh",background:"#f5f5f5",padding:"32px 16px",fontFamily:"Inter,system-ui,sans-serif",color:"#222"},
  container:{maxWidth:1200,margin:"0 auto"}, header:{textAlign:"center",marginBottom:28},
  title:{margin:0,fontSize:42,fontWeight:800}, subtitle:{color:"#666",fontSize:18},
  inputCard:{background:"#fff",borderRadius:18,padding:24,boxShadow:"0 5px 25px rgba(0,0,0,.08)",marginBottom:32},
  label:{display:"block",fontWeight:700,marginBottom:8},
  textarea:{width:"100%",boxSizing:"border-box",border:"1px solid #ddd",borderRadius:12,padding:14,fontSize:16},
  check:{display:"flex",gap:8,alignItems:"center",marginTop:16,fontWeight:600},
  button:{width:"100%",marginTop:20,padding:"14px 18px",border:0,borderRadius:12,background:"#222",color:"#fff",fontSize:17,fontWeight:700,cursor:"pointer"},
  error:{marginTop:16,padding:12,borderRadius:10,background:"#fff0f0",color:"#a00000"},
  sectionTitle:{textAlign:"center",marginBottom:20}, grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24},
  card:{background:"#fff",borderRadius:18,overflow:"hidden",boxShadow:"0 5px 25px rgba(0,0,0,.08)"},
  image:{width:"100%",height:230,objectFit:"cover",display:"block"}, noImage:{height:120,display:"flex",alignItems:"center",justifyContent:"center",background:"#eee",color:"#666"},
  body:{padding:20}, recipeTitle:{marginTop:0,fontSize:24}, meta:{display:"flex",gap:16,color:"#666",marginBottom:16},
  question:{marginTop:18,fontWeight:600}
};
