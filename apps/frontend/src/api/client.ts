// Dynamically use the current hostname (e.g. 10.13.14.210 on mobile) to reach the backend
const BASE = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;

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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json as T;
}

export const api = {
  guestToken: (nickname: string) =>
    post<{ uuid: string; token: string }>('/api/auth/guest', { nickname }),

  login: (username: string, password: string) =>
    post<{ uuid: string; houseId: string; houseName: string; accessToken: string; refreshToken: string }>('/api/auth/login', { username, password }),

  register: (username: string, password: string, houseName: string) =>
    post<{ uuid: string; houseId: string; accessToken: string; refreshToken?: string }>('/api/auth/register', { username, password, houseName, role: 'OWNER' }),

  // C5: Refresh expired operator access token
  refreshToken: (refreshToken: string) =>
    post<{ accessToken: string }>('/api/auth/refresh', { refreshToken }),

  createRoom: (token: string, pattern = 'ROW', intervalSeconds = 6) =>
    post<{ code: string; houseName: string; pattern: string; intervalSeconds: number }>('/api/rooms', { pattern, intervalSeconds }, token),

  getRoom: (code: string) =>
    get<{ code: string; houseName: string; state: string; pattern: string; calledNumbers: number[]; playerCount: number }>(`/api/rooms/${code}`),
};
