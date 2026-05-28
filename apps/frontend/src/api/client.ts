const BASE = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;

// ── HTTP helpers ────────────────────────────────────────────────
async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

async function get<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

async function patch<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

// ── Response types ──────────────────────────────────────────────
export interface RoomPublicInfo {
  code: string; houseName: string; state: string;
  pattern: string; playerCount: number; calledCount: number;
  startedAt?: string; finishedAt?: string;
  accentColor?: string;
}

export interface GameHistoryEntry {
  roomCode: string; houseName: string; pattern: string;
  result: 'WON' | 'LOST' | 'PLAYING'; calledCount: number; ts: string;
}

export interface HouseInfo {
  houseId: string; houseName: string; ownerUuid: string;
  ownerUsername: string; activeRooms: number; totalGames: number;
  suspended: boolean; createdAt: string; accentColor: string;
}

export interface AdminStats {
  totalHouses: number; activeRooms: number; playingRooms: number;
  waitingRooms: number; totalPlayers: number;
  operatorWindowOpen: boolean; operatorWindowExpiresAt?: string;
}

// ── API ─────────────────────────────────────────────────────────
export const api = {

  // ── Auth: Owner/Operator ──────────────────────────────────────
  login: (username: string, password: string) =>
    post<{ uuid: string; houseId: string; houseName: string; role: string; accessToken: string; refreshToken: string }>(
      '/api/auth/login', { username, password }),

  register: (username: string, password: string, houseName: string) =>
    post<{ uuid: string; houseId: string; accessToken: string; refreshToken?: string }>(
      '/api/auth/register', { username, password, houseName, role: 'OWNER' }),

  refreshToken: (refreshToken: string) =>
    post<{ accessToken: string }>('/api/auth/refresh', { refreshToken }),

  // ── Auth: Player ──────────────────────────────────────────────
  playerRegister: (username: string, password: string, nickname: string) =>
    post<{ uuid: string; token: string; refreshToken: string }>(
      '/api/auth/player/register', { username, password, nickname }),

  playerLogin: (username: string, password: string) =>
    post<{ uuid: string; token: string; nickname: string; refreshToken: string }>(
      '/api/auth/player/login', { username, password }),

  guestToken: (nickname: string) =>
    post<{ uuid: string; token: string }>('/api/auth/guest', { nickname }),

  // ── Auth: Operator (time-window) ──────────────────────────────
  checkOpWindow: () =>
    get<{ open: boolean; expiresAt?: string }>('/api/admin/op-window'),

  registerOperator: (username: string, password: string, houseId: string) =>
    post<{ uuid: string; accessToken: string; refreshToken: string }>(
      '/api/auth/operator/register', { username, password, houseId }),

  // ── Rooms ──────────────────────────────────────────────────────
  getRoom: (code: string) =>
    get<{ code: string; houseName: string; state: string; pattern: string; calledNumbers: number[]; playerCount: number; accentColor?: string }>(`/api/rooms/${code}`),

  createRoom: (token: string, pattern = 'ROW', intervalSeconds = 6) =>
    post<{ code: string; houseName: string; pattern: string; intervalSeconds: number }>(
      '/api/rooms', { pattern, intervalSeconds }, token),

  getPublicRooms: () =>
    get<{ playing: RoomPublicInfo[]; waiting: RoomPublicInfo[]; recent: RoomPublicInfo[] }>(
      '/api/rooms/public'),

  // ── Player ────────────────────────────────────────────────────
  getMyHistory: (token: string) =>
    get<GameHistoryEntry[]>('/api/players/me/history', token),

  // ── Owner ─────────────────────────────────────────────────────
  updateBranding: (token: string, houseName: string, accentColor: string) =>
    patch<{ houseName: string; accentColor: string }>('/api/owner/branding', { houseName, accentColor }, token),

  // ── Admin ─────────────────────────────────────────────────────
  adminLogin: (username: string, password: string) =>
    post<{ uuid: string; token: string }>('/api/auth/admin/login', { username, password }),

  getAdminStats: (token: string) =>
    get<AdminStats>('/api/admin/stats', token),

  getAdminHouses: (token: string) =>
    get<HouseInfo[]>('/api/admin/houses', token),

  suspendHouse: (token: string, houseId: string, suspended: boolean) =>
    patch<{ suspended: boolean }>(`/api/admin/houses/${houseId}/suspend`, { suspended }, token),

  openOpWindow: (token: string, minutes: number) =>
    post<{ expiresAt: string }>('/api/admin/op-window/open', { minutes }, token),

  getHealth: () =>
    get<{ status: string; redis: boolean; gameLoop: { waiting: number; active: number; delayed: number }; uptime: number; memory: number }>('/health'),
};
