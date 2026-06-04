import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type AdminStats, type HouseInfo } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';

type View = 'stats' | 'houses' | 'create-owner';

export default function AdminDashboard() {
  const { token, clearAll } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();

  const [view, setView]       = useState<View>('stats');
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [houses, setHouses]   = useState<HouseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  // ── Create owner form state ──────────────────────────────────────
  const [coUsername,  setCoUsername]  = useState('');
  const [coPassword,  setCoPassword]  = useState('');
  const [coHouseName, setCoHouseName] = useState('');
  const [coPhone,     setCoPhone]     = useState('');
  const [coLoading,   setCoLoading]   = useState(false);
  const coPhoneValid = /^9[0-9]{8}$/.test(coPhone);


  async function load() {
    if (!token) return;
    try {
      const [s, h] = await Promise.all([api.getAdminStats(token), api.getAdminHouses(token)]);
      setStats(s); setHouses(h);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to load', 'error');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function createOwner() {
    if (!coUsername || !coPassword || !coHouseName || !coPhone) { toast('All fields required', 'error'); return; }
    if (!coPhoneValid) { toast('Phone must be 9 digits starting with 9', 'error'); return; }
    if (!token) return;
    setCoLoading(true);
    try {
      const data = await api.createOwner(token, coUsername, coPassword, coHouseName, coPhone);
      toast(`✓ House "${data.houseName}" created for @${data.username}`, 'success');
      setCoUsername(''); setCoPassword(''); setCoHouseName(''); setCoPhone('');
      setView('houses');
      await load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create owner', 'error');
    } finally { setCoLoading(false); }
  }

  async function toggleSuspend(house: HouseInfo) {
    if (!token) return;
    try {
      await api.suspendHouse(token, house.houseId, !house.suspended);
      toast(`${house.houseName} ${house.suspended ? 'reactivated' : 'suspended'}`, house.suspended ? 'success' : 'warning');
      setHouses(h => h.map(x => x.houseId === house.houseId ? { ...x, suspended: !x.suspended } : x));
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
  }


  const filtered = houses.filter(h =>
    h.houseName.toLowerCase().includes(search.toLowerCase()) ||
    h.ownerUsername.toLowerCase().includes(search.toLowerCase())
  );

  const NAV_TABS: { id: View; label: string; icon: string }[] = [
    { id: 'stats',         label: 'Overview',     icon: '📊' },
    { id: 'houses',        label: 'Houses',        icon: '🏠' },
    { id: 'create-owner',  label: 'Add Owner',     icon: '➕' },
  ];

  return (
    <Shell>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <p style={{ color:'var(--dim)', fontSize:'0.875rem', fontWeight:600 }}>System Administration</p>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2rem' }}>Admin Dashboard ⚙️</h1>
          </div>
          <button className="btn-ghost" onClick={() => { clearAll(); nav('/'); }}>Sign Out</button>
        </div>

        {/* Tab nav */}
        <div style={{ display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:4, marginBottom:'2rem', width:'fit-content' }}>
          {NAV_TABS.map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              padding:'0.5rem 1rem', borderRadius:8, border:'none', cursor:'pointer',
              background: view === t.id ? 'var(--gold)' : 'transparent',
              color: view === t.id ? 'var(--bg)' : 'var(--dim)',
              fontWeight:700, fontSize:'0.85rem', fontFamily:'Outfit,sans-serif', transition:'all 150ms',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── STATS VIEW ─────────────────────────────────────────────── */}
        {view === 'stats' && (
          <>
            {loading ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height:90, borderRadius:16 }} />)}
              </div>
            ) : stats && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
                {[
                  { label:'Total Houses',  value: stats.totalHouses },
                  { label:'Active Rooms',  value: stats.activeRooms,  color:'#34d399' },
                  { label:'Playing Now',   value: stats.playingRooms, color:'#f5a623' },
                  { label:'Waiting',       value: stats.waitingRooms },
                  { label:'Total Players', value: stats.totalPlayers },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <span className="stat-value" style={s.color ? { color:s.color } : undefined}>{s.value}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
              {/* Quick actions */}
              <div className="card">
                <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'0.75rem' }}>Quick Actions</h3>
                <button className="btn-primary" style={{ width:'100%', marginBottom:'0.75rem' }}
                  onClick={() => setView('create-owner')}>
                  ➕ Create House Owner
                </button>
                <button className="btn-outline" style={{ width:'100%' }}
                  onClick={() => setView('houses')}>
                  🏠 View All Houses
                </button>
              </div>

              {/* Health */}
              <div className="card">
                <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'0.75rem' }}>System Health</h3>
                <HealthCard />
              </div>
            </div>
          </>
        )}

        {/* ── HOUSES VIEW ─────────────────────────────────────────────── */}
        {view === 'houses' && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.5rem' }}>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800 }}>Bingo Houses ({filtered.length})</h2>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input className="input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:200 }} />
                <button className="btn-primary" style={{ fontSize:'0.85rem', padding:'0.5rem 1rem' }} onClick={() => setView('create-owner')}>
                  + Add Owner
                </button>
              </div>
            </div>
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:64, borderRadius:10 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem 0', color:'var(--muted)' }}>
                <p style={{ fontWeight:600, marginBottom:'0.5rem' }}>No houses yet</p>
                <button className="btn-primary" onClick={() => setView('create-owner')}>Create First Owner →</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {filtered.map(h => (
                  <div key={h.houseId} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    background:'var(--surface2)', borderRadius:10, padding:'0.875rem 1rem',
                    opacity: h.suspended ? 0.55 : 1, flexWrap:'wrap', gap:'0.5rem',
                  }}>
                    <div>
                      <p style={{ fontWeight:700, fontFamily:'Outfit,sans-serif' }}>{h.houseName}</p>
                      <p style={{ fontSize:'0.75rem', color:'var(--dim)' }}>
                        @{h.ownerUsername} · {h.phone} · {h.activeRooms} rooms
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                      {h.suspended && <span className="badge badge-finished" style={{ fontSize:'0.7rem' }}>Suspended</span>}
                      <button className={h.suspended ? 'btn-primary' : 'btn-danger'}
                        style={{ fontSize:'0.75rem', padding:'0.3rem 0.625rem' }}
                        onClick={() => toggleSuspend(h)}>
                        {h.suspended ? 'Reactivate' : 'Suspend'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CREATE OWNER VIEW ───────────────────────────────────────── */}
        {view === 'create-owner' && (
          <div style={{ maxWidth:480 }}>
            <div className="card" style={{ padding:'2rem' }}>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.25rem', marginBottom:'1.5rem' }}>
                🏠 Create House Owner Account
              </h2>
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                <div>
                  <label className="input-label">Username</label>
                  <input className="input" placeholder="house_owner_username" value={coUsername}
                    onChange={e => setCoUsername(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="input-label">Temporary Password</label>
                  <input className="input" type="password" placeholder="They can change this later" value={coPassword}
                    onChange={e => setCoPassword(e.target.value)} />
                  <p style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:4 }}>Minimum 6 characters</p>
                </div>
                <div>
                  <label className="input-label">Bingo House Name</label>
                  <input className="input" placeholder="Lucky Star Bingo" value={coHouseName}
                    onChange={e => setCoHouseName(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Phone Number</label>
                  <div style={{ display:'flex', alignItems:'stretch' }}>
                    <div style={{
                      padding:'0 0.875rem', display:'flex', alignItems:'center',
                      background:'var(--surface2)', border:'1.5px solid var(--border)',
                      borderRight:'none', borderRadius:'10px 0 0 10px',
                      fontSize:'0.9rem', fontWeight:700, color:'var(--dim)', whiteSpace:'nowrap',
                    }}>🇪🇹 +251</div>
                    <input className="input" style={{ borderRadius:'0 10px 10px 0', flex:1,
                        borderColor: coPhone && !coPhoneValid ? '#f87171' : undefined,
                      }}
                      placeholder="9XXXXXXXX" value={coPhone} maxLength={9}
                      onChange={e => setCoPhone(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric" />
                  </div>
                  {coPhone && coPhoneValid && (
                    <p style={{ fontSize:'0.72rem', color:'#34d399', marginTop:4 }}>✓ +251{coPhone}</p>
                  )}
                  {coPhone && !coPhoneValid && (
                    <p style={{ fontSize:'0.72rem', color:'#f87171', marginTop:4 }}>Must be 9 digits starting with 9</p>
                  )}
                </div>

                <div style={{ display:'flex', gap:'0.75rem', marginTop:'0.5rem' }}>
                  <button className="btn-outline" style={{ flex:1 }} onClick={() => setView('houses')}>Cancel</button>
                  <button className="btn-primary" style={{ flex:1 }} onClick={createOwner} disabled={coLoading}>
                    {coLoading ? 'Creating…' : 'Create Owner Account'}
                  </button>
                </div>
              </div>
            </div>
            <p style={{ textAlign:'center', fontSize:'0.78rem', color:'var(--muted)', marginTop:'1rem' }}>
              The owner can sign in at <code>/login</code> with the credentials you set.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}

function HealthCard() {
  const [health, setHealth] = useState<{ status:string; redis:boolean; uptime:number; memory:number; gameLoop:{waiting:number;active:number;delayed:number} } | null>(null);
  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => {});
    const id = setInterval(() => api.getHealth().then(setHealth).catch(() => {}), 15_000);
    return () => clearInterval(id);
  }, []);
  if (!health) return <div className="skeleton" style={{ height:100, borderRadius:10 }} />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
      {[
        { label:'Status', value: health.status, color: health.status==='ok' ? '#34d399' : '#f87171' },
        { label:'Redis',  value: health.redis ? '✓ Connected' : '✗ Down', color: health.redis ? '#34d399' : '#f87171' },
        { label:'Queue',  value: `${health.gameLoop.active} active / ${health.gameLoop.delayed} delayed` },
        { label:'Uptime', value: `${Math.floor(health.uptime/60)}m ${health.uptime%60}s` },
        { label:'Memory', value: `${Math.round(health.memory/1024/1024)}MB RSS` },
      ].map(row => (
        <div key={row.label} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem' }}>
          <span style={{ color:'var(--dim)' }}>{row.label}</span>
          <span style={{ fontWeight:600, color: row.color ?? 'var(--text)' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
