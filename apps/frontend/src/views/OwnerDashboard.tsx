import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type InviteInfo } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';
import PatternPreview from '../components/ui/PatternPreview';

const PATTERNS = ['ROW','COLUMN','DIAGONAL','FOUR_CORNERS','POSTAGE_STAMP','COVERALL'] as const;
type Pat = typeof PATTERNS[number];

const COLORS = ['#f5a623','#60a5fa','#a78bfa','#34d399','#f87171','#fb923c','#e879f9'];

interface Room { code:string; state:string; playerCount:number; calledNumbers:number[]; pattern:string; }

type Tab = 'rooms' | 'operators';

export default function OwnerDashboard() {
  const { token, houseName, clearAll } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();

  const [tab, setTab]               = useState<Tab>('rooms');
  const [rooms]                     = useState<Room[]>([]);
  const [creating, setCreating]     = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPattern, setNewPattern] = useState<Pat>('ROW');
  const [newInterval, setNewInterval] = useState(6);
  const [accentColor, setAccentColor] = useState('#f5a623');
  const [loading, setLoading]       = useState(true);

  // Operators
  const [operators, setOperators]       = useState<{ uuid:string; username:string; phone:string; createdAt:string }[]>([]);
  const [opsLoading, setOpsLoading]     = useState(false);
  const [showInvite, setShowInvite]     = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting]         = useState(false);
  const [latestInvite, setLatestInvite] = useState<InviteInfo | null>(null);
  const [copied, setCopied]             = useState(false);

  useEffect(() => { if (!token) return; setLoading(false); }, [token]);

  useEffect(() => {
    if (tab !== 'operators' || !token) return;
    setOpsLoading(true);
    api.getMyOperators(token).then(setOperators).catch(() => {}).finally(() => setOpsLoading(false));
  }, [tab, token]);

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

  async function sendInvite() {
    if (!inviteUsername.trim() || !token) { toast('Username required', 'error'); return; }
    setInviting(true);
    try {
      const data = await api.inviteOperator(token, inviteUsername.trim());
      setLatestInvite(data);
      setInviteUsername('');
      toast(`Invite created for @${data.username}`, 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create invite', 'error');
    } finally { setInviting(false); }
  }

  async function removeOperator(username: string) {
    if (!token) return;
    try {
      await api.removeOperator(token, username);
      setOperators(ops => ops.filter(o => o.username !== username));
      toast(`@${username} removed`, 'warning');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  }

  function copyInvite() {
    if (!latestInvite) return;
    navigator.clipboard.writeText(latestInvite.acceptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const STATUS_COLOR: Record<string,string> = { WAITING:'var(--dim)', PLAYING:'#34d399', PAUSED:'#fbbf24', FINISHED:'var(--muted)' };

  return (
    <Shell>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <p style={{ color:'var(--dim)', fontSize:'0.875rem', fontWeight:600 }}>House Owner Dashboard</p>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2rem' }}>{houseName ?? 'My House'} 🏠</h1>
          </div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Room</button>
            <button className="btn-ghost" onClick={() => { clearAll(); nav('/'); }}>Sign Out</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:4, marginBottom:'2rem', width:'fit-content' }}>
          {([['rooms','🎱 Rooms'],['operators','👥 Operators']] as [Tab,string][]).map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding:'0.5rem 1.25rem', borderRadius:8, border:'none', cursor:'pointer',
              background: tab===id ? 'var(--gold)' : 'transparent',
              color: tab===id ? 'var(--bg)' : 'var(--dim)',
              fontWeight:700, fontSize:'0.85rem', fontFamily:'Outfit,sans-serif', transition:'all 150ms',
            }}>{label}</button>
          ))}
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
                      width:32, height:32, borderRadius:'50%', background:c,
                      border:`3px solid ${accentColor===c ? 'var(--text)' : 'transparent'}`,
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

        {/* ── ROOMS TAB ──────────────────────────────────────────────── */}
        {tab === 'rooms' && (
          loading ? (
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
          )
        )}

        {/* ── OPERATORS TAB ──────────────────────────────────────────── */}
        {tab === 'operators' && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.5rem' }}>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800 }}>Operators ({operators.length})</h2>
              <button className="btn-primary" style={{ fontSize:'0.85rem', padding:'0.5rem 1rem' }} onClick={() => setShowInvite(!showInvite)}>
                {showInvite ? 'Cancel' : '+ Invite Operator'}
              </button>
            </div>

            {/* Invite form */}
            {showInvite && (
              <div style={{ background:'var(--surface2)', borderRadius:12, padding:'1.25rem', marginBottom:'1.25rem', border:'1px solid var(--border)' }}>
                <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:'0.95rem', marginBottom:'0.75rem' }}>
                  🔗 Generate Operator Invite Link
                </h3>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'stretch', marginBottom:'0.75rem' }}>
                  <input className="input" placeholder="Username for the operator" value={inviteUsername}
                    onChange={e => setInviteUsername(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && sendInvite()}
                    style={{ flex:1 }} />
                  <button className="btn-primary" onClick={sendInvite} disabled={inviting}>
                    {inviting ? '…' : 'Generate'}
                  </button>
                </div>
                <p style={{ fontSize:'0.75rem', color:'var(--muted)' }}>
                  The operator follows the link, sets their password and phone, and is added to your house.
                </p>

                {/* Latest invite */}
                {latestInvite && (
                  <div style={{ marginTop:'1rem', background:'rgba(52,211,153,0.08)', border:'1px solid #34d39933', borderRadius:10, padding:'0.875rem' }}>
                    <p style={{ fontSize:'0.78rem', color:'var(--dim)', marginBottom:'0.5rem' }}>
                      Invite for <strong>@{latestInvite.username}</strong> — expires {new Date(latestInvite.expiresAt).toLocaleString()}
                    </p>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                      <code style={{ fontSize:'0.72rem', wordBreak:'break-all', color:'var(--text)', background:'var(--surface)', padding:'0.375rem 0.5rem', borderRadius:6, flex:1 }}>
                        {latestInvite.acceptUrl}
                      </code>
                      <button className="btn-outline" style={{ fontSize:'0.75rem', padding:'0.35rem 0.75rem', whiteSpace:'nowrap' }} onClick={copyInvite}>
                        {copied ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Operators list */}
            {opsLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {[1,2].map(i => <div key={i} className="skeleton" style={{ height:54, borderRadius:10 }} />)}
              </div>
            ) : operators.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2.5rem 0', color:'var(--muted)' }}>
                <p style={{ fontSize:'0.9rem', fontWeight:600, marginBottom:'0.25rem' }}>No operators yet</p>
                <p style={{ fontSize:'0.8rem' }}>Invite one with the button above</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {operators.map(op => (
                  <div key={op.uuid} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    background:'var(--surface2)', borderRadius:10, padding:'0.75rem 1rem', flexWrap:'wrap', gap:'0.5rem',
                  }}>
                    <div>
                      <p style={{ fontWeight:700 }}>@{op.username}</p>
                      <p style={{ fontSize:'0.75rem', color:'var(--dim)' }}>{op.phone} · added {new Date(op.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button className="btn-danger" style={{ fontSize:'0.75rem', padding:'0.3rem 0.625rem' }}
                      onClick={() => removeOperator(op.username)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
