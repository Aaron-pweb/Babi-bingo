import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { BingoCard as BingoCardType, BingoCell } from '@babi-bingo/shared';
import { connectSocket, getSocket } from '../socket/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { GameShell } from '../components/layout/Shell';

const COLS = ['B','I','N','G','O'];
const COL_COLOR: Record<string,string> = { B:'#60a5fa', I:'#a78bfa', N:'#fbbf24', G:'#34d399', O:'#f87171' };
function col(n:number){ return COLS[Math.floor((n-1)/15)] ?? 'B'; }

export default function PlayerRoom() {
  const { code } = useParams<{ code:string }>();
  const nav = useNavigate();
  const { token, nickname, clearAll } = useAuth();
  const { toast } = useToast();

  const [card, setCard]         = useState<BingoCardType | null>(null);
  const [called, setCalled]     = useState<number[]>([]);
  const [lastNum, setLastNum]   = useState<{ number:number; column:string } | null>(null);
  const [status, setStatus]     = useState('WAITING');
  const [winner, setWinner]     = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [won, setWon]           = useState(false);

  const calledSet = useMemo(() => new Set(called), [called]);

  useEffect(() => {
    const socket = connectSocket({ token: token ?? '' });

    const onStarting = ({ card: c }: { card?: BingoCardType; pattern: string }) => {
      if (c) setCard(c); setStatus('PLAYING');
    };
    const onNumber   = ({ number, column, calledNumbers }: { number:number; column:string; calledNumbers:number[] }) => {
      setCalled(calledNumbers); setLastNum({ number, column }); setStatus('PLAYING');
    };
    const onPaused   = () => setStatus('PAUSED');
    const onResumed  = () => setStatus('PLAYING');
    const onWon      = ({ winner }: { winner: { uuid:string; nickname:string } }) => {
      setWinner(winner.nickname); setStatus('FINISHED');
      if (winner.nickname === nickname) { setWon(true); toast('🎉 You won! BINGO!', 'success'); }
      else toast(`${winner.nickname} won this round`, 'info');
    };
    const onFalse    = () => { toast('Not quite — keep playing!', 'warning'); setCooldown(false); };
    const onSync     = ({ room, card: c }: { room:{state:string;calledNumbers:number[]}, card?:BingoCardType }) => {
      setStatus(room.state); setCalled(room.calledNumbers); if(c) setCard(c);
    };
    const onErr      = (err: Error) => { if(err.message.includes('AUTH')){ clearAll(); nav('/auth'); }};

    socket.on('game_starting', onStarting);
    socket.on('number_called', onNumber);
    socket.on('game_paused', onPaused);
    socket.on('game_resumed', onResumed);
    socket.on('game_won', onWon);
    socket.on('false_alarm', onFalse);
    socket.on('sync_state', onSync);
    socket.on('connect_error', onErr);
    socket.emit('request_sync', { roomCode: code! });

    return () => {
      socket.off('game_starting',onStarting); socket.off('number_called',onNumber);
      socket.off('game_paused',onPaused); socket.off('game_resumed',onResumed);
      socket.off('game_won',onWon); socket.off('false_alarm',onFalse);
      socket.off('sync_state',onSync); socket.off('connect_error',onErr);
    };
  }, [code, token, clearAll, nav, nickname, toast]);

  const claimBingo = useCallback(() => {
    if (cooldown || status !== 'PLAYING') return;
    setCooldown(true);
    getSocket().emit('claim_bingo', { roomCode: code! });
    setTimeout(() => setCooldown(false), 5000);
  }, [cooldown, code, status]);

  const totalMarked = useMemo(() => {
    if (!card) return 0;
    return card.flat().filter((n: BingoCell) => n === null || calledSet.has(n as number)).length;
  }, [card, calledSet]);

  return (
    <GameShell>
      <div style={{ maxWidth:480, margin:'0 auto', padding:'1.25rem 1rem', minHeight:'100vh', display:'flex', flexDirection:'column', gap:'1rem' }}>

        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, letterSpacing:1, fontSize:'1rem' }}>{code}</p>
            <p style={{ color:'var(--dim)', fontSize:'0.75rem' }}>{nickname}</p>
          </div>
          <div style={{ textAlign:'right' }}>
            {status === 'PLAYING' && <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 6px #34d399' }} />
              <span style={{ fontSize:'0.75rem', color:'#34d399', fontWeight:700 }}>LIVE</span>
            </div>}
            {status === 'WAITING' && <span style={{ fontSize:'0.75rem', color:'var(--muted)', fontWeight:700 }}>WAITING</span>}
            {status === 'PAUSED'  && <span style={{ fontSize:'0.75rem', color:'#fbbf24', fontWeight:700 }}>PAUSED</span>}
            {status === 'FINISHED' && <span style={{ fontSize:'0.75rem', color:'var(--gold)', fontWeight:700 }}>FINISHED</span>}
            {status === 'PLAYING' && <p style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:2 }}>{called.length}/75</p>}
          </div>
        </div>

        {/* Last number hero */}
        {lastNum ? (
          <div className="animate-number-in" style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'1.25rem 0' }}>
            <div style={{
              width:100, height:100, borderRadius:'50%',
              border:`3px solid ${COL_COLOR[lastNum.column]}`,
              background:`${COL_COLOR[lastNum.column]}15`,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              boxShadow:`0 0 30px ${COL_COLOR[lastNum.column]}44`,
            }}>
              <p style={{ fontSize:'0.75rem', fontWeight:900, color: COL_COLOR[lastNum.column], letterSpacing:2 }}>{lastNum.column}</p>
              <p style={{ fontSize:'2.5rem', fontWeight:900, fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{lastNum.number}</p>
            </div>
          </div>
        ) : status === 'WAITING' ? (
          <div style={{ textAlign:'center', padding:'2rem 0' }}>
            <p style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>⏳</p>
            <p style={{ color:'var(--dim)', fontWeight:600 }}>Waiting for game to start…</p>
          </div>
        ) : null}

        {/* Recent numbers strip */}
        {called.length > 0 && (
          <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:4 }}>
            {[...called].reverse().slice(0,12).map((n,i) => (
              <span key={n} style={{
                flexShrink:0, padding:'3px 7px', borderRadius:6, fontSize:'0.75rem', fontWeight:700,
                background:`${COL_COLOR[col(n)]}18`, color: COL_COLOR[col(n)],
                border:`1px solid ${COL_COLOR[col(n)]}33`, opacity: i===0 ? 1 : Math.max(0.35, 1-i*0.07),
              }}>{n}</span>
            ))}
          </div>
        )}

        {/* BINGO card */}
        {card ? (
          <div>
            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4, marginBottom:4 }}>
              {COLS.map(c => (
                <div key={c} style={{ textAlign:'center', fontWeight:900, fontSize:'1.1rem', fontFamily:'Outfit,sans-serif', color: COL_COLOR[c], padding:'0.25rem' }}>{c}</div>
              ))}
            </div>
            {/* Grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4 }}>
              {card.flat().map((n: BingoCell, i: number) => {
                const isFree = n === null;
                const isMarked = isFree || (n !== null && calledSet.has(n));
                const colKey = COLS[i % 5];
                return (
                  <div key={i} style={{
                    aspectRatio:'1', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:900, fontFamily:'Outfit,sans-serif', fontSize:'1.1rem',
                    border: `1.5px solid ${isMarked ? COL_COLOR[colKey] : 'var(--border)'}`,
                    background: isMarked ? `${COL_COLOR[colKey]}22` : 'var(--surface)',
                    color: isMarked ? COL_COLOR[colKey] : 'var(--dim)',
                    transition:'all 200ms', boxShadow: isMarked ? `0 0 8px ${COL_COLOR[colKey]}44` : 'none',
                  }}>
                    {isFree ? '★' : n}
                  </div>
                );
              })}
            </div>
            <p style={{ textAlign:'center', color:'var(--muted)', fontSize:'0.72rem', marginTop:6 }}>{totalMarked}/25 marked</p>
          </div>
        ) : status !== 'WAITING' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4 }}>
            {Array.from({length:25}).map((_,i) => <div key={i} className="skeleton" style={{ aspectRatio:'1', borderRadius:10 }} />)}
          </div>
        )}

        {/* BINGO button */}
        {status === 'PLAYING' && card && (
          <button onClick={claimBingo} disabled={cooldown}
            className={`btn-primary animate-bingo-glow`}
            style={{ fontSize:'1.5rem', padding:'1rem', borderRadius:16, width:'100%', letterSpacing:2, opacity: cooldown ? 0.5 : 1 }}>
            {cooldown ? 'Checking…' : '🎱 BINGO!'}
          </button>
        )}

        {/* Win overlay */}
        {won && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
            <div className="animate-win" style={{ fontSize:'6rem' }}>🎉</div>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:'2.5rem', color:'var(--gold)' }}>BINGO!</h1>
            <p style={{ color:'var(--dim)' }}>You won this round!</p>
            <button className="btn-primary" onClick={() => nav('/dashboard')}>Back to Dashboard</button>
          </div>
        )}

        {status === 'FINISHED' && !won && winner && (
          <div className="card" style={{ textAlign:'center', padding:'1.5rem' }}>
            <p style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🏆</p>
            <p style={{ fontWeight:800, fontFamily:'Outfit,sans-serif' }}>{winner} won!</p>
            <button className="btn-outline" style={{ marginTop:'1rem', width:'100%' }} onClick={() => nav('/dashboard')}>Back to Dashboard</button>
          </div>
        )}
      </div>
    </GameShell>
  );
}
