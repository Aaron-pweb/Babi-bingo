import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { connectSocket } from '../socket/client';

export default function Home() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'player' | 'operator'>('player');

  // Player state
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Operator state
  const [opUser, setOpUser] = useState('');
  const [opPass, setOpPass] = useState('');
  const [opHouse, setOpHouse] = useState('');
  const [opLogging, setOpLogging] = useState(false);

  async function joinAsPlayer() {
    setError('');
    if (!roomCode.trim() || !nickname.trim()) { setError('Enter room code and nickname'); return; }
    setJoining(true);
    try {
      await api.getRoom(roomCode.toUpperCase()); // verify exists
      const { uuid, token } = await api.guestToken(nickname.trim());
      localStorage.setItem('player_uuid', uuid);
      localStorage.setItem('player_token', token);
      localStorage.setItem('player_nickname', nickname.trim());
      const socket = connectSocket({ token });
      socket.emit('join_room', { roomCode: roomCode.toUpperCase(), token });
      socket.once('room_joined', () => nav(`/room/${roomCode.toUpperCase()}`));
      socket.once('game_error', (e) => { setError(e.message); setJoining(false); });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
      setJoining(false);
    }
  }

  async function operatorLogin() {
    setError('');
    setOpLogging(true);
    try {
      let data: { accessToken: string; houseName?: string };
      try {
        data = await api.login(opUser, opPass);
      } catch {
        data = await api.register(opUser, opPass, opHouse || opUser + "'s House");
      }
      const room = await api.createRoom(data.accessToken);
      localStorage.setItem('op_token', data.accessToken);
      nav(`/operator/${room.code}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setOpLogging(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-bg">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="text-6xl mb-3">🎱</div>
        <h1 className="text-4xl font-black text-white tracking-tight">Babi <span className="text-gold">Bingo</span></h1>
        <p className="text-dim mt-2">The live bingo platform</p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-surface border border-border rounded-xl p-1 mb-6 w-full max-w-sm">
        {(['player', 'operator'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-gold text-bg' : 'text-dim hover:text-white'}`}>
            {t === 'player' ? '🎮 Join Game' : '🎛 Operator'}
          </button>
        ))}
      </div>

      <div className="card w-full max-w-sm space-y-4">
        {tab === 'player' ? (
          <>
            <input className="input" placeholder="Room Code (e.g. BINGO-7F3K)"
              value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinAsPlayer()} />
            <input className="input" placeholder="Your Nickname"
              value={nickname} onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinAsPlayer()} />
            <button className="btn-primary w-full" onClick={joinAsPlayer} disabled={joining}>
              {joining ? 'Joining…' : 'Join Game'}
            </button>
          </>
        ) : (
          <>
            <input className="input" placeholder="Username" value={opUser} onChange={e => setOpUser(e.target.value)} />
            <input className="input" placeholder="Password" type="password" value={opPass} onChange={e => setOpPass(e.target.value)} />
            <input className="input" placeholder="House name (new accounts)" value={opHouse} onChange={e => setOpHouse(e.target.value)} />
            <button className="btn-primary w-full" onClick={operatorLogin} disabled={opLogging}>
              {opLogging ? 'Connecting…' : 'Login & Open Room'}
            </button>
          </>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>

      <p className="text-muted text-xs mt-6">
        📺 TV Display: <span className="text-dim font-mono">/display/ROOM-CODE</span>
      </p>
    </div>
  );
}
