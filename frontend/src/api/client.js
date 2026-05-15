const base = import.meta.env.VITE_API_URL ?? '';

export function getToken() {
  return localStorage.getItem('ttm_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('ttm_token', token);
  else localStorage.removeItem('ttm_token');
}

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${base}${path}`;
  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message || data?.errors?.[0]?.msg || res.statusText;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
