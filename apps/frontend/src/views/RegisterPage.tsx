import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';

export default function RegisterPage() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [nickname, setNickname] = useState('');
  const [phone,    setPhone]    = useState('');  // user types 9XXXXXXXX
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const phoneValid = /^9[0-9]{8}$/.test(phone);

  async function handleRegister() {
    if (!username.trim() || !password || !nickname.trim() || !phone) {
      toast('All fields are required', 'error'); return;
    }
    if (!phoneValid) {
      toast('Phone must be 9 digits starting with 9 (e.g. 912345678)', 'error'); return;
    }
    if (password !== confirm) {
      toast('Passwords do not match', 'error'); return;
    }
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error'); return;
    }

    setLoading(true);
    try {
      const data = await api.playerRegister(username.trim(), password, nickname.trim(), phone);
      setSession({
        uuid:         data.uuid,
        token:        data.token,
        role:         'PLAYER',
        nickname:     data.nickname,
        refreshToken: data.refreshToken,
      });
      toast('Account created! Welcome 🎉', 'success');
      nav('/dashboard', { replace: true });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div style={{ minHeight:'72vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem 1rem' }}>
        <div style={{ width:'100%', maxWidth:420 }}>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'0.75rem' }}>🎮</div>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2rem', color:'var(--text)', marginBottom:'0.5rem' }}>
              Create your account
            </h1>
            <p style={{ color:'var(--dim)', fontSize:'0.9rem' }}>Join BabiBingo and start playing</p>
          </div>

          <div className="card" style={{ padding:'1.75rem' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Username */}
              <div>
                <label className="input-label">Username</label>
                <input id="reg-username" className="input" placeholder="your_username" value={username}
                  onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
              </div>

              {/* Nickname */}
              <div>
                <label className="input-label">Display Nickname</label>
                <input id="reg-nickname" className="input" placeholder="How others see you in-game" value={nickname}
                  onChange={(e) => setNickname(e.target.value)} />
                <p style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:4 }}>Shown on the bingo board</p>
              </div>

              {/* Phone */}
              <div>
                <label className="input-label">Phone Number</label>
                <div style={{ display:'flex', gap:0, alignItems:'stretch' }}>
                  {/* Fixed prefix */}
                  <div style={{
                    padding:'0 0.875rem', display:'flex', alignItems:'center',
                    background:'var(--surface2)', border:'1.5px solid var(--border)',
                    borderRight:'none', borderRadius:'10px 0 0 10px',
                    fontSize:'0.9rem', fontWeight:700, color:'var(--dim)',
                    whiteSpace:'nowrap',
                  }}>
                    🇪🇹 +251
                  </div>
                  <input
                    id="reg-phone"
                    className="input"
                    style={{ borderRadius:'0 10px 10px 0', flex:1,
                      borderColor: phone && !phoneValid ? '#f87171' : undefined,
                    }}
                    placeholder="9XXXXXXXX"
                    value={phone}
                    maxLength={9}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                  />
                </div>
                {phone && !phoneValid && (
                  <p style={{ fontSize:'0.72rem', color:'#f87171', marginTop:4 }}>
                    Must be 9 digits starting with 9 (e.g. 912345678)
                  </p>
                )}
                {phone && phoneValid && (
                  <p style={{ fontSize:'0.72rem', color:'#34d399', marginTop:4 }}>
                    ✓ +251{phone}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="input-label">Password</label>
                <div style={{ position:'relative' }}>
                  <input id="reg-password" className="input" type={showPass ? 'text' : 'password'}
                    placeholder="Min 6 characters" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight:'2.5rem' }} />
                  <button onClick={() => setShowPass(!showPass)} style={{
                    position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer', color:'var(--dim)', fontSize:'0.85rem',
                  }}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="input-label">Confirm Password</label>
                <input id="reg-confirm" className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={{ borderColor: confirm && confirm !== password ? '#f87171' : undefined }}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                />
                {confirm && confirm !== password && (
                  <p style={{ fontSize:'0.72rem', color:'#f87171', marginTop:4 }}>Passwords don't match</p>
                )}
              </div>

              <button id="reg-submit" className="btn-primary" style={{ width:'100%', marginTop:'0.25rem' }}
                onClick={handleRegister} disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </div>

            <div className="divider" style={{ margin:'1.25rem 0' }} />

            <p style={{ textAlign:'center', fontSize:'0.875rem', color:'var(--dim)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color:'var(--gold)', fontWeight:700 }}>Sign In →</Link>
            </p>
          </div>

          <p style={{ textAlign:'center', marginTop:'1rem', fontSize:'0.75rem', color:'var(--muted)' }}>
            🔒 Your phone number is kept private and used for account security only.
          </p>
        </div>
      </div>
    </Shell>
  );
}
