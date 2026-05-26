import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Player } from '@babi-bingo/shared';
import { connectSocket, getSocket } from '../socket/client';

const PATTERNS = ['ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS', 'POSTAGE_STAMP', 'COVERALL'] as const;

export default function OperatorDash() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState('WAITING');
  const [players, setPlayers] = useState<Player[]>([]);
  const [called, setCalled] = useState<number[]>([]);
  const [houseName, setHouseName] = useState('');
  const [pattern, setPattern] = useState('ROW');

  useEffect(() => {
    const token = localStorage.getItem('op_token') ?? '';
    const socket = connectSocket({ token });

    socket.on('room_joined', ({ room, players: p }) => {
      setStatus(room.state); setPlayers(p); setCalled(room.calledNumbers); setHouseName(room.houseName); setPattern(room.pattern);
    });
    socket.on('player_joined', ({ player, playerCount: _ }) => setPlayers((prev) => [...prev.filter(p => p.uuid !== player.uuid), player]));
    socket.on('player_left', ({ uuid }) => setPlayers((prev) => prev.filter(p => p.uuid !== uuid)));
    socket.on('number_called', ({ calledNumbers }) => setCalled(calledNumbers));
    socket.on('game_paused', () => setStatus('PAUSED'));
    socket.on('game_resumed', () => setStatus('PLAYING'));
    socket.on('game_won', () => setStatus('FINISHED'));

    socket.emit('join_room', { roomCode: code!, token });

    return () => { socket.off('room_joined'); socket.off('player_joined'); socket.off('player_left'); socket.off('number_called'); socket.off('game_paused'); socket.off('game_resumed'); socket.off('game_won'); };
  }, [code]);

  const emit = (event: 'start_game' | 'pause_game' | 'resume_game') =>
    getSocket().emit(event, { roomCode: code! });

  const kickPlayer = (uuid: string) =>
    getSocket().emit('kick_player', { roomCode: code!, targetUuid: uuid });

  const statusColor: Record<string, string> = { WAITING: 'text-dim', PLAYING: 'text-G', PAUSED: 'text-N', FINISHED: 'text-gold' };
  const gamePlayers = players.filter(p => p.role === 'PLAYER');

  return (
    <div className="min-h-screen bg-bg px-6 py-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-dim text-sm mb-1">{houseName}</p>
          <h1 className="font-black text-3xl text-white tracking-tight">{code}</h1>
          <p className="text-sm mt-1 font-semibold">
            Status: <span className={statusColor[status] ?? 'text-white'}>{status}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-gold">{gamePlayers.length}</p>
          <p className="text-dim text-xs">players</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card space-y-4">
        <h2 className="font-bold text-white">Game Controls</h2>
        <div className="flex gap-3">
          {status === 'WAITING' && (
            <button className="btn-primary flex-1" onClick={() => emit('start_game')}>▶ Start Game</button>
          )}
          {status === 'PLAYING' && (
            <button className="btn-outline flex-1" onClick={() => emit('pause_game')}>⏸ Pause</button>
          )}
          {status === 'PAUSED' && (
            <button className="btn-primary flex-1" onClick={() => emit('resume_game')}>▶ Resume</button>
          )}
        </div>

        {status === 'WAITING' && (
          <div>
            <label className="text-dim text-sm block mb-2">Win Pattern</label>
            <div className="grid grid-cols-3 gap-2">
              {PATTERNS.map((p) => (
                <button key={p} onClick={() => setPattern(p)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all
                    ${pattern === p ? 'border-gold text-gold bg-gold/10' : 'border-border text-dim hover:border-gold/50'}`}>
                  {p.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Called numbers */}
      {called.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Called Numbers</h2>
            <span className="text-gold font-black">{called.length}/75</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {called.map((n) => (
              <span key={n} className="bg-surface border border-border text-white text-sm font-bold px-2 py-1 rounded-lg">{n}</span>
            ))}
          </div>
        </div>
      )}

      {/* Players */}
      <div className="card">
        <h2 className="font-bold text-white mb-3">Players ({gamePlayers.length})</h2>
        {gamePlayers.length === 0 ? (
          <p className="text-dim text-sm">No players yet. Share the room code!</p>
        ) : (
          <div className="space-y-2">
            {gamePlayers.map((p) => (
              <div key={p.uuid} className="flex items-center justify-between bg-bg rounded-xl px-4 py-3">
                <span className="font-semibold text-white">{p.nickname}</span>
                {status === 'WAITING' && (
                  <button onClick={() => kickPlayer(p.uuid)}
                    className="text-red-400 text-xs hover:text-red-300 transition-colors">Kick</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Display link */}
      <div className="card bg-surface/50">
        <p className="text-dim text-sm mb-1">TV Display URL</p>
        <p className="font-mono text-gold font-semibold text-sm break-all">
          {window.location.origin}/display/{code}
        </p>
      </div>
    </div>
  );
}
