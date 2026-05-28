import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';
import PatternPreview from '../components/ui/PatternPreview';

const PATTERNS = ['ROW','COLUMN','DIAGONAL','FOUR_CORNERS','POSTAGE_STAMP','COVERALL'] as const;
type Pat = typeof PATTERNS[number];

const COLORS = ['#f5a623','#60a5fa','#a78bfa','#34d399','#f87171','#fb923c','#e879f9'];

interface Room { code:string; state:string; playerCount:number; calledNumbers:number[]; pattern:string; }

export default function OwnerDashboard() {
  const { token, houseName, clearAll } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();

  const [rooms] = useState<Room[]>([]);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPattern, setNewPattern] = useState<Pat>('ROW');
  const [newInterval, setNewInterval] = useState(6);
  const [accentColor, setAccentColor] = useState('#f5a623');
  const [loading, setLoading] = useState(true);

  // Fetch owner's rooms
  useEffect(() => {
    if (!token) return;
    // We'll reload rooms on mount; for now we store rooms in state
    setLoading(false);
  }, [token]);

  async function createRoom() {
    if (!token) return;
    setCreating(true);
    try {
      const room = await api.createRoom(token, newPattern, newInterval);
      toast(`Room ${room.code} created!`, 'success');
      setShowCreate(false);
      nav(`/owner/room/${room.code}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create room', 'error');
    } finally { setCreating(false); }
  }

  const STATUS_COLOR: Record<string,string> = { WAITING:'var(--dim)', PLAYING:'#34d399', PAUSED:'#fbbf24', FINISHED:'var(--muted)' };

  return (
    <Shell>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <p style={{ color:'var(--dim)', fontSize:'0.875rem', fontWeight:600 }}>House Owner Dashboard</p>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2rem' }}>{houseName ?? 'My House'} 🏠</h1>
          </div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Room</button>
            <button className="btn-ghost" onClick={() => { clearAll(); nav('/'); }}>Sign Out</button>
          </div>
        </div>

        {/* Create room modal */}
        {showCreate && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
            <div className="card" style={{ width:'100%', maxWidth:520, padding:'2rem' }}>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.25rem', marginBottom:'1.5rem' }}>🎱 Create New Room</h2>

              <div style={{ marginBottom:'1.25rem' }}>
                <label className="input-label">Win Pattern</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:'1rem' }}>
                  {PATTERNS.map(p => (
                    <button key={p} onClick={() => setNewPattern(p)} style={{
                      padding:'0.5rem', borderRadius:8, border:`1.5px solid ${newPattern===p ? 'var(--gold)' : 'var(--border)'}`,
                      background: newPattern===p ? 'var(--gold-dim)' : 'var(--surface2)',
                      color: newPattern===p ? 'var(--gold)' : 'var(--dim)',
                      fontWeight:700, fontSize:'0.75rem', cursor:'pointer', transition:'all 150ms',
                    }}>{p.replace(/_/g,' ')}</button>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <PatternPreview pattern={newPattern} />
                </div>
              </div>

              <div style={{ marginBottom:'1.25rem' }}>
                <label className="input-label">Call Interval (seconds)</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {[4,6,8,10,15].map(s => (
                    <button key={s} onClick={() => setNewInterval(s)} style={{
                      padding:'0.4rem 0.875rem', borderRadius:8, border:`1.5px solid ${newInterval===s ? 'var(--gold)' : 'var(--border)'}`,
                      background: newInterval===s ? 'var(--gold-dim)' : 'transparent',
                      color: newInterval===s ? 'var(--gold)' : 'var(--dim)',
                      fontWeight:700, fontSize:'0.875rem', cursor:'pointer',
                    }}>{s}s</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:'1.5rem' }}>
                <label className="input-label">Room Accent Color</label>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setAccentColor(c)} style={{
                      width:32, height:32, borderRadius:'50%', background:c, border:`3px solid ${accentColor===c ? 'var(--text)' : 'transparent'}`,
                      cursor:'pointer', transition:'border 150ms',
                    }} />
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button className="btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-primary" onClick={createRoom} disabled={creating}>
                  {creating ? 'Creating…' : '🎱 Create Room'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rooms list */}
        {loading ? (
          <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:140, borderRadius:16 }} />)}
          </div>
        ) : rooms.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:'4rem 2rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🎱</div>
            <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.2rem', marginBottom:'0.5rem' }}>No rooms yet</h3>
            <p style={{ color:'var(--dim)', fontSize:'0.9rem', marginBottom:'1.5rem' }}>Create your first room to start calling games</p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create Room</button>
          </div>
        ) : (
          <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))' }}>
            {rooms.map((r) => (
              <div key={r.code} className="card-hover" onClick={() => nav(`/owner/room/${r.code}`)} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <p style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'1.2rem', letterSpacing:1 }}>{r.code}</p>
                  <span style={{ fontWeight:700, fontSize:'0.8rem', color: STATUS_COLOR[r.state] }}>{r.state}</span>
                </div>
                <div style={{ marginTop:'0.75rem', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.75rem', color:'var(--dim)' }}>👥 {r.playerCount}</span>
                  <span style={{ fontSize:'0.75rem', color:'var(--dim)' }}>🎱 {r.calledNumbers.length}/75</span>
                  <span style={{ fontSize:'0.75rem', color:'var(--dim)' }}>{r.pattern.replace(/_/g,' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
