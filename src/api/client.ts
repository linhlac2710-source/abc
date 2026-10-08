class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

// Ensure all API calls route through the relative '/api' endpoint on the current origin.
// Discard any obsolete localhost:8000 or 127.0.0.1 URLs from local development environment variables.
function resolveApiBase(): string {
  const raw = (import.meta as any)?.env?.VITE_API_BASE_URL;
  if (!raw || typeof raw !== 'string') return '/api';
  if (raw.includes('localhost') || raw.includes('127.0.0.1')) return '/api';
  return raw.replace(/\/+$/, '');
}

const API_BASE: string = resolveApiBase();

const TOKEN_STORAGE_KEY = 'smart_classroom_token';

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function buildQuery(q?: QueryParams) {
  if (!q) return '';
  const parts: string[] = [];
  Object.keys(q).forEach((k) => {
    const v = (q as any)[k];
    if (v === undefined || v === null) return;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

async function request<T>(
  method: string,
  path: string,
  options: { query?: QueryParams; body?: any; headers?: Record<string, string> } = {}
): Promise<T> {
  const url = `${API_BASE}${path}${buildQuery(options.query)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = undefined;
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    data = undefined;
  } else if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    // Try to extract a helpful message
    let msg: string = res.statusText;
    if (data && typeof data === 'object') {
      msg = data.detail || data.message || JSON.stringify(data);
    } else if (typeof data === 'string' && data.length > 0 && data.length < 200) {
      msg = data;
    }
    if (res.status === 401 && !path.includes('/auth/login')) {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent('smart-classroom:unauthorized'));
    }
    throw new ApiError(res.status, String(msg || `Lỗi yêu cầu (${res.status})`), data);
  }

  return data as T;
}

const api = {
  get: <T>(path: string, query?: QueryParams) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: any) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: any) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: any) => request<T>('PATCH', path, { body }),
  del: <T>(path: string, body?: any) => request<T>('DELETE', path, { body }),
  ApiError,
  setAuthToken,
  getAuthToken,
  API_BASE,
};

export default api;
