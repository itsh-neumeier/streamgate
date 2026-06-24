const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function parseJson<T>(response: Response, path: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? 'unbekannter Content-Type';
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${path} antwortet mit HTTP ${response.status}`);
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${path} liefert ${contentType} statt JSON. API-Proxy oder Container-Version pruefen.`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${path} liefert ungueltiges JSON`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  return parseJson<T>(response, path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return parseJson<T>(response, path);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return parseJson<T>(response, path);
}
