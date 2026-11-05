// Optional Cloudflare Turnstile check. Active only when TURNSTILE_SECRET is set.
export async function verifyTurnstile(secret, token, remoteIp) {
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    const data = await res.json()
    return data.success === true
  } catch {
    return false // if the check cannot run, treat it as failed rather than letting bots through
  }
}
