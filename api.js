let accessToken = null;
let refreshing = null;
let onExpired = () => {};

export const getToken = () => accessToken;
export const setSessionExpiredHandler = (fn) => {
  onExpired = fn;
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || [];
  }
}

async function send(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function parse(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong', data.details);
  return data;
}

export function refreshSession() {
  if (!refreshing) {
    refreshing = send('/auth/refresh', { method: 'POST' })
      .then(parse)
      .then((data) => {
        accessToken = data.accessToken;
        return data.user;
      })
      .catch((err) => {
        accessToken = null;
        throw err;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(path, options) {
  let res = await send(path, options);
  if (res.status === 401 && accessToken) {
    try {
      await refreshSession();
      res = await send(path, options);
    } catch {
      onExpired();
    }
  }
  return parse(res);
}

const qs = (params) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, v);
  });
  return q.toString();
};

export const api = {
  async register(payload) {
    const data = await parse(await send('/auth/register', { method: 'POST', body: payload }));
    accessToken = data.accessToken;
    return data.user;
  },
  async login(payload) {
    const data = await parse(await send('/auth/login', { method: 'POST', body: payload }));
    accessToken = data.accessToken;
    return data.user;
  },
  async logout() {
    try {
      await send('/auth/logout', { method: 'POST' });
    } finally {
      accessToken = null;
    }
  },
  students: {
    list: (params) => request(`/students?${qs(params)}`),
    stats: () => request('/students/stats'),
    get: (id) => request(`/students/${id}`),
    create: (body) => request('/students', { method: 'POST', body }),
    update: (id, body) => request(`/students/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/students/${id}`, { method: 'DELETE' }),
  },
};
