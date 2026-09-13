const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : null
  if (!res.ok) {
    const err = new Error(data?.detail || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  getWallet: () => request('/wallet/'),
  setupWallet: (secret_phrase) =>
    request('/wallet/setup/', { method: 'POST', body: JSON.stringify({ secret_phrase }) }),

  getMerchants: () => request('/merchants/'),
  detectNfc: (merchant_id) =>
    request('/nfc/detect/', { method: 'POST', body: JSON.stringify(merchant_id ? { merchant_id } : {}) }),

  getChallenge: () => request('/auth/challenge/', { method: 'POST' }),
  verifyAuth: (spoken_text, challenge_number) =>
    request('/auth/verify/', {
      method: 'POST',
      body: JSON.stringify({ spoken_text, challenge_number }),
    }),

  confirmPayment: (merchant_name, amount) =>
    request('/payment/confirm/', {
      method: 'POST',
      body: JSON.stringify({ merchant_name, amount }),
    }),
  cancelPayment: (merchant_name, amount) =>
    request('/payment/cancel/', {
      method: 'POST',
      body: JSON.stringify({ merchant_name, amount }),
    }),

  receiveMoney: (sender, amount) =>
    request('/receive/', { method: 'POST', body: JSON.stringify({ sender, amount }) }),

  getTransactions: (limit) => request(`/transactions/${limit ? `?limit=${limit}` : ''}`),
}
