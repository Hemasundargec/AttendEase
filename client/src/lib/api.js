// Tiny fetch wrapper. Cookies are sent automatically (same origin). Never throws:
// network failures come back as { ok: false, networkError: true } so screens can show a message.
export async function api(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    // The server (or the dev proxy in front of it) is down or crashed: say so instead of a vague failure.
    if (!res.ok && res.status >= 500 && !data.message) {
      data.message = 'The server is not responding. If you are running AttendEase on your computer, start it with "npm run dev:server", then try again.'
    }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, networkError: true, data: { message: 'Could not reach the server. Check your connection and try again.' } }
  }
}
