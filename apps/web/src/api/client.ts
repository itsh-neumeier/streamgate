export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function parseJson<T>(response: Response, path: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      detail = parsed.message ?? detail;
    } catch {
      detail = body || detail;
    }
    throw new Error(`${path}: ${detail}`);
  }
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${path} liefert keine JSON-Antwort.`);
  }
  return JSON.parse(body) as T;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: token ? authHeader(token) : undefined });
  return parseJson<T>(response, path);
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? authHeader(token) : {}) },
    body: JSON.stringify(body)
  });
  return parseJson<T>(response, path);
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'DELETE', headers: token ? authHeader(token) : undefined });
  return parseJson<T>(response, path);
}
