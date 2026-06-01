import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shell } from '../components/layout/Shell';

export default function OperatorAcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const { setSession } = useAuth();
  const { toast } = useToast();

  const [invite, setInvite]     = useState<{ houseName: string; username: string } | null>(null);
  const [invalid, setInvalid]   = useState(false);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading, setLoading]   = useState(false);

  const phoneValid = /^9[0-9]{8}$/.test(phone);

  // Peek the invite on mount
  useEffect(() => {
    if (!token) { setInvalid(true); return; }
    api.peekInvite(token)
      .then(setInvite)
      .catch(() => setInvalid(true));
  }, [token]);

  async function handleAccept() {
    if (!password || !confirm || !phone) { toast('All fields required', 'error'); return; }
    if (!phoneValid) { toast('Phone must be 9 digits starting with 9', 'error'); return; }
    if (password !== confirm) { toast('Passwords do not match', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }

    setLoading(true);
    try {
      const data = await api.acceptInvite(token!, password, phone);
      setSession({
        uuid:         data.uuid,
        token:        data.accessToken,
        role:         'OPERATOR',
        houseName:    data.houseName,
        refreshToken: data.refreshToken,
      });
      toast('Welcome aboard! 🎉', 'success');
      nav('/owner', { replace: true });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to accept invite', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (invalid) {
    return (
      <Shell>
        <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
          <div className="card" style={{ textAlign:'center', maxWidth:400, padding:'2.5rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>⏱️</div>
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'0.5rem' }}>Invite Expired</h2>
            <p style={{ color:'var(--dim)', fontSize:'0.9rem', lineHeight:1.6 }}>
              This invite link is no longer valid. It may have expired or already been used.
            </p>
            <p style={{ color:'var(--muted)', fontSize:'0.8rem', marginTop:'1rem' }}>
              Ask your house owner to send a new invite.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!invite) {
    return (
      <Shell>
        <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem', animation:'spin 1s linear infinite', display:'inline-block' }}>🎱</div>
            <p style={{ color:'var(--dim)', fontWeight:600 }}>Validating invite…</p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ minHeight:'72vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem 1rem' }}>
        <div style={{ width:'100%', maxWidth:420 }}>
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>🏠</div>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'1.75rem', color:'var(--text)', marginBottom:'0.5rem' }}>
              You're invited!
            </h1>
            <p style={{ color:'var(--dim)', fontSize:'0.9rem' }}>
              Join <strong style={{ color:'var(--gold)' }}>{invite.houseName}</strong> as an operator
            </p>
            <p style={{ color:'var(--muted)', fontSize:'0.8rem', marginTop:4 }}>
              Your username will be: <code style={{ color:'var(--text)', background:'var(--surface2)', padding:'1px 6px', borderRadius:4 }}>{invite.username}</code>
            </p>
          </div>

          <div className="card" style={{ padding:'1.75rem' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Phone */}
              <div>
                <label className="input-label">Your Phone Number</label>
                <div style={{ display:'flex', alignItems:'stretch' }}>
                  <div style={{
                    padding:'0 0.875rem', display:'flex', alignItems:'center',
                    background:'var(--surface2)', border:'1.5px solid var(--border)',
                    borderRight:'none', borderRadius:'10px 0 0 10px',
                    fontSize:'0.9rem', fontWeight:700, color:'var(--dim)', whiteSpace:'nowrap',
                  }}>🇪🇹 +251</div>
                  <input className="input" style={{ borderRadius:'0 10px 10px 0', flex:1 }}
                    placeholder="9XXXXXXXX" value={phone} maxLength={9}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric" />
                </div>
                {phone && phoneValid && (
                  <p style={{ fontSize:'0.72rem', color:'#34d399', marginTop:4 }}>✓ +251{phone}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="input-label">Set Password</label>
                <input className="input" type="password" placeholder="Min 6 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)} />
              </div>

              <div>
                <label className="input-label">Confirm Password</label>
                <input className="input" type="password" placeholder="Repeat password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={{ borderColor: confirm && confirm !== password ? '#f87171' : undefined }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAccept()} />
              </div>

              <button className="btn-primary" style={{ width:'100%' }} onClick={handleAccept} disabled={loading}>
                {loading ? 'Setting up…' : 'Accept Invite & Join'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
