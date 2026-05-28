import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type AdminStats, type HouseInfo } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';

export default function AdminDashboard() {
  const { token, clearAll } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [houses, setHouses] = useState<HouseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [openingWindow, setOpeningWindow] = useState(false);
  const [search, setSearch] = useState('');

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

  async function toggleSuspend(house: HouseInfo) {
    if (!token) return;
    try {
      await api.suspendHouse(token, house.houseId, !house.suspended);
      toast(`${house.houseName} ${house.suspended ? 'reactivated' : 'suspended'}`, house.suspended ? 'success' : 'warning');
      setHouses(h => h.map(x => x.houseId === house.houseId ? { ...x, suspended: !x.suspended } : x));
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
  }

  async function openOpWindow() {
    if (!token) return;
    setOpeningWindow(true);
    try {
      const res = await api.openOpWindow(token, windowMinutes);
      toast(`Operator registration open until ${new Date(res.expiresAt).toLocaleTimeString()}`, 'success');
      await load();
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setOpeningWindow(false); }
  }

  const filtered = houses.filter(h =>
    h.houseName.toLowerCase().includes(search.toLowerCase()) ||
    h.ownerUsername.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Shell>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <p style={{ color:'var(--dim)', fontSize:'0.875rem', fontWeight:600 }}>System Administration</p>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2rem' }}>Admin Dashboard ⚙️</h1>
          </div>
          <button className="btn-ghost" onClick={() => { clearAll(); nav('/'); }}>Sign Out</button>
        </div>

        {/* Stats */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height:90, borderRadius:16 }} />)}
          </div>
        ) : stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
            {[
              { label:'Total Houses',    value: stats.totalHouses },
              { label:'Active Rooms',    value: stats.activeRooms, color:'#34d399' },
              { label:'Playing Now',     value: stats.playingRooms, color:'#f5a623' },
              { label:'Waiting',         value: stats.waitingRooms },
              { label:'Total Players',   value: stats.totalPlayers },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <span className="stat-value" style={ s.color ? { color: s.color } : undefined }>{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1.5rem', alignItems:'start' }}>
          {/* Houses table */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.5rem' }}>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800 }}>Bingo Houses</h2>
              <input className="input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:200 }} />
            </div>
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:64, borderRadius:10 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <p style={{ color:'var(--muted)', textAlign:'center', padding:'2rem 0' }}>No houses found</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {filtered.map(h => (
                  <div key={h.houseId} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    background:'var(--surface2)', borderRadius:10, padding:'0.75rem 1rem',
                    opacity: h.suspended ? 0.55 : 1,
                  }}>
                    <div>
                      <p style={{ fontWeight:700, fontFamily:'Outfit,sans-serif' }}>{h.houseName}</p>
                      <p style={{ fontSize:'0.75rem', color:'var(--dim)' }}>@{h.ownerUsername} · {h.activeRooms} rooms · {h.totalGames} games</p>
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                      {h.suspended && <span className="badge badge-finished" style={{ fontSize:'0.7rem' }}>Suspended</span>}
                      <button className={h.suspended ? 'btn-primary' : 'btn-danger'} style={{ fontSize:'0.75rem', padding:'0.3rem 0.625rem' }}
                        onClick={() => toggleSuspend(h)}>
                        {h.suspended ? 'Reactivate' : 'Suspend'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {/* Operator registration window */}
            <div className="card">
              <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'0.75rem' }}>Operator Registration</h3>
              {stats?.operatorWindowOpen ? (
                <div style={{ background:'rgba(52,211,153,0.1)', border:'1px solid #34d39944', borderRadius:10, padding:'0.75rem', marginBottom:'0.75rem' }}>
                  <p style={{ color:'#34d399', fontWeight:700, fontSize:'0.85rem' }}>✓ Window is OPEN</p>
                  {stats.operatorWindowExpiresAt && (
                    <p style={{ color:'var(--dim)', fontSize:'0.75rem', marginTop:2 }}>
                      Closes at {new Date(stats.operatorWindowExpiresAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ color:'var(--muted)', fontSize:'0.85rem', marginBottom:'0.75rem' }}>Registration is currently closed</p>
              )}
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
                <input type="number" className="input" value={windowMinutes} min={5} max={480}
                  onChange={e => setWindowMinutes(Number(e.target.value))} style={{ width:80 }} />
                <span style={{ color:'var(--dim)', fontSize:'0.85rem' }}>minutes</span>
              </div>
              <button className="btn-primary" style={{ width:'100%' }} onClick={openOpWindow} disabled={openingWindow}>
                {openingWindow ? 'Opening…' : 'Open Registration Window'}
              </button>
            </div>

            {/* System health */}
            <div className="card">
              <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'0.75rem' }}>System Health</h3>
              <HealthCard />
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function HealthCard() {
  const [health, setHealth] = useState<{ status:string; redis:boolean; uptime:number; memory:number; gameLoop:{waiting:number;active:number;delayed:number} } | null>(null);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => {});
    const id = setInterval(() => api.getHealth().then(setHealth).catch(()=>{}), 15_000);
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
