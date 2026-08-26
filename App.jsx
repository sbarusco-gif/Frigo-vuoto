import React, { useState, useEffect } from 'react';
import { ChefHat, Plus, Zap, Timer, Trash2, Mic, RotateCcw, X, Lock, Unlock, Globe, Wine, LayoutPanelTop, Heart, Share2, Loader2, ExternalLink } from 'lucide-react';

function App() {
  const [frigo, setFrigo] = useState([]);
  const [input, setInput] = useState('');
  const [ricette, setRicette] = useState([]); 
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('web'); 
  const [isStrict, setStrict] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Configurabile in build/dev tramite VITE_API_URL (vedi .env.example); fallback al backend di default.
  const API_URL = import.meta.env.VITE_API_URL || "https://svuotafrigo-app-1.onrender.com";

  const comuni = ["Pasta", "Uova", "Pollo", "Tonno", "Pomodori", "Zucchine", "Riso", "Latte", "Pane", "Cipolla", "Formaggio"];

  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Dettatura non supportata");
    const rec = new SpeechRecognition();
    rec.lang = 'it-IT';
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    rec.start();
  };

  const aggiungi = (v) => {
    const val = v || input;
    if (val && val.trim()) {
      setFrigo(prev => [...new Set([...prev, val.trim().toLowerCase()])]);
      setInput('');
    }
  };

  const genera = async () => {
    if (frigo.length === 0) return;
    setLoading(true); setRicette([]); setSelectedIdx(0);
    try {
      const r = await fetch(`${API_URL}/genera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista: frigo, mode, strict: isStrict }),
      });
      if (!r.ok) throw new Error(`Server ha risposto ${r.status}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      if (d.ricette) setRicette(d.ricette);
    } catch (e) {
      console.error(e);
      alert("Lo Chef si sta preparando... riprova tra poco.");
    }
    setLoading(false);
  };

  const current = ricette[selectedIdx];

  return (
    <div style={st.page}>
      <nav style={st.nav}>
        <div style={st.navContent}>
          <div style={st.logo}><ChefHat color="#F97316" size={24}/> <span>ChefMind Pro</span></div>
          <button style={st.resetBtn} onClick={() => {setFrigo([]); setRicette([])}}><RotateCcw size={20}/></button>
        </div>
      </nav>

      <main style={st.container}>
        <div style={st.card}>
          <h3 style={st.label}>LA TUA DISPENSA</h3>
          <div style={st.inputGroup}>
            <input style={st.input} value={input} onChange={e=>setInput(e.target.value)} placeholder="Scrivi o detta..." />
            <button onClick={handleVoice} style={{...st.micBtn, background: isListening ? '#EF4444' : '#F1F5F9'}}><Mic size={20} color={isListening ? '#fff' : '#64748B'}/></button>
            <button onClick={() => aggiungi()} style={st.addBtn}><Plus color="#fff"/></button>
          </div>
          <select style={st.select} onChange={(e) => { if(e.target.value) aggiungi(e.target.value); e.target.value = ""; }}>
            <option value="">📋 Tendina Rapida...</option>
            {comuni.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={st.tagGrid}>{frigo.map((i, idx) => <div key={idx} style={st.tag}>{i} <X size={14} onClick={()=>setFrigo(frigo.filter((_,x)=>x!==idx))} style={{cursor:'pointer'}}/></div>)}</div>
          <div style={st.options}>
            <div style={st.modeToggle}>
              <button onClick={()=>setMode('ai')} style={mode === 'ai' ? st.activeMode : st.inactiveMode}>AI</button>
              <button onClick={()=>setMode('web')} style={mode === 'web' ? st.activeMode : st.inactiveMode}>WEB</button>
            </div>
            <button onClick={()=>setStrict(!isStrict)} style={{...st.strictBtn, background: isStrict ? '#0F172A' : '#fff', color: isStrict ? '#fff' : '#0F172A'}}>{isStrict ? <Lock size={14}/> : <Unlock size={14}/>}</button>
          </div>
          <button onClick={genera} disabled={loading || frigo.length === 0} style={st.mainBtn}>{loading ? <Loader2 className="spin"/> : "GENERA RICETTE"}</button>
        </div>

        <div style={st.resultsArea}>
          {loading && <div style={st.loader}>🥘 Sto preparando il tuo menu...</div>}
          {ricette.length > 1 && (
            <div style={st.picker}>
              {ricette.map((r, i) => (<button key={i} onClick={()=>setSelectedIdx(i)} style={selectedIdx === i ? st.pickActive : st.pickInactive}>{i+1}. {r.titolo.substring(0,10)}...</button>))}
            </div>
          )}
          {current && (
            <div style={st.recipeCard}>
              <img src={`https://loremflickr.com/800/600/cooked,food,${current.immagine_keyword}/all`} style={st.recipeImg} alt="food" />
              <div style={{padding: '25px'}}>
                <div style={st.badgeRow}>
                  <div style={st.fonteBadge}><Globe size={12}/> Fonte: {current.fonte}</div>
                  <Share2 size={20} color="#64748B" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Guarda questa ricetta: ${current.titolo}`)}`)} />
                </div>
                <h2 style={st.recipeTitle}>{current.titolo}</h2>
                <div style={st.stats}><span>⏱ {current.tempo}</span> <span>🔥 {current.calorie} kcal</span></div>
                
                <div style={st.dosiBox}>
                   <h3 style={st.subTitle}>Ingredienti e Dosi</h3>
                   {current.ingredienti_con_dosi?.map((ing, i) => <p key={i} style={st.dosiText}>• {ing}</p>)}
                </div>

                {current.ingredienti_mancanti?.length > 0 && !isStrict && (
                  <div style={st.shopBox}>
                    <p style={{fontWeight:800, fontSize:12, marginBottom:10}}>🛒 COMPRA QUELLO CHE MANCA:</p>
                    {current.ingredienti_mancanti.map((m, i) => (
                      <div key={i} style={st.shopItem}>
                        <span style={{fontWeight:700}}>{m}</span>
                        <div style={st.storeBtns}>
                          <button style={{...st.buyBtn, background:'#FF9900'}} onClick={()=>window.open(`https://www.amazon.it/s?k=${encodeURIComponent(m + ' alimentari')}`)}>Amazon</button>
                          <button style={{...st.buyBtn, background:'#004899'}} onClick={()=>window.open(`https://www.carrefour.it/search?q=${encodeURIComponent(m)}`)}>Carrefour</button>
                          <button style={{...st.buyBtn, background:'#f2ca00', color:'#000'}} onClick={()=>window.open(`https://www.esselungaacasa.it/ecommerce/nav/search/prodotti.html?searchTerm=${encodeURIComponent(m)}`)}>Esselunga</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <h3 style={st.subTitle}>Istruzioni</h3>
                {current.passaggi?.map((p,i)=>(<p key={i} style={st.step}><strong>{i+1}.</strong> {p}</p>))}
                <div style={st.valueBox}><Wine size={16} color="#F97316"/> <strong>Vino:</strong> {current.vino}</div>
                <div style={st.valueBox}><LayoutPanelTop size={16} color="#F97316"/> <strong>Impiattamento:</strong> {current.impiattamento}</div>
                <div style={st.secret}>💡 <strong>Segreto Chef:</strong> {current.segreto_chef}</div>
              </div>
            </div>
          )}
        </div>
      </main>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const st = {
  page: { backgroundColor: '#F8FAFC', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  nav: { backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0', padding: '15px 20px', position:'sticky', top:0, zIndex:100 },
  navContent: { maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems:'center' },
  logo: { display:'flex', alignItems:'center', gap:8, fontWeight:900, fontSize:18, color:'#0F172A' },
  resetBtn: { background:'none', border:'none', cursor:'pointer', color:'#64748B' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '15px' },
  layout: { display: 'flex', flexDirection: 'column', gap: 20 }, 
  card: { background:'#fff', padding:20, borderRadius:25, boxShadow:'0 10px 30px rgba(0,0,0,0.05)', border:'1px solid #F1F5F9', marginBottom: 5 },
  label: { fontSize: 10, fontWeight: 900, color: '#94A3B8', marginBottom: 15, letterSpacing: 1 },
  inputGroup: { display:'flex', gap:8, marginBottom:12 },
  input: { flex:1, padding:12, borderRadius:15, border:'1px solid #E2E8F0', outline:'none', fontSize:16, background:'#F8FAFC' },
  micBtn: { width: 50, borderRadius: 12, border: 'none', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'#F1F5F9' },
  addBtn: { background:'#0F172A', border:'none', borderRadius:12, width:55, cursor:'pointer' },
  select: { width:'100%', padding:12, borderRadius:15, border:'1px solid #E2E8F0', marginBottom:15, background:'#fff', fontSize:14 },
  tagGrid: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:15, minHeight: 40 },
  tag: { background:'#F1F5F9', padding:'6px 12px', borderRadius:10, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:5 },
  options: { display:'flex', gap:10, marginBottom:15 },
  modeToggle: { display:'flex', background:'#F1F5F9', padding:3, borderRadius:10, flex:1 },
  activeMode: { flex:1, background:'#fff', border:'none', padding:6, borderRadius:8, fontWeight:800, fontSize:12, boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
  inactiveMode: { flex:1, background:'none', border:'none', padding:6, color:'#64748B', fontSize:12, cursor:'pointer' },
  strictBtn: { border:'1px solid #E2E8F0', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 10px' },
  mainBtn: { width:'100%', padding:18, background:'#F97316', color:'#fff', border:'none', borderRadius:20, fontSize:16, fontWeight:900, cursor:'pointer' },
  picker: { display:'flex', gap:8, marginBottom:15, overflowX:'auto', paddingBottom:5 },
  pickActive: { background:'#0F172A', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, fontWeight:800, fontSize:12, whiteSpace:'nowrap' },
  pickInactive: { background:'#fff', color:'#64748B', border:'1px solid #E2E8F0', padding:'10px 20px', borderRadius:10, fontSize:12, whiteSpace:'nowrap' },
  recipeCard: { background:'#fff', borderRadius:35, overflow:'hidden', boxShadow:'0 15px 40px rgba(0,0,0,0.06)' },
  recipeImg: { width:'100%', height:260, objectFit:'cover', background:'#eee' },
  badgeRow: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  fonteBadge: { background:'#F1F5F9', color:'#64748B', padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', gap:5, marginBottom:10 },
  recipeTitle: { fontSize:28, fontWeight:900, marginBottom:10, lineHeight:1.1 },
  stats: { display:'flex', gap:20, color:'#64748B', fontWeight:700, marginBottom:20, fontSize:14 },
  dosiBox: { background:'#F8FAFC', padding:15, borderRadius:15, marginBottom:20, border:'1px solid #E2E8F0' },
  dosiText: { fontSize:14, marginBottom:5, color:'#334155' },
  step: { marginBottom:12, lineHeight:1.6, fontSize:16, color:'#334155' },
  subTitle: { fontSize:18, fontWeight:900, marginBottom:15 },
  valueBox: { marginTop:10, padding:15, background:'#F8FAFC', borderRadius:12, fontSize:14, border:'1px solid #E2E8F0', marginBottom:5 },
  secret: { marginTop:25, padding:20, background:'#F8FAFC', borderRadius:20, borderLeft:'6px solid #F97316', fontSize:14 },
  shopBox: { background:'#FFF7ED', padding:20, borderRadius:25, border:'1px dashed #FED7AA', marginBottom:20 },
  shopItem: { background:'#fff', padding:'15px', borderRadius:12, marginBottom:10, border:'1px solid #F1F5F9' },
  storeBtns: { display:'flex', gap:5, marginTop:10 },
  buyBtn: { flex:1, border:'none', padding:8, borderRadius:6, color:'#fff', fontSize:10, fontWeight:800 },
  loader: { textAlign:'center', marginTop:50, fontWeight:800, color:'#F97316' }
};

export default App;
