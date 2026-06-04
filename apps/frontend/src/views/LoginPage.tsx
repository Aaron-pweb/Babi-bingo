import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';

export default function LoginPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setSession } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const errorMsg = params.get('error');

  async function handleLogin() {
    if (!username.trim() || !password) { toast('Username and password required', 'error'); return; }
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);

      // Determine the correct token field — admin/player use 'token', owner/operator use 'accessToken'
      const token = data.token ?? data.accessToken ?? '';

      setSession({
        uuid:         data.uuid,
        token,
        role:         data.role as 'PLAYER' | 'OWNER' | 'ADMIN',
        nickname:     data.nickname,
        houseName:    data.houseName,
        houseId:      data.houseId,
        refreshToken: data.refreshToken,
      });

      // Route by role
      if (data.role === 'ADMIN')  nav('/admin',     { replace: true });
      else if (data.role === 'OWNER') nav('/owner', { replace: true });
      else                           nav('/dashboard', { replace: true });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Invalid credentials', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div style={{ minHeight:'72vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem 1rem' }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'0.75rem' }}>🎱</div>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2rem', color:'var(--text)', marginBottom:'0.5rem' }}>
              Welcome back
            </h1>
            <p style={{ color:'var(--dim)', fontSize:'0.9rem' }}>Sign in to your BabiBingo account</p>
          </div>

          {/* Error banner (from redirect) */}
          {errorMsg && (
            <div style={{ background:'rgba(248,113,113,0.12)', border:'1px solid #f87171', borderRadius:12, padding:'0.75rem 1rem', marginBottom:'1.25rem', fontSize:'0.875rem', color:'#f87171' }}>
              {errorMsg === 'session_expired' ? '⏱ Your session expired. Please sign in again.' : errorMsg}
            </div>
          )}

          {/* Form */}
          <div className="card" style={{ padding:'1.75rem' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label className="input-label">Username</label>
                <input
                  id="login-username"
                  className="input"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">Password</label>
                <input
                  id="login-password"
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <button
                id="login-submit"
                className="btn-primary"
                style={{ width:'100%', marginTop:'0.5rem' }}
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>

            <div className="divider" style={{ margin:'1.25rem 0' }} />

            <p style={{ textAlign:'center', fontSize:'0.875rem', color:'var(--dim)' }}>
              New player?{' '}
              <Link to="/register" style={{ color:'var(--gold)', fontWeight:700 }}>Create a free account →</Link>
            </p>
          </div>

          {/* Info note */}
          <p style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'0.78rem', color:'var(--muted)' }}>
            House owners are created by the platform admin.<br />
            Operators receive an invite link from their house owner.
          </p>
        </div>
      </div>
    </Shell>
  );
}
