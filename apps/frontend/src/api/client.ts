const BASE = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;

// ── HTTP helpers ─────────────────────────────────────────────────
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

async function del<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

// ── Response types ───────────────────────────────────────────────

export interface LoginResponse {
  uuid: string; role: string;
  // Players + admin use 'token'; owners/operators use 'accessToken'
  token?: string; accessToken?: string;
  nickname?: string; houseName?: string; houseId?: string;
  refreshToken?: string;
}

export interface RoomPublicInfo {
  code: string; houseName: string; state: string;
  pattern: string; playerCount: number; calledCount: number;
  startedAt?: string; finishedAt?: string; accentColor?: string;
}

export interface GameHistoryEntry {
  roomCode: string; houseName: string; pattern: string;
  result: 'WON' | 'LOST' | 'PLAYING'; calledCount: number; ts: string;
}

export interface HouseInfo {
  houseId: string; houseName: string; ownerUuid: string;
  ownerUsername: string; phone: string; activeRooms: number;
  totalGames: number; suspended: boolean; createdAt: string; accentColor: string;
}

export interface AdminStats {
  totalHouses: number; activeRooms: number; playingRooms: number;
  waitingRooms: number; totalPlayers: number;
  operatorWindowOpen: boolean; operatorWindowExpiresAt?: string;
}

export interface InviteInfo {
  token: string; acceptUrl: string; username: string; expiresAt: string;
}

// ── API ──────────────────────────────────────────────────────────
export const api = {

  // ── Unified login (all roles) ─────────────────────────────────
  login: (username: string, password: string) =>
    post<LoginResponse>('/api/auth/login', { username, password }),

  // ── Player registration ───────────────────────────────────────
  playerRegister: (username: string, password: string, nickname: string, phone: string) =>
    post<{ uuid: string; role: string; nickname: string; token: string; refreshToken: string }>(
      '/api/auth/register', { username, password, nickname, phone }),

  // ── Operator accept invite ────────────────────────────────────
  acceptInvite: (inviteToken: string, password: string, phone: string) =>
    post<{ uuid: string; role: string; houseName: string; accessToken: string; refreshToken: string }>(
      '/api/auth/operator/accept-invite', { inviteToken, password, phone }),

  peekInvite: (token: string) =>
    get<{ houseName: string; username: string }>(`/api/owner/invite/${token}`),

  // ── Token refresh ─────────────────────────────────────────────
  refreshToken: (refreshToken: string) =>
    post<{ accessToken: string }>('/api/auth/refresh', { refreshToken }),

  // ── Auth validate (called by AuthContext on mount) ────────────
  me: (token: string) =>
    get<{ uuid: string; role: string; nickname?: string; houseName?: string; houseId?: string }>(
      '/api/auth/me', token),

  // ── Rooms ─────────────────────────────────────────────────────
  getRoom: (code: string) =>
    get<{ code: string; houseName: string; state: string; pattern: string; calledNumbers: number[]; playerCount: number; accentColor?: string }>(
      `/api/rooms/${code}`),

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
  inviteOperator: (token: string, username: string) =>
    post<InviteInfo>('/api/owner/operators/invite', { username }, token),

  getMyOperators: (token: string) =>
    get<{ uuid: string; username: string; phone: string; createdAt: string }[]>(
      '/api/owner/operators', token),

  removeOperator: (token: string, username: string) =>
    del<{ removed: boolean }>(`/api/owner/operators/${username}`, token),

  // ── Admin ─────────────────────────────────────────────────────
  getAdminStats: (token: string) =>
    get<AdminStats>('/api/admin/stats', token),

  getAdminHouses: (token: string) =>
    get<HouseInfo[]>('/api/admin/houses', token),

  createOwner: (token: string, username: string, password: string, houseName: string, phone: string) =>
    post<{ uuid: string; houseId: string; houseName: string; username: string }>(
      '/api/admin/owners', { username, password, houseName, phone }, token),

  getAdminOwners: (token: string) =>
    get<{ uuid: string; username: string; houseName: string; houseId: string; phone: string; createdAt: string }[]>(
      '/api/admin/owners', token),

  removeOwner: (token: string, username: string) =>
    del<{ removed: boolean }>(`/api/admin/owners/${username}`, token),

  suspendHouse: (token: string, houseId: string, suspended: boolean) =>
    patch<{ suspended: boolean }>(`/api/admin/houses/${houseId}/suspend`, { suspended }, token),

  openOpWindow: (token: string, minutes: number) =>
    post<{ expiresAt: string }>('/api/admin/op-window/open', { minutes }, token),

  getHealth: () =>
    get<{ status: string; redis: boolean; gameLoop: { waiting: number; active: number; delayed: number }; uptime: number; memory: number }>('/health'),
};
