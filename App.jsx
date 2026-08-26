import React, { useState } from 'react';
import {
  ChefHat, Plus, RotateCcw, Mic, X, Lock, Unlock,
  Globe, Wine, LayoutPanelTop, Share2, Loader2
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function App() {
  const [frigo, setFrigo] = useState([]);
  const [input, setInput] = useState('');
  const [ricette, setRicette] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('ai');
  const [isStrict, setStrict] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');

  const comuni = [
    'Pasta', 'Uova', 'Pollo', 'Tonno', 'Pomodori',
    'Zucchine', 'Riso', 'Latte', 'Pane', 'Cipolla', 'Formaggio'
  ];

  const handleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('La dettatura vocale non è supportata da questo browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'it-IT';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e) => {
      setInput(e.results[0][0].transcript);
    };

    rec.start();
  };

  const aggiungi = (valore = input) => {
    const val = String(valore || '').trim().toLowerCase();
    if (!val) return;

    setFrigo(prev => [...new Set([...prev, val])]);
    setInput('');
  };

  const rimuovi = (idx) => {
    setFrigo(prev => prev.filter((_, i) => i !== idx));
  };

  const resetApp = () => {
    setFrigo([]);
    setInput('');
    setRicette([]);
    setSelectedIdx(0);
    setStrict(false);
    setMode('ai');
    setError('');
  };

  const genera = async () => {
    if (!frigo.length || loading) return;

    if (!API_URL) {
      setError('Configurazione mancante: imposta VITE_API_URL su Netlify.');
      return;
    }

    setLoading(true);
    setError('');
    setRicette([]);
    setSelectedIdx(0);

    try {
      const response = await fetch(`${API_URL}/genera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lista: frigo,
          mode,
          strict: isStrict
        })
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error(`Risposta non valida dal server (${response.status}).`);
      }

      if (!response.ok) {
        throw new Error(data.detail || data.error || `Server HTTP ${response.status}`);
      }

      if (!Array.isArray(data.ricette)) {
        throw new Error('Il server non ha restituito un elenco di ricette valido.');
      }

      setRicette(data.ricette);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Errore durante la generazione delle ricette.');
    } finally {
      setLoading(false);
    }
  };

  const current = ricette[selectedIdx];

  const shareRecipe = async () => {
    if (!current) return;

    const text = `Guarda questa ricetta: ${current.titolo}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: current.titolo, text });
        return;
      } catch {
        // L'utente può aver annullato la condivisione.
      }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const imageKeyword = encodeURIComponent(
    current?.immagine_keyword || 'italian-food'
  );

  return (
    <div style={st.page}>
      <nav style={st.nav}>
        <div style={st.navContent}>
          <div style={st.logo}>
            <ChefHat color="#F97316" size={24} />
            <span>ChefMind Pro</span>
          </div>

          <button
            type="button"
            aria-label="Azzera applicazione"
            title="Azzera"
            style={st.resetBtn}
            onClick={resetApp}
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </nav>

      <main style={st.container}>
        <div style={st.card}>
          <h3 style={st.label}>LA TUA DISPENSA</h3>

          <div style={st.inputGroup}>
            <input
              style={st.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') aggiungi();
              }}
              placeholder="Scrivi o detta..."
              aria-label="Ingrediente"
            />

            <button
              type="button"
              onClick={handleVoice}
              style={{
                ...st.micBtn,
                background: isListening ? '#EF4444' : '#F1F5F9'
              }}
              aria-label="Dettatura vocale"
              title="Dettatura vocale"
            >
              <Mic size={20} color={isListening ? '#fff' : '#64748B'} />
            </button>

            <button
              type="button"
              onClick={() => aggiungi()}
              style={st.addBtn}
              aria-label="Aggiungi ingrediente"
              title="Aggiungi"
            >
              <Plus color="#fff" />
            </button>
          </div>

          <select
            style={st.select}
            defaultValue=""
            onChange={e => {
              if (e.target.value) aggiungi(e.target.value);
              e.target.value = '';
            }}
            aria-label="Ingredienti rapidi"
          >
            <option value="">📋 Tendina Rapida...</option>
            {comuni.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div style={st.tagGrid}>
            {frigo.map((ingrediente, idx) => (
              <div key={`${ingrediente}-${idx}`} style={st.tag}>
                <span>{ingrediente}</span>
                <button
                  type="button"
                  onClick={() => rimuovi(idx)}
                  style={st.tagRemove}
                  aria-label={`Rimuovi ${ingrediente}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div style={st.options}>
            <div style={st.modeToggle}>
              <button
                type="button"
                onClick={() => setMode('ai')}
                style={mode === 'ai' ? st.activeMode : st.inactiveMode}
              >
                AI
              </button>
              <button
                type="button"
                onClick={() => setMode('web')}
                style={mode === 'web' ? st.activeMode : st.inactiveMode}
              >
                WEB
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStrict(prev => !prev)}
              style={{
                ...st.strictBtn,
                background: isStrict ? '#0F172A' : '#fff',
                color: isStrict ? '#fff' : '#0F172A'
              }}
              title={isStrict ? 'Modalità rigorosa attiva' : 'Modalità libera'}
              aria-label="Attiva/disattiva modalità rigorosa"
            >
              {isStrict ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>

          <button
            type="button"
            onClick={genera}
            disabled={loading || frigo.length === 0}
            style={{
              ...st.mainBtn,
              opacity: loading || frigo.length === 0 ? 0.6 : 1,
              cursor: loading || frigo.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? <Loader2 className="spin" /> : 'GENERA RICETTE'}
          </button>

          {error && <div style={st.errorBox}>{error}</div>}
        </div>

        <div style={st.resultsArea}>
          {loading && (
            <div style={st.loader}>🥘 Sto preparando il tuo menu...</div>
          )}

          {ricette.length > 1 && (
            <div style={st.picker}>
              {ricette.map((ricetta, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  style={
                    selectedIdx === i ? st.pickActive : st.pickInactive
                  }
                >
                  {i + 1}. {(ricetta.titolo || 'Ricetta').substring(0, 18)}
                  {(ricetta.titolo || '').length > 18 ? '...' : ''}
                </button>
              ))}
            </div>
          )}

          {current && (
            <div style={st.recipeCard}>
              <img
                src={`https://loremflickr.com/800/600/${imageKeyword}/all`}
                style={st.recipeImg}
                alt={current.titolo || 'Ricetta'}
                onError={e => {
                  e.currentTarget.style.display = 'none';
                }}
              />

              <div style={st.recipeContent}>
                <div style={st.badgeRow}>
                  <div style={st.fonteBadge}>
                    <Globe size={12} />
                    Fonte: {current.fonte || 'ChefMind Pro'}
                  </div>

                  <button
                    type="button"
                    style={st.shareBtn}
                    onClick={shareRecipe}
                    aria-label="Condividi ricetta"
                    title="Condividi"
                  >
                    <Share2 size={20} color="#64748B" />
                  </button>
                </div>

                <h2 style={st.recipeTitle}>
                  {current.titolo || 'Ricetta'}
                </h2>

                <div style={st.stats}>
                  <span>⏱ {current.tempo || '—'}</span>
                  <span>🔥 {current.calorie || '—'} kcal</span>
                </div>

                <div style={st.dosiBox}>
                  <h3 style={st.subTitle}>Ingredienti e Dosi</h3>
                  {(current.ingredienti_con_dosi || []).map((ing, i) => (
                    <p key={i} style={st.dosiText}>• {ing}</p>
                  ))}
                </div>

                {!isStrict &&
                  Array.isArray(current.ingredienti_mancanti) &&
                  current.ingredienti_mancanti.length > 0 && (
                    <div style={st.shopBox}>
                      <p style={st.shopTitle}>
                        🛒 COMPRA QUELLO CHE MANCA:
                      </p>

                      {current.ingredienti_mancanti.map((mancante, i) => {
                        const prodotto = String(mancante || '').trim();
                        if (!prodotto) return null;

                        return (
                          <div key={i} style={st.shopItem}>
                            <span style={{ fontWeight: 700 }}>
                              {prodotto}
                            </span>

                            <div style={st.storeBtns}>
                              <button
                                type="button"
                                style={{ ...st.buyBtn, background: '#FF9900' }}
                                onClick={() =>
                                  window.open(
                                    `https://www.amazon.it/s?k=${encodeURIComponent(prodotto + ' alimentari')}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                  )
                                }
                              >
                                Amazon
                              </button>

                              <button
                                type="button"
                                style={{ ...st.buyBtn, background: '#004899' }}
                                onClick={() =>
                                  window.open(
                                    `https://www.carrefour.it/search?q=${encodeURIComponent(prodotto)}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                  )
                                }
                              >
                                Carrefour
                              </button>

                              <button
                                type="button"
                                style={{
                                  ...st.buyBtn,
                                  background: '#f2ca00',
                                  color: '#000'
                                }}
                                onClick={() =>
                                  window.open(
                                    `https://www.esselungaacasa.it/ecommerce/nav/search/prodotti.html?searchTerm=${encodeURIComponent(prodotto)}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                  )
                                }
                              >
                                Esselunga
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                <h3 style={st.subTitle}>Istruzioni</h3>

                {(current.passaggi || []).map((passaggio, i) => (
                  <p key={i} style={st.step}>
                    <strong>{i + 1}.</strong> {passaggio}
                  </p>
                ))}

                <div style={st.valueBox}>
                  <Wine size={16} color="#F97316" />
                  <strong>Vino:</strong>&nbsp; {current.vino || '—'}
                </div>

                <div style={st.valueBox}>
                  <LayoutPanelTop size={16} color="#F97316" />
                  <strong>Impiattamento:</strong>&nbsp; {current.impiattamento || '—'}
                </div>

                <div style={st.secret}>
                  💡 <strong>Segreto Chef:</strong>{' '}
                  {current.segreto_chef || '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const st = {
  page: { backgroundColor: '#F8FAFC', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  nav: { backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0', padding: '15px 20px', position: 'sticky', top: 0, zIndex: 100 },
  navContent: { maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 18, color: '#0F172A' },
  resetBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '15px' },
  card: { background: '#fff', padding: 20, borderRadius: 25, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #F1F5F9', marginBottom: 5 },
  label: { fontSize: 10, fontWeight: 900, color: '#94A3B8', marginBottom: 15, letterSpacing: 1 },
  inputGroup: { display: 'flex', gap: 8, marginBottom: 12 },
  input: { flex: 1, padding: 12, borderRadius: 15, border: '1px solid #E2E8F0', outline: 'none', fontSize: 16, background: '#F8FAFC' },
  micBtn: { width: 50, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  addBtn: { background: '#0F172A', border: 'none', borderRadius: 12, width: 55, cursor: 'pointer' },
  select: { width: '100%', padding: 12, borderRadius: 15, border: '1px solid #E2E8F0', marginBottom: 15, background: '#fff', fontSize: 14 },
  tagGrid: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 15, minHeight: 40 },
  tag: { background: '#F1F5F9', padding: '6px 8px 6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 },
  tagRemove: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex' },
  options: { display: 'flex', gap: 10, marginBottom: 15 },
  modeToggle: { display: 'flex', background: '#F1F5F9', padding: 3, borderRadius: 10, flex: 1 },
  activeMode: { flex: 1, background: '#fff', border: 'none', padding: 6, borderRadius: 8, fontWeight: 800, fontSize: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer' },
  inactiveMode: { flex: 1, background: 'none', border: 'none', padding: 6, color: '#64748B', fontSize: 12, cursor: 'pointer' },
  strictBtn: { border: '1px solid #E2E8F0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' },
  mainBtn: { width: '100%', padding: 18, background: '#F97316', color: '#fff', border: 'none', borderRadius: 20, fontSize: 16, fontWeight: 900 },
  errorBox: { marginTop: 15, padding: 12, background: '#FEF2F2', color: '#991B1B', borderRadius: 12, fontSize: 13 },
  resultsArea: { marginTop: 15 },
  picker: { display: 'flex', gap: 8, marginBottom: 15, overflowX: 'auto', paddingBottom: 5 },
  pickActive: { background: '#0F172A', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' },
  pickInactive: { background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', padding: '10px 20px', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' },
  recipeCard: { background: '#fff', borderRadius: 35, overflow: 'hidden', boxShadow: '0 15px 40px rgba(0,0,0,0.06)' },
  recipeImg: { width: '100%', height: 260, objectFit: 'cover', background: '#eee' },
  recipeContent: { padding: 25 },
  badgeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fonteBadge: { background: '#F1F5F9', color: '#64748B', padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 },
  shareBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 },
  recipeTitle: { fontSize: 28, fontWeight: 900, marginBottom: 10, lineHeight: 1.1 },
  stats: { display: 'flex', gap: 20, color: '#64748B', fontWeight: 700, marginBottom: 20, fontSize: 14 },
  dosiBox: { background: '#F8FAFC', padding: 15, borderRadius: 15, marginBottom: 20, border: '1px solid #E2E8F0' },
  dosiText: { fontSize: 14, marginBottom: 5, color: '#334155' },
  step: { marginBottom: 12, lineHeight: 1.6, fontSize: 16, color: '#334155' },
  subTitle: { fontSize: 18, fontWeight: 900, marginBottom: 15 },
  valueBox: { marginTop: 10, padding: 15, background: '#F8FAFC', borderRadius: 12, fontSize: 14, border: '1px solid #E2E8F0', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 },
  secret: { marginTop: 25, padding: 20, background: '#F8FAFC', borderRadius: 20, borderLeft: '6px solid #F97316', fontSize: 14 },
  shopBox: { background: '#FFF7ED', padding: 20, borderRadius: 25, border: '1px dashed #FED7AA', marginBottom: 20 },
  shopTitle: { fontWeight: 800, fontSize: 12, marginBottom: 10 },
  shopItem: { background: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, border: '1px solid #F1F5F9' },
  storeBtns: { display: 'flex', gap: 5, marginTop: 10 },
  buyBtn: { flex: 1, border: 'none', padding: 8, borderRadius: 6, color: '#fff', fontSize: 10, fontWeight: 800, cursor: 'pointer' },
  loader: { textAlign: 'center', marginTop: 50, fontWeight: 800, color: '#F97316' }
};

export default App;
