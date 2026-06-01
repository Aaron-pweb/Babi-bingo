import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type UserRole = 'PLAYER' | 'OPERATOR' | 'OWNER' | 'ADMIN';

interface AuthState {
  token:        string | null;
  uuid:         string | null;
  role:         UserRole | null;
  username:     string | null;
  nickname:     string | null;   // players
  houseName:    string | null;   // owners / operators
  houseId:      string | null;
  refreshToken: string | null;
}

interface AuthCtx extends AuthState {
  authLoading: boolean;  // true while validating token on mount
  isAuthenticated: boolean;
  setSession: (data: {
    uuid: string; token: string; role: UserRole;
    nickname?: string; houseName?: string; houseId?: string;
    username?: string; refreshToken?: string;
  }) => void;
  updateToken:  (token: string) => void;
  clearAll:     () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

const KEYS = {
  token:        'bb_token',
  uuid:         'bb_uuid',
  role:         'bb_role',
  username:     'bb_username',
  nickname:     'bb_nickname',
  houseName:    'bb_house_name',
  houseId:      'bb_house_id',
  refreshToken: 'bb_refresh',
} as const;

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
    v != null ? localStorage.setItem(k, v) : localStorage.removeItem(k);
  if (s.token        !== undefined) set(KEYS.token,        s.token);
  if (s.uuid         !== undefined) set(KEYS.uuid,         s.uuid);
  if (s.role         !== undefined) set(KEYS.role,         s.role);
  if (s.username     !== undefined) set(KEYS.username,     s.username);
  if (s.nickname     !== undefined) set(KEYS.nickname,     s.nickname);
  if (s.houseName    !== undefined) set(KEYS.houseName,    s.houseName);
  if (s.houseId      !== undefined) set(KEYS.houseId,      s.houseId);
  if (s.refreshToken !== undefined) set(KEYS.refreshToken, s.refreshToken);
}

const BASE = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth]             = useState<AuthState>(readStorage);
  const [authLoading, setAuthLoading] = useState<boolean>(!!localStorage.getItem(KEYS.token));

  // ── On mount: validate stored token with GET /api/auth/me ──────
  useEffect(() => {
    const storedToken = localStorage.getItem(KEYS.token);
    if (!storedToken) { setAuthLoading(false); return; }

    fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('invalid');
        const data = await res.json() as {
          uuid: string; role: UserRole;
          nickname?: string; houseName?: string; houseId?: string;
        };
        // Refresh state from server — role is authoritative
        const patch: Partial<AuthState> = {
          uuid:      data.uuid,
          role:      data.role,
          nickname:  data.nickname  ?? null,
          houseName: data.houseName ?? null,
          houseId:   data.houseId   ?? null,
        };
        saveStorage(patch);
        setAuth((prev) => ({ ...prev, ...patch }));
      })
      .catch(() => {
        // Token invalid/expired — clear everything
        Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
        setAuth({ token: null, uuid: null, role: null, username: null, nickname: null, houseName: null, houseId: null, refreshToken: null });
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const update = useCallback((patch: Partial<AuthState>) => {
    saveStorage(patch);
    setAuth((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Unified session setter (replaces setPlayerSession / setOpSession / setAdminSession) ──
  const setSession = useCallback((data: {
    uuid: string; token: string; role: UserRole;
    nickname?: string; houseName?: string; houseId?: string;
    username?: string; refreshToken?: string;
  }) => {
    update({
      uuid:         data.uuid,
      token:        data.token,
      role:         data.role,
      nickname:     data.nickname  ?? null,
      houseName:    data.houseName ?? null,
      houseId:      data.houseId   ?? null,
      username:     data.username  ?? null,
      refreshToken: data.refreshToken ?? null,
    });
  }, [update]);

  const updateToken = useCallback((token: string) => update({ token }), [update]);

  const clearAll = useCallback(() => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    setAuth({ token: null, uuid: null, role: null, username: null, nickname: null, houseName: null, houseId: null, refreshToken: null });
  }, []);

  return (
    <AuthContext.Provider value={{
      ...auth, authLoading, isAuthenticated: !!auth.token && !!auth.role,
      setSession, updateToken, clearAll,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
