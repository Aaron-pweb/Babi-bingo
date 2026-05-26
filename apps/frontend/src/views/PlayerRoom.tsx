import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { BingoCard as BingoCardType } from '@babi-bingo/shared';
import { connectSocket, getSocket } from '../socket/client';
import BingoCard from '../components/BingoCard';

const COL_COLOR: Record<string, string> = { B: 'text-B', I: 'text-I', N: 'text-N', G: 'text-G', O: 'text-O' };

export default function PlayerRoom() {
  const { code } = useParams<{ code: string }>();
  const [card, setCard] = useState<BingoCardType | null>(null);
  const [called, setCalled] = useState<number[]>([]);
  const [lastNum, setLastNum] = useState<{ number: number; column: string } | null>(null);
  const [status, setStatus] = useState<string>('WAITING');
  const [winner, setWinner] = useState<string | null>(null);
  const [falseAlarm, setFalseAlarm] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const nickname = localStorage.getItem('player_nickname') ?? 'Player';

  useEffect(() => {
    const token = localStorage.getItem('player_token') ?? '';
    const socket = connectSocket({ token });

    socket.on('game_starting', ({ card: c }) => { if (c) setCard(c); setStatus('PLAYING'); });
    socket.on('number_called', ({ number, column, calledNumbers }) => {
      setCalled(calledNumbers);
      setLastNum({ number, column });
    });
    socket.on('game_paused', () => setStatus('PAUSED'));
    socket.on('game_resumed', () => setStatus('PLAYING'));
    socket.on('game_won', ({ winner: w }) => { setWinner(w.nickname); setStatus('FINISHED'); });
    socket.on('false_alarm', ({ cooldownSeconds }) => {
      setFalseAlarm(true);
      setCooldown(true);
      setTimeout(() => { setFalseAlarm(false); setCooldown(false); }, cooldownSeconds * 1000);
    });
    socket.on('sync_state', ({ room, card: c }) => {
      setStatus(room.state);
      setCalled(room.calledNumbers);
      if (c) setCard(c);
    });

    socket.emit('request_sync', { roomCode: code! });

    return () => {
      socket.off('game_starting'); socket.off('number_called');
      socket.off('game_paused'); socket.off('game_resumed');
      socket.off('game_won'); socket.off('false_alarm'); socket.off('sync_state');
    };
  }, [code]);

  function claimBingo() {
    if (cooldown) return;
    getSocket().emit('claim_bingo', { roomCode: code! });
  }

  const statusColor: Record<string, string> = { WAITING: 'bg-muted text-white', PLAYING: 'bg-G/20 text-G', PAUSED: 'bg-N/20 text-N', FINISHED: 'bg-gold/20 text-gold' };

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto px-4 py-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-xl text-white">🎱 {code}</h1>
          <p className="text-dim text-sm">{nickname}</p>
        </div>
        <span className={`badge ${statusColor[status] ?? 'bg-surface text-dim'}`}>
          {status === 'PLAYING' && <span className="w-2 h-2 rounded-full bg-G animate-pulse" />}
          {status}
        </span>
      </div>

      {/* Current number */}
      {lastNum && (
        <div className="card flex items-center justify-center gap-4 py-6" key={lastNum.number}>
          <span className={`text-5xl font-black animate-number-in ${COL_COLOR[lastNum.column]}`}>
            {lastNum.column}
          </span>
          <span className="text-7xl font-black text-white animate-number-in">{lastNum.number}</span>
        </div>
      )}

      {/* Waiting state */}
      {status === 'WAITING' && !card && (
        <div className="card text-center py-10 text-dim">
          <p className="text-4xl mb-3">⏳</p>
          <p className="font-semibold">Waiting for the game to start…</p>
        </div>
      )}

      {/* Bingo card */}
      {card && (
        <div className="card">
          <BingoCard card={card} calledNumbers={called} />
        </div>
      )}

      {/* Recent numbers */}
      {called.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {called.slice(-10).reverse().map((n, i) => (
            <span key={n} className={`text-xs font-bold px-2 py-1 rounded-md ${i === 0 ? 'bg-gold text-bg' : 'bg-surface text-dim border border-border'}`}>
              {n}
            </span>
          ))}
        </div>
      )}

      {/* Winner banner */}
      {winner && (
        <div className="card bg-gold/10 border-gold/30 text-center py-6 animate-win">
          <p className="text-4xl mb-2">🏆</p>
          <p className="text-gold font-black text-2xl">{winner} wins!</p>
        </div>
      )}

      {/* False alarm */}
      {falseAlarm && (
        <div className="card bg-red-900/20 border-red-500/30 text-center py-3">
          <p className="text-red-400 font-semibold">❌ Not a valid bingo — wait 3s</p>
        </div>
      )}

      {/* BINGO button */}
      {status === 'PLAYING' && card && (
        <button onClick={claimBingo} disabled={cooldown}
          className={`w-full py-5 rounded-2xl font-black text-3xl tracking-widest transition-all
            ${cooldown ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gold text-bg hover:bg-gold-light active:scale-95 shadow-[0_0_30px_rgba(245,166,35,0.3)]'}`}>
          BINGO!
        </button>
      )}
    </div>
  );
}
