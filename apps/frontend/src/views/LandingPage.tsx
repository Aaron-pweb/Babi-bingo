import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type RoomPublicInfo } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Shell } from '../components/layout/Shell';


const STATE_LABEL: Record<string, string>  = { PLAYING:'🔴 Live', WAITING:'⏳ Waiting', FINISHED:'✓ Finished' };
const STATE_CLASS: Record<string, string> = { PLAYING:'badge-playing', WAITING:'badge-waiting', FINISHED:'badge-finished' };

function RoomCard({ room }: { room: RoomPublicInfo }) {
  const accent = room.accentColor ?? '#f5a623';
  return (
    <div className="card-hover" style={{ cursor: 'default', position: 'relative', overflow: 'hidden' }}>
      {/* Top accent stripe */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: accent, borderRadius:'16px 16px 0 0' }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginTop: 4 }}>
        <div>
          <p style={{ color:'var(--dim)', fontSize:'0.75rem', fontWeight:600, marginBottom:2 }}>{room.houseName}</p>
          <p style={{ color:'var(--text)', fontWeight:800, fontSize:'1.1rem', fontFamily:'Outfit,sans-serif', letterSpacing:1 }}>{room.code}</p>
        </div>
        <span className={`badge ${STATE_CLASS[room.state] ?? 'badge-waiting'}`}>{STATE_LABEL[room.state] ?? room.state}</span>
      </div>
      <div style={{ marginTop:'0.875rem', display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ background:'var(--surface2)', color:'var(--dim)', padding:'2px 8px', borderRadius:6, fontSize:'0.72rem', fontWeight:600 }}>
          👥 {room.playerCount} players
        </span>
        {room.state !== 'WAITING' && (
          <span style={{ background:'var(--surface2)', color:'var(--dim)', padding:'2px 8px', borderRadius:6, fontSize:'0.72rem', fontWeight:600 }}>
            🎱 {room.calledCount}/75 called
          </span>
        )}
        <span style={{ background:'var(--surface2)', color:'var(--dim)', padding:'2px 8px', borderRadius:6, fontSize:'0.72rem', fontWeight:600 }}>
          {room.pattern.replace(/_/g,' ')}
        </span>
      </div>
      {room.finishedAt && (
        <p style={{ marginTop:8, color:'var(--muted)', fontSize:'0.7rem' }}>
          Finished {new Date(room.finishedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

export default function LandingPage() {
  const nav = useNavigate();
  const { role } = useAuth();
  const [rooms, setRooms] = useState<{ playing: RoomPublicInfo[]; waiting: RoomPublicInfo[]; recent: RoomPublicInfo[] }>({ playing: [], waiting: [], recent: [] });
  const [roomCode, setRoomCode] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (role === 'ADMIN') nav('/admin', { replace: true });
    else if (role === 'OWNER' || role === 'OPERATOR') nav('/owner', { replace: true });
    else if (role === 'PLAYER') nav('/dashboard', { replace: true });
  }, [role, nav]);

  useEffect(() => {
    api.getPublicRooms().then(setRooms).catch(() => {});
    const id = setInterval(() => api.getPublicRooms().then(setRooms).catch(() => {}), 10_000);
    return () => clearInterval(id);
  }, []);

  const totalActive = rooms.playing.length + rooms.waiting.length;

  return (
    <Shell>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section style={{ padding:'5rem 1.5rem 4rem', textAlign:'center', maxWidth:700, margin:'0 auto' }}>
        <div className="animate-fade-up" style={{ fontSize:'5rem', marginBottom:'1rem' }}>🎱</div>
        <h1 className="animate-fade-up-delay-1" style={{
          fontSize:'clamp(2.5rem,6vw,4rem)', fontWeight:900, lineHeight:1.1,
          fontFamily:'Outfit,sans-serif', color:'var(--text)', marginBottom:'1rem'
        }}>
          Live Bingo for<br/>
          <span style={{ color:'var(--gold)' }}>Every House.</span>
        </h1>
        <p className="animate-fade-up-delay-2" style={{ color:'var(--dim)', fontSize:'1.1rem', lineHeight:1.7, marginBottom:'2.5rem' }}>
          Join live games, run your bingo house, or display real-time draws on any TV screen.
          {totalActive > 0 && <span style={{ display:'block', marginTop:8, color:'var(--gold)', fontWeight:700 }}>
            🟢 {totalActive} {totalActive === 1 ? 'room' : 'rooms'} active right now
          </span>}
        </p>
        {/* Quick join */}
        <div className="animate-fade-up-delay-3" style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:'1rem' }}>
          <input className="input" placeholder="Room code (e.g. BINGO-7F3K)" value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            style={{ maxWidth:260, textAlign:'center', fontWeight:700, letterSpacing:1 }}
            onKeyDown={e => e.key === 'Enter' && roomCode.length > 3 && nav(`/auth?join=${roomCode}`)} />
          <button className="btn-primary" onClick={() => roomCode.length > 3 && nav(`/auth?join=${roomCode}`)}>
            Join Game →
          </button>
        </div>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/auth?tab=owner" className="btn-outline">Open a Bingo House</Link>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section style={{ maxWidth:1100, margin:'0 auto', padding:'0 1.5rem 4rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'1.25rem' }}>
          {[
            { icon:'📺', title:'TV Ready', desc:'Any room can be displayed fullscreen on a TV — just navigate to the display URL.' },
            { icon:'⚡', title:'Real-time', desc:'Numbers are called automatically. Every player sees the draw at the same moment.' },
            { icon:'🏠', title:'Multi-house', desc:'Operators manage their own rooms independently. Full house branding control.' },
            { icon:'🌍', title:'Any Device', desc:'Players join on their phone, owner manages on tablet, audience watches on TV.' },
          ].map((f) => (
            <div key={f.title} className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>{f.icon}</div>
              <h3 style={{ fontWeight:800, fontSize:'1rem', marginBottom:'0.5rem', fontFamily:'Outfit,sans-serif' }}>{f.title}</h3>
              <p style={{ color:'var(--dim)', fontSize:'0.875rem', lineHeight:1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live rooms ──────────────────────────────────────────── */}
      {(rooms.playing.length > 0 || rooms.waiting.length > 0 || rooms.recent.length > 0) && (
        <section style={{ maxWidth:1100, margin:'0 auto', padding:'0 1.5rem 4rem' }}>
          <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.5rem', marginBottom:'1.5rem' }}>
            🎮 Live Rooms
          </h2>

          {rooms.playing.length > 0 && (
            <div style={{ marginBottom:'2rem' }}>
              <p style={{ color:'#34d399', fontWeight:700, fontSize:'0.85rem', marginBottom:'0.75rem', textTransform:'uppercase', letterSpacing:1 }}>
                🔴 Playing now ({rooms.playing.length})
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem' }}>
                {rooms.playing.map(r => <RoomCard key={r.code} room={r} />)}
              </div>
            </div>
          )}

          {rooms.waiting.length > 0 && (
            <div style={{ marginBottom:'2rem' }}>
              <p style={{ color:'var(--dim)', fontWeight:700, fontSize:'0.85rem', marginBottom:'0.75rem', textTransform:'uppercase', letterSpacing:1 }}>
                ⏳ Waiting for players ({rooms.waiting.length})
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem' }}>
                {rooms.waiting.map(r => <RoomCard key={r.code} room={r} />)}
              </div>
            </div>
          )}

          {rooms.recent.length > 0 && (
            <div>
              <p style={{ color:'var(--muted)', fontWeight:700, fontSize:'0.85rem', marginBottom:'0.75rem', textTransform:'uppercase', letterSpacing:1 }}>
                ✓ Recently finished
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem' }}>
                {rooms.recent.slice(0,6).map(r => <RoomCard key={r.code} room={r} />)}
              </div>
            </div>
          )}
        </section>
      )}
    </Shell>
  );
}
