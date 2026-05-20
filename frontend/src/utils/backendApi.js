const API_BASE = (import.meta.env.VITE_ECOMON_API_URL || '/api').replace(/\/$/, '');

async function requestJson(path, options = {}) {
  const hasBody = options.body !== undefined && options.body !== null;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Backend request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function fetchCatalog() {
  return requestJson('/catalog');
}

export function fetchGameState() {
  return requestJson('/state');
}

export function confirmScan(cardId) {
  return requestJson('/confirm', {
    method: 'POST',
    body: JSON.stringify({ cardId })
  });
}

export function resetGameState() {
  return requestJson('/reset', {
    method: 'POST'
  });
}