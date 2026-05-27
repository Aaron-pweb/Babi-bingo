import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ─────────────────────────────────────────────
//  L5: Auth Context
//  Single source of truth for auth state.
//  All views consume useAuth() instead of raw localStorage.
//  Backed by localStorage so sessions survive page refresh.
// ─────────────────────────────────────────────

interface AuthState {
  // Player session
  playerToken: string | null;
  playerUuid: string | null;
  playerNickname: string | null;
  // Operator session
  opToken: string | null;
  opRefreshToken: string | null;
}

interface AuthCtx extends AuthState {
  /** Called after a successful guest token response */
  setPlayerSession: (uuid: string, token: string, nickname: string) => void;
  /** Called after a successful operator login/register */
  setOpSession: (accessToken: string, refreshToken?: string) => void;
  /** Clears both sessions (called on logout or auth error) */
  clearAll: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

function readStorage(): AuthState {
  return {
    playerToken:    localStorage.getItem('player_token'),
    playerUuid:     localStorage.getItem('player_uuid'),
    playerNickname: localStorage.getItem('player_nickname'),
    opToken:        localStorage.getItem('op_token'),
    opRefreshToken: localStorage.getItem('op_refresh'),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(readStorage);

  const setPlayerSession = useCallback((uuid: string, token: string, nickname: string) => {
    localStorage.setItem('player_uuid', uuid);
    localStorage.setItem('player_token', token);
    localStorage.setItem('player_nickname', nickname);
    setAuth((prev) => ({ ...prev, playerUuid: uuid, playerToken: token, playerNickname: nickname }));
  }, []);

  const setOpSession = useCallback((accessToken: string, refreshToken?: string) => {
    localStorage.setItem('op_token', accessToken);
    if (refreshToken) localStorage.setItem('op_refresh', refreshToken);
    setAuth((prev) => ({ ...prev, opToken: accessToken, opRefreshToken: refreshToken ?? prev.opRefreshToken }));
  }, []);

  const clearAll = useCallback(() => {
    ['player_token', 'player_uuid', 'player_nickname', 'op_token', 'op_refresh'].forEach((k) =>
      localStorage.removeItem(k)
    );
    setAuth({ playerToken: null, playerUuid: null, playerNickname: null, opToken: null, opRefreshToken: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, setPlayerSession, setOpSession, clearAll }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook for accessing auth state and actions from any component */
export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
