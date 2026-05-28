import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type UserRole = 'PLAYER' | 'OPERATOR' | 'OWNER' | 'ADMIN';

interface AuthState {
  token: string | null;
  uuid: string | null;
  role: UserRole | null;
  username: string | null;
  nickname: string | null;   // players
  houseName: string | null;  // owners / operators
  houseId: string | null;
  refreshToken: string | null;
}

interface AuthCtx extends AuthState {
  setPlayerSession: (uuid: string, token: string, nickname: string, refreshToken?: string) => void;
  setOpSession: (uuid: string, token: string, role: UserRole, houseName: string, houseId: string, refreshToken?: string) => void;
  setAdminSession: (uuid: string, token: string) => void;
  updateToken: (token: string) => void;
  clearAll: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

const KEYS = {
  token: 'bb_token', uuid: 'bb_uuid', role: 'bb_role', username: 'bb_username',
  nickname: 'bb_nickname', houseName: 'bb_house_name', houseId: 'bb_house_id',
  refreshToken: 'bb_refresh',
};

function readStorage(): AuthState {
  return {
    token:        localStorage.getItem(KEYS.token),
    uuid:         localStorage.getItem(KEYS.uuid),
    role:         localStorage.getItem(KEYS.role) as UserRole | null,
    username:     localStorage.getItem(KEYS.username),
    nickname:     localStorage.getItem(KEYS.nickname),
    houseName:    localStorage.getItem(KEYS.houseName),
    houseId:      localStorage.getItem(KEYS.houseId),
    refreshToken: localStorage.getItem(KEYS.refreshToken),
  };
}

function saveStorage(s: Partial<AuthState>) {
  const set = (k: string, v: string | null | undefined) =>
    v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
  if (s.token       !== undefined) set(KEYS.token, s.token);
  if (s.uuid        !== undefined) set(KEYS.uuid, s.uuid);
  if (s.role        !== undefined) set(KEYS.role, s.role);
  if (s.username    !== undefined) set(KEYS.username, s.username);
  if (s.nickname    !== undefined) set(KEYS.nickname, s.nickname);
  if (s.houseName   !== undefined) set(KEYS.houseName, s.houseName);
  if (s.houseId     !== undefined) set(KEYS.houseId, s.houseId);
  if (s.refreshToken!== undefined) set(KEYS.refreshToken, s.refreshToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(readStorage);

  const update = useCallback((patch: Partial<AuthState>) => {
    saveStorage(patch);
    setAuth((prev) => ({ ...prev, ...patch }));
  }, []);

  const setPlayerSession = useCallback((uuid: string, token: string, nickname: string, refreshToken?: string) => {
    update({ uuid, token, role: 'PLAYER', nickname, houseName: null, houseId: null, username: null, refreshToken: refreshToken ?? null });
  }, [update]);

  const setOpSession = useCallback((uuid: string, token: string, role: UserRole, houseName: string, houseId: string, refreshToken?: string) => {
    update({ uuid, token, role, houseName, houseId, nickname: null, username: null, refreshToken: refreshToken ?? null });
  }, [update]);

  const setAdminSession = useCallback((uuid: string, token: string) => {
    update({ uuid, token, role: 'ADMIN', houseName: null, houseId: null, nickname: null, username: 'admin', refreshToken: null });
  }, [update]);

  const updateToken = useCallback((token: string) => {
    update({ token });
  }, [update]);

  const clearAll = useCallback(() => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    setAuth({ token: null, uuid: null, role: null, username: null, nickname: null, houseName: null, houseId: null, refreshToken: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, setPlayerSession, setOpSession, setAdminSession, updateToken, clearAll, isAuthenticated: !!auth.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
