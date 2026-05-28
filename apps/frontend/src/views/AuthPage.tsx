import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';

type Tab = 'player' | 'owner' | 'admin';

export default function AuthPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setPlayerSession, setOpSession, setAdminSession } = useAuth();
  const { toast } = useToast();

  const defaultTab = (params.get('tab') as Tab) ?? 'player';
  const joinCode = params.get('join') ?? '';

  const [tab, setTab] = useState<Tab>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const [pUsername, setPUsername] = useState('');
  const [pPassword, setPPassword] = useState('');
  const [pNickname, setPNickname] = useState('');
  const [pCode, setPCode] = useState(joinCode);
  const [oUsername, setOUsername] = useState('');
  const [oPassword, setOPassword] = useState('');
  const [oHouse, setOHouse] = useState('');
  const [aUsername, setAUsername] = useState('');
  const [aPassword, setAPassword] = useState('');

  async function submitPlayer() {
    setLoading(true);
    try {
      if (isRegister) {
        if (!pUsername || !pPassword || !pNickname) { toast('All fields required', 'error'); return; }
        const d = await api.playerRegister(pUsername, pPassword, pNickname);
        setPlayerSession(d.uuid, d.token, pNickname, d.refreshToken);
      } else {
        const d = await api.playerLogin(pUsername, pPassword);
        setPlayerSession(d.uuid, d.token, d.nickname, d.refreshToken);
      }
      if (pCode.trim()) nav(`/room/${pCode.trim().toUpperCase()}`);
      else nav('/dashboard');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Auth failed', 'error');
    } finally { setLoading(false); }
  }

  async function submitOwner() {
    setLoading(true);
    try {
      if (isRegister) {
        if (!oUsername || !oPassword || !oHouse) { toast('All fields required', 'error'); return; }
        const d = await api.register(oUsername, oPassword, oHouse);
        setOpSession(d.uuid, d.accessToken, 'OWNER', oHouse, d.houseId, d.refreshToken);
      } else {
        const d = await api.login(oUsername, oPassword);
        setOpSession(d.uuid, d.accessToken, 'OWNER', d.houseName, d.houseId, d.refreshToken);
      }
      nav('/owner');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Auth failed', 'error');
    } finally { setLoading(false); }
  }

  async function submitAdmin() {
    setLoading(true);
    try {
      const d = await api.adminLogin(aUsername, aPassword);
      setAdminSession(d.uuid, d.token);
      nav('/admin');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Invalid credentials', 'error');
    } finally { setLoading(false); }
  }

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'player', icon: '🎮', label: 'Player' },
    { id: 'owner',  icon: '🏠', label: 'House Owner' },
    { id: 'admin',  icon: '⚙️', label: 'Admin' },
  ];

  return (
    <Shell>
      <div style={{ minHeight:'70vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem 1rem' }}>
        <div style={{ width:'100%', maxWidth:440 }}>
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>🎱</div>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'1.75rem' }}>
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p style={{ color:'var(--dim)', marginTop:4, fontSize:'0.875rem' }}>
              {isRegister ? 'Start your bingo journey' : 'Sign in to continue'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:4, marginBottom:'1.5rem', gap:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setIsRegister(false); }}
                style={{
                  flex:1, padding:'0.5rem 0.25rem', borderRadius:8, border:'none', cursor:'pointer',
                  background: tab === t.id ? 'var(--gold)' : 'transparent',
                  color: tab === t.id ? 'var(--bg)' : 'var(--dim)',
                  fontWeight:700, fontSize:'0.78rem', fontFamily:'Outfit,sans-serif', transition:'all 150ms',
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding:'1.75rem' }}>
            {/* PLAYER */}
            {tab === 'player' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {joinCode && (
                  <div style={{ background:'var(--gold-dim)', border:'1px solid var(--gold)', borderRadius:10, padding:'0.75rem 1rem' }}>
                    <p style={{ fontSize:'0.75rem', color:'var(--gold)', fontWeight:700 }}>Joining room</p>
                    <p style={{ fontWeight:900, fontFamily:'Outfit,sans-serif', letterSpacing:1 }}>{joinCode}</p>
                  </div>
                )}
                <div><label className="input-label">Username</label>
                  <input className="input" placeholder="your_username" value={pUsername} onChange={e=>setPUsername(e.target.value)} /></div>
                <div><label className="input-label">Password</label>
                  <input className="input" placeholder="••••••••" type="password" value={pPassword} onChange={e=>setPPassword(e.target.value)} /></div>
                {isRegister && <div><label className="input-label">Display Nickname</label>
                  <input className="input" placeholder="How others see you" value={pNickname} onChange={e=>setPNickname(e.target.value)} /></div>}
                {!joinCode && !isRegister && <div><label className="input-label">Room Code <span style={{ color:'var(--muted)' }}>(optional)</span></label>
                  <input className="input" placeholder="BINGO-7F3K" value={pCode} onChange={e=>setPCode(e.target.value.toUpperCase())} /></div>}
                <button className="btn-primary" style={{ width:'100%' }} onClick={submitPlayer} disabled={loading}>
                  {loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In & Play'}
                </button>
                <p style={{ textAlign:'center', fontSize:'0.85rem', color:'var(--dim)' }}>
                  {isRegister ? 'Have an account? ' : 'No account? '}
                  <button onClick={() => setIsRegister(!isRegister)} style={{ color:'var(--gold)', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>
                    {isRegister ? 'Sign In' : 'Register'}
                  </button>
                </p>
              </div>
            )}

            {/* OWNER */}
            {tab === 'owner' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                <div><label className="input-label">Username</label>
                  <input className="input" value={oUsername} onChange={e=>setOUsername(e.target.value)} /></div>
                <div><label className="input-label">Password</label>
                  <input className="input" type="password" value={oPassword} onChange={e=>setOPassword(e.target.value)} /></div>
                {isRegister && <div><label className="input-label">Bingo House Name</label>
                  <input className="input" placeholder="Lucky Star Bingo" value={oHouse} onChange={e=>setOHouse(e.target.value)} /></div>}
                <button className="btn-primary" style={{ width:'100%' }} onClick={submitOwner} disabled={loading}>
                  {loading ? 'Please wait…' : isRegister ? 'Open My House' : 'Sign In'}
                </button>
                <p style={{ textAlign:'center', fontSize:'0.85rem', color:'var(--dim)' }}>
                  {isRegister ? 'Already registered? ' : 'New here? '}
                  <button onClick={() => setIsRegister(!isRegister)} style={{ color:'var(--gold)', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>
                    {isRegister ? 'Sign In' : 'Register'}
                  </button>
                </p>
                <div className="divider" />
                <p style={{ textAlign:'center', fontSize:'0.8rem', color:'var(--muted)' }}>
                  Operator? <Link to="/auth/operator" style={{ color:'var(--gold)', fontWeight:600 }}>Register →</Link>
                </p>
              </div>
            )}

            {/* ADMIN */}
            {tab === 'admin' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                <div style={{ background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:10, padding:'0.75rem' }}>
                  <p style={{ fontSize:'0.8rem', color:'var(--dim)' }}>🔒 System administrator access only.</p>
                </div>
                <div><label className="input-label">Admin Username</label>
                  <input className="input" value={aUsername} onChange={e=>setAUsername(e.target.value)} /></div>
                <div><label className="input-label">Password</label>
                  <input className="input" type="password" value={aPassword} onChange={e=>setAPassword(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && submitAdmin()} /></div>
                <button className="btn-primary" style={{ width:'100%' }} onClick={submitAdmin} disabled={loading}>
                  {loading ? 'Verifying…' : 'Access Admin Panel'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
