import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Player } from '@babi-bingo/shared';
import { connectSocket, getSocket } from '../socket/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { GameShell } from '../components/layout/Shell';
import PatternPreview from '../components/ui/PatternPreview';

const PATTERNS = ['ROW','COLUMN','DIAGONAL','FOUR_CORNERS','POSTAGE_STAMP','COVERALL'] as const;
type Pat = typeof PATTERNS[number];

const COL_COLOR: Record<string,string> = { B:'#60a5fa', I:'#a78bfa', N:'#fbbf24', G:'#34d399', O:'#f87171' };
const COLS = ['B','I','N','G','O'];
function col(n:number){ return COLS[Math.floor((n-1)/15)] ?? 'B'; }

const STATUS_LABEL: Record<string,string> = { WAITING:'Waiting for players…', PLAYING:'Game in progress', PAUSED:'Game paused', FINISHED:'Game finished' };
const STATUS_DOT: Record<string,string>   = { WAITING:'var(--muted)', PLAYING:'#34d399', PAUSED:'#fbbf24', FINISHED:'var(--gold)' };

export default function OwnerRoomDash() {
  const { code } = useParams<{ code:string }>();
  const nav = useNavigate();
  const { token, houseName, clearAll } = useAuth();
  const { toast } = useToast();

  const [status, setStatus]     = useState('WAITING');
  const [players, setPlayers]   = useState<Player[]>([]);
  const [called, setCalled]     = useState<number[]>([]);
  const [pattern, setPattern]   = useState<Pat>('ROW');
  const [lastNum, setLastNum]   = useState<number|null>(null);
  const [showPattern, setShowPattern] = useState(false);

  useEffect(() => {
    const socket = connectSocket({ token: token ?? '' });
    socket.on('room_joined', ({ room, players: p }) => {
      setStatus(room.state); setPlayers(p); setCalled(room.calledNumbers); setPattern(room.pattern as Pat);
    });
    socket.on('player_joined',  ({ player }) => setPlayers(p => [...p.filter(x=>x.uuid!==player.uuid), player]));
    socket.on('player_left',    ({ uuid })   => setPlayers(p => p.filter(x=>x.uuid!==uuid)));
    socket.on('number_called',  ({ number, calledNumbers }) => { setCalled(calledNumbers); setLastNum(number); });
    socket.on('game_paused',    () => setStatus('PAUSED'));
    socket.on('game_resumed',   () => setStatus('PLAYING'));
    socket.on('game_won', ({ winner }) => { setStatus('FINISHED'); toast(`🎉 ${winner.nickname} won!`, 'success'); });
    socket.on('connect_error', (err) => { if(err.message.includes('AUTH')){ clearAll(); nav('/auth'); }});
    socket.emit('join_room', { roomCode: code!, token: token ?? '' });
    return () => { socket.off('room_joined'); socket.off('player_joined'); socket.off('player_left'); socket.off('number_called'); socket.off('game_paused'); socket.off('game_resumed'); socket.off('game_won'); socket.off('connect_error'); };
  }, [code, token, clearAll, nav, toast]);

  const emit = (ev:'start_game'|'pause_game'|'resume_game') => getSocket().emit(ev, { roomCode: code! });
  const kick  = (uuid:string) => getSocket().emit('kick_player', { roomCode:code!, targetUuid:uuid });
  const gamePlayers = players.filter(p => p.role === 'PLAYER');

  function copyUrl(suffix: string) {
    navigator.clipboard.writeText(`${window.location.origin}${suffix}`);
    toast('Copied to clipboard!', 'success');
  }

  return (
    <GameShell>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'1.5rem' }}>
        {/* Header bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <button className="btn-ghost" onClick={() => nav('/owner')} style={{ padding:'0.4rem 0.75rem', fontSize:'0.875rem' }}>← Back</button>
            <div>
              <p style={{ color:'var(--dim)', fontSize:'0.75rem', fontWeight:600 }}>{houseName}</p>
              <p style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'1.25rem', letterSpacing:1 }}>{code}</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: STATUS_DOT[status] }} />
              <span style={{ fontSize:'0.85rem', color:'var(--dim)', fontWeight:600 }}>{STATUS_LABEL[status]}</span>
            </div>
            <span style={{ fontWeight:800, color:'var(--gold)', fontFamily:'Outfit,sans-serif' }}>👥 {gamePlayers.length}</span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
          {/* Left column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {/* Controls */}
            <div className="card">
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'1rem' }}>Game Controls</h2>
              <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                {status === 'WAITING'  && <button className="btn-primary" style={{ flex:1 }} onClick={() => emit('start_game')}>▶ Start Game</button>}
                {status === 'PLAYING'  && <button className="btn-outline" style={{ flex:1 }} onClick={() => emit('pause_game')}>⏸ Pause</button>}
                {status === 'PAUSED'   && <button className="btn-primary" style={{ flex:1 }} onClick={() => emit('resume_game')}>▶ Resume</button>}
                {status === 'FINISHED' && <button className="btn-outline" style={{ flex:1 }} onClick={() => nav('/owner')}>← Back to Dashboard</button>}
              </div>

              {/* Pattern (only when waiting) */}
              {status === 'WAITING' && (
                <div style={{ marginTop:'1rem' }}>
                  <button onClick={() => setShowPattern(!showPattern)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--dim)', fontWeight:600, fontSize:'0.8rem', display:'flex', alignItems:'center', gap:4 }}>
                    Win Pattern: <span style={{ color:'var(--gold)' }}>{pattern.replace(/_/g,' ')}</span>
                    <span>{showPattern ? '▲':'▼'}</span>
                  </button>
                  {showPattern && (
                    <div style={{ marginTop:'0.75rem' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:'0.75rem' }}>
                        {PATTERNS.map(p => (
                          <button key={p} onClick={() => { setPattern(p); getSocket().emit('set_pattern', { roomCode:code!, pattern:p }); }} style={{
                            padding:'0.35rem', borderRadius:6, border:`1.5px solid ${pattern===p ? 'var(--gold)' : 'var(--border)'}`,
                            background: pattern===p ? 'var(--gold-dim)' : 'transparent',
                            color: pattern===p ? 'var(--gold)' : 'var(--dim)',
                            fontWeight:700, fontSize:'0.7rem', cursor:'pointer',
                          }}>{p.replace(/_/g,' ')}</button>
                        ))}
                      </div>
                      <PatternPreview pattern={pattern} size="sm" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Last number */}
            {lastNum && (
              <div className="card" style={{ textAlign:'center' }}>
                <p style={{ color:'var(--dim)', fontSize:'0.75rem', fontWeight:600, marginBottom:4 }}>Last Called</p>
                <div className="animate-number-in" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:72, height:72, borderRadius:'50%', border:`3px solid ${COL_COLOR[col(lastNum)]}`, background:`${COL_COLOR[col(lastNum)]}15` }}>
                  <div>
                    <p style={{ fontSize:'0.65rem', fontWeight:800, color: COL_COLOR[col(lastNum)] }}>{col(lastNum)}</p>
                    <p style={{ fontSize:'1.5rem', fontWeight:900, fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{lastNum}</p>
                  </div>
                </div>
                <p style={{ marginTop:8, color:'var(--dim)', fontSize:'0.75rem' }}>{called.length}/75 called</p>
              </div>
            )}

            {/* Share links */}
            <div className="card">
              <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'0.9rem', marginBottom:'0.75rem' }}>Share</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface2)', borderRadius:8, padding:'0.5rem 0.75rem' }}>
                  <span style={{ fontFamily:'monospace', fontSize:'0.8rem', color:'var(--gold)', fontWeight:700 }}>{code}</span>
                  <button className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.25rem 0.5rem' }} onClick={() => navigator.clipboard.writeText(code!).then(() => toast('Copied!','success'))}>Copy Code</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface2)', borderRadius:8, padding:'0.5rem 0.75rem' }}>
                  <span style={{ fontSize:'0.75rem', color:'var(--dim)' }}>📺 TV Display</span>
                  <button className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.25rem 0.5rem' }} onClick={() => copyUrl(`/display/${code}`)}>Copy URL</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {/* Called numbers */}
            <div className="card" style={{ flex: called.length > 0 ? undefined : '0 0 auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800 }}>Called Numbers</h2>
                <span style={{ fontWeight:800, color:'var(--gold)' }}>{called.length}/75</span>
              </div>
              {called.length === 0 ? (
                <p style={{ color:'var(--muted)', fontSize:'0.85rem' }}>No numbers called yet</p>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {called.map(n => (
                    <span key={n} style={{
                      padding:'2px 6px', borderRadius:6, fontSize:'0.78rem', fontWeight:700,
                      background:`${COL_COLOR[col(n)]}18`, color: COL_COLOR[col(n)],
                      border:`1px solid ${COL_COLOR[col(n)]}44`,
                    }}>{n}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Players */}
            <div className="card" style={{ flex:1 }}>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, marginBottom:'0.75rem' }}>Players ({gamePlayers.length})</h2>
              {gamePlayers.length === 0 ? (
                <p style={{ color:'var(--muted)', fontSize:'0.85rem' }}>No players yet — share the room code!</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', maxHeight:320, overflowY:'auto' }}>
                  {gamePlayers.map(p => (
                    <div key={p.uuid} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface2)', borderRadius:8, padding:'0.5rem 0.75rem' }}>
                      <span style={{ fontWeight:600, fontSize:'0.9rem' }}>{p.nickname}</span>
                      {status === 'WAITING' && (
                        <button onClick={() => kick(p.uuid)} className="btn-danger" style={{ fontSize:'0.75rem', padding:'0.2rem 0.5rem' }}>Kick</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  );
}
