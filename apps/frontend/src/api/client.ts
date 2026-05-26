const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
    post<{ uuid: string; houseId: string; houseName: string; accessToken: string }>('/api/auth/login', { username, password }),

  register: (username: string, password: string, houseName: string) =>
    post<{ uuid: string; houseId: string; accessToken: string }>('/api/auth/register', { username, password, houseName, role: 'OWNER' }),

  createRoom: (token: string, pattern = 'ROW', intervalSeconds = 6) =>
    post<{ code: string; houseName: string; pattern: string; intervalSeconds: number }>('/api/rooms', { pattern, intervalSeconds }, token),

  getRoom: (code: string) =>
    get<{ code: string; houseName: string; state: string; pattern: string; calledNumbers: number[]; playerCount: number }>(`/api/rooms/${code}`),
};
