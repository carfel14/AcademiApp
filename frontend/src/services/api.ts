const base = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const key = "academiapp-session";

export function getToken() {
  return sessionStorage.getItem(key);
}

export function setToken(token?: string) {
  if (token) sessionStorage.setItem(key, token);
  else sessionStorage.removeItem(key);
  window.dispatchEvent(new Event("academiapp-session"));
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(base + path, { ...options, headers });
  if (response.status === 401 && token && token === getToken()) setToken();
  return response;
}

export async function api<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method,
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(Array.isArray(body?.message) ? body.message.join(". ") : body?.message ?? `Error ${res.status}`);
  }
  return res.status === 204 ? undefined as T : res.json();
}
