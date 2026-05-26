import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket } from '../socket/client';

// M6: Constants outside component
const COL_COLOR: Record<string, string> = {
  B: '#60a5fa', I: '#a78bfa', N: '#fbbf24', G: '#34d399', O: '#f87171',
};
const COL_RANGE: Record<string, [number, number]> = {
  B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75],
};
const COLS = ['B', 'I', 'N', 'G', 'O'] as const;

export default function DisplayView() {
  const { code } = useParams<{ code: string }>();
  const nav = useNavigate();
  const [houseName, setHouseName] = useState('');
  const [called, setCalled] = useState<number[]>([]);
  const [current, setCurrent] = useState<{ number: number; column: string } | null>(null);
  const [status, setStatus] = useState('WAITING');
  const [winner, setWinner] = useState<{ nickname: string } | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // M4: useMemo — only rebuilds Set when called array changes
  const calledSet = useMemo(() => new Set(called), [called]);

  useEffect(() => {
    const socket = connectSocket({ role: 'DISPLAY' });
    socket.emit('join_display', { roomCode: code! });

    // M7: Named handlers for precise cleanup
    const onRoomJoined = ({ room }: { room: { houseName: string; state: string; calledNumbers: number[] } }) => {
      setHouseName(room.houseName);
      setStatus(room.state);
      setCalled(room.calledNumbers);
    };
    const onGameStarting = () => setStatus('PLAYING');
    const onNumberCalled = ({ number, column, calledNumbers }: { number: number; column: string; calledNumbers: number[] }) => {
      setCalled(calledNumbers);
      setCurrent({ number, column });
      setAnimKey((k) => k + 1);
    };
    const onGamePaused = () => setStatus('PAUSED');
    const onGameResumed = () => setStatus('PLAYING');
    const onGameWon = ({ winner: w }: { winner: { nickname: string } }) => { setWinner(w); setStatus('FINISHED'); };
    // H9: Redirect on auth failure (display shouldn't fail, but handle it)
    const onConnectError = (err: Error) => {
      if (err.message.includes('AUTH')) nav('/?error=auth_required');
    };

    socket.on('room_joined', onRoomJoined);
    socket.on('game_starting', onGameStarting);
    socket.on('number_called', onNumberCalled);
    socket.on('game_paused', onGamePaused);
    socket.on('game_resumed', onGameResumed);
    socket.on('game_won', onGameWon);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('room_joined', onRoomJoined);
      socket.off('game_starting', onGameStarting);
      socket.off('number_called', onNumberCalled);
      socket.off('game_paused', onGamePaused);
      socket.off('game_resumed', onGameResumed);
      socket.off('game_won', onGameWon);
      socket.off('connect_error', onConnectError);
    };
  }, [code, nav]);

  const col = current?.column ?? null;
  const color = col ? COL_COLOR[col] : '#f5a623';

  return (
    <div className="h-screen w-screen bg-bg overflow-hidden flex flex-col font-outfit" style={{ fontFamily: 'Outfit, sans-serif' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎱</span>
          <span className="font-black text-white text-xl">{houseName || 'Babi Bingo'}</span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'PLAYING' && <span className="flex items-center gap-2 text-G text-sm font-semibold"><span className="w-2 h-2 rounded-full bg-G animate-pulse" /> LIVE</span>}
          {status === 'PAUSED' && <span className="text-N font-semibold text-sm">⏸ PAUSED</span>}
          {status === 'WAITING' && <span className="text-dim font-semibold text-sm">WAITING</span>}
        </div>
        <div className="font-mono font-bold text-dim text-lg">{code}</div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Current number */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {winner ? (
            <div className="text-center animate-win">
              <div className="text-8xl mb-6">🏆</div>
              <p className="font-black text-6xl text-gold">{winner.nickname}</p>
              <p className="text-dim text-2xl mt-3">BINGO!</p>
            </div>
          ) : current ? (
            <div key={animKey} className="text-center" style={{ animation: 'numberIn 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
              <div className="font-black select-none"
                style={{ fontSize: '22vw', lineHeight: 1, color, opacity: 0.12, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -55%)' }}>
                {col}
              </div>
              <div className="font-black" style={{ fontSize: '6vw', color, letterSpacing: '0.2em', marginBottom: '0.5rem' }}>{col}</div>
              <div className="font-black" style={{ fontSize: '28vw', lineHeight: 0.85, color: '#ffffff', textShadow: `0 0 80px ${color}88` }}>
                {current.number}
              </div>
            </div>
          ) : (
            <div className="text-center text-dim">
              <div className="text-8xl mb-4 opacity-30">🎱</div>
              <p className="text-3xl font-bold">Waiting for game to start…</p>
            </div>
          )}

          {/* Ticker */}
          {called.length > 1 && (
            <div className="absolute bottom-6 flex gap-3">
              {called.slice(-8, -1).reverse().map((n) => (
                <div key={n} className="bg-surface border border-border rounded-xl px-4 py-2 font-bold text-dim text-xl">{n}</div>
              ))}
            </div>
          )}
        </div>

        {/* Right: 75-ball board */}
        <div className="w-72 border-l border-border p-4 overflow-y-auto">
          <div className="grid grid-cols-5 gap-1">
            {COLS.map((c) => (
              <div key={c} className="text-center font-black text-sm py-2" style={{ color: COL_COLOR[c] }}>{c}</div>
            ))}
            {Array.from({ length: 15 }, (_, row) =>
              COLS.map((c) => {
                const n = COL_RANGE[c][0] + row;
                const isCalled = calledSet.has(n); // M4: O(1) lookup from memoized Set
                return (
                  <div key={`${c}${row}`}
                    className="aspect-square flex items-center justify-center rounded-md text-sm font-bold transition-all duration-500"
                    style={{
                      background: isCalled ? `${COL_COLOR[c]}22` : 'transparent',
                      color: isCalled ? COL_COLOR[c] : '#2a2a3e',
                      boxShadow: isCalled ? `0 0 8px ${COL_COLOR[c]}44` : 'none',
                    }}>
                    {n}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes numberIn {
          0% { opacity: 0; transform: scale(0.5) translateY(40px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
