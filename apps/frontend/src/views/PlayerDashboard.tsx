import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type GameHistoryEntry } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Shell } from '../components/layout/Shell';

const RESULT_COLOR: Record<string, string> = { WON:'#34d399', LOST:'#f87171', PLAYING:'#60a5fa' };

export default function PlayerDashboard() {
  const { token, nickname, clearAll } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.getMyHistory(token).then(setHistory).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  function joinRoom() {
    if (code.trim().length < 4) return;
    nav(`/room/${code.trim().toUpperCase()}`);
  }

  const won = history.filter(h => h.result === 'WON').length;

  return (
    <Shell>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <p style={{ color:'var(--dim)', fontSize:'0.875rem', fontWeight:600 }}>Welcome back,</p>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2rem', color:'var(--text)' }}>{nickname} 🎮</h1>
          </div>
          <button className="btn-ghost" onClick={() => { clearAll(); nav('/'); }}>Sign Out</button>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
          {[
            { label:'Games Played', value: history.length },
            { label:'Games Won',    value: won, highlight: true },
            { label:'Win Rate',     value: history.length > 0 ? `${Math.round(won/history.length*100)}%` : '—' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-value" style={ s.highlight && won > 0 ? { color:'var(--gold)' } : undefined }>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Quick join */}
        <div className="card" style={{ marginBottom:'2rem' }}>
          <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'1rem' }}>🎯 Join a Game</h2>
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            <input className="input" placeholder="Room code (e.g. BINGO-7F3K)" value={code}
              style={{ flex:1, minWidth:200, letterSpacing:1, fontWeight:700 }}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()} />
            <button className="btn-primary" onClick={joinRoom} disabled={code.trim().length < 4}>Join Room →</button>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'1rem' }}>📋 Game History</h2>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:56, borderRadius:10 }} />)}
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem 0', color:'var(--muted)' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🎱</div>
              <p style={{ fontWeight:600 }}>No games yet</p>
              <p style={{ fontSize:'0.875rem', marginTop:4 }}>Join a room above to get started</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'var(--surface2)', borderRadius:10, padding:'0.875rem 1rem',
                }}>
                  <div>
                    <p style={{ fontWeight:700, fontFamily:'Outfit,sans-serif', letterSpacing:0.5 }}>{h.roomCode}</p>
                    <p style={{ fontSize:'0.75rem', color:'var(--dim)', marginTop:2 }}>{h.houseName} · {h.pattern.replace(/_/g,' ')} · {h.calledCount} balls</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontWeight:800, color: RESULT_COLOR[h.result] ?? 'var(--dim)', fontSize:'0.875rem' }}>{h.result}</span>
                    <p style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:2 }}>{new Date(h.ts).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
