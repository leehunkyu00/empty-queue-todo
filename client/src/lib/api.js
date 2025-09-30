const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_BASE = `${API_ROOT}/api`;

function buildUrl(path, params) {
  let url = `${API_BASE}${path}`;
  if (params && typeof params === 'object') {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    if (query) {
      url += (url.includes('?') ? '&' : '?') + query;
    }
  }
  return url;
}

async function request(path, { method = 'GET', token, data, headers = {}, params } = {}) {
  const init = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (token) {
    init.headers.Authorization = `Bearer ${token}`;
  }

  if (data !== undefined) {
    init.body = JSON.stringify(data);
  }

  const response = await fetch(buildUrl(path, params), init);

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.message || 'Unexpected error';
    const error = new Error(message);
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

export const api = {
  auth: {
    register: (data) => request('/auth/register', { method: 'POST', data }),
    login: (data) => request('/auth/login', { method: 'POST', data }),
    profile: (token) => request('/auth/me', { token }),
  },
  queues: {
    fetch: (token, profileId) =>
      request('/queues', {
        token,
        params: profileId ? { profileId } : undefined,
      }),
    createTask: (token, data, profileId) =>
      request('/tasks', {
        method: 'POST',
        token,
        data,
        params: profileId ? { profileId } : undefined,
      }),
    updateTask: (token, taskId, data, profileId) =>
      request(`/tasks/${taskId}`, {
        method: 'PATCH',
        token,
        data,
        params: profileId ? { profileId } : undefined,
      }),
    completeTask: (token, taskId, profileId) =>
      request(`/tasks/${taskId}/complete`, {
        method: 'POST',
        token,
        params: profileId ? { profileId } : undefined,
      }),
    reopenTask: (token, taskId, profileId) =>
      request(`/tasks/${taskId}/reopen`, {
        method: 'POST',
        token,
        params: profileId ? { profileId } : undefined,
      }),
    deleteTask: (token, taskId, profileId) =>
      request(`/tasks/${taskId}`, {
        method: 'DELETE',
        token,
        params: profileId ? { profileId } : undefined,
      }),
    reorder: (token, data, profileId) => {
      const payload = { ...data };
      if (profileId) {
        payload.profileId = profileId;
      }
      return request('/queues/reorder', {
        method: 'POST',
        token,
        data: payload,
      });
    },
  },
  progress: {
    dashboard: (token, profileId) =>
      request('/dashboard', {
        token,
        params: profileId ? { profileId } : undefined,
      }),
    history: (token, profileId, days) =>
      request('/history', {
        token,
        params: {
          profileId,
          days,
        },
      }),
  },
  household: {
    list: (token) => request('/household', { token }),
    create: (token, data) => request('/household', { method: 'POST', token, data }),
    update: (token, profileId, data) =>
      request(`/household/${profileId}`, { method: 'PATCH', token, data }),
    remove: (token, profileId) =>
      request(`/household/${profileId}`, { method: 'DELETE', token }),
  },
  coins: {
    list: (token, profileId) =>
      request('/coins', {
        token,
        params: profileId ? { profileId } : undefined,
      }),
    spend: (token, data) => request('/coins/spend', { method: 'POST', token, data }),
  },
};
