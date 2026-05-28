import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { connectSocket } from '../socket/client';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'player' | 'login' | 'register';

export default function Home() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setPlayerSession, setOpSession } = useAuth(); // L5
  const authError = params.get('error');

  const [tab, setTab] = useState<Tab>('player');
  const [error, setError] = useState(authError === 'auth_required' ? 'Session expired. Please log in again.' : '');
  const [loading, setLoading] = useState(false);

  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [opUser, setOpUser] = useState('');
  const [opPass, setOpPass] = useState('');
  const [opHouse, setOpHouse] = useState('');

  async function joinAsPlayer() {
    setError('');
    if (!roomCode.trim() || !nickname.trim()) { setError('Enter room code and nickname'); return; }
    setLoading(true);
    try {
      await api.getRoom(roomCode.toUpperCase());
      const { uuid, token } = await api.guestToken(nickname.trim());
      setPlayerSession(uuid, token, nickname.trim()); // L5: context handles localStorage
      const socket = connectSocket({ token });
      socket.emit('join_room', { roomCode: roomCode.toUpperCase(), token });
      socket.once('room_joined', () => nav(`/room/${roomCode.toUpperCase()}`));
      socket.once('game_error', (e) => { setError(e.message); setLoading(false); });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
      setLoading(false);
    }
  }

  async function operatorLogin() {
    setError('');
    setLoading(true);
    try {
      const data = await api.login(opUser, opPass);
      const room = await api.createRoom(data.accessToken);
      setOpSession(data.uuid, data.accessToken, 'OWNER', data.houseName, data.houseId, data.refreshToken);
      nav(`/operator/${room.code}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoading(false);
    }
  }

  async function operatorRegister() {
    setError('');
    if (!opHouse.trim()) { setError('House name is required'); return; }
    setLoading(true);
    try {
      const data = await api.register(opUser, opPass, opHouse.trim());
      const room = await api.createRoom(data.accessToken);
      setOpSession(data.uuid, data.accessToken, 'OWNER', opHouse.trim(), data.houseId);
      nav(`/operator/${room.code}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed');
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'player',   label: '🎮 Join Game' },
    { id: 'login',    label: '🎛 Operator'  },
    { id: 'register', label: '✨ Register'  },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-bg">
      <div className="mb-10 text-center">
        <div className="text-6xl mb-3">🎱</div>
        <h1 className="text-4xl font-black text-white tracking-tight">Babi <span className="text-gold">Bingo</span></h1>
        <p className="text-dim mt-2">The live bingo platform</p>
      </div>

      <div className="flex bg-surface border border-border rounded-xl p-1 mb-6 w-full max-w-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-gold text-bg' : 'text-dim hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card w-full max-w-sm space-y-4">
        {tab === 'player' && (
          <>
            <input className="input" placeholder="Room Code (e.g. BINGO-7F3K)"
              value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinAsPlayer()} />
            <input className="input" placeholder="Your Nickname"
              value={nickname} onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinAsPlayer()} />
            <button className="btn-primary w-full" onClick={joinAsPlayer} disabled={loading}>
              {loading ? 'Joining…' : 'Join Game'}
            </button>
          </>
        )}

        {tab === 'login' && (
          <>
            <input className="input" placeholder="Username" value={opUser} onChange={e => setOpUser(e.target.value)} />
            <input className="input" placeholder="Password" type="password" value={opPass} onChange={e => setOpPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && operatorLogin()} />
            <button className="btn-primary w-full" onClick={operatorLogin} disabled={loading}>
              {loading ? 'Connecting…' : 'Login & Open Room'}
            </button>
          </>
        )}

        {tab === 'register' && (
          <>
            <input className="input" placeholder="Username (min 3 chars)" value={opUser} onChange={e => setOpUser(e.target.value)} />
            <input className="input" placeholder="Password (min 6 chars)" type="password" value={opPass} onChange={e => setOpPass(e.target.value)} />
            <input className="input" placeholder="House Name" value={opHouse} onChange={e => setOpHouse(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && operatorRegister()} />
            <button className="btn-primary w-full" onClick={operatorRegister} disabled={loading}>
              {loading ? 'Creating account…' : 'Register & Open Room'}
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
