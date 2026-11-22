const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export function getAuthToken() {
  return localStorage.getItem('nexusflow-token');
}

export function saveAuthToken(token) {
  localStorage.setItem('nexusflow-token', token);
}

export function apiGet(path) {
  return request(path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export function apiPut(path, body) {
  return request(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export function apiDelete(path) {
  return request(path, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export default request;
