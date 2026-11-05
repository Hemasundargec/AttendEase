// Email sending, with two honest modes:
//   resend - real delivery through Resend (set RESEND_API_KEY and MAIL_FROM)
//   log    - nothing is sent; the message is printed to the server log. send() says so (accepted: false).
// Callers must look at `accepted`. "accepted" means the provider took the message for delivery;
// we cannot see whether it reached the inbox.
export function createMailer({ apiKey = '', from = '', logger = console, fetchImpl = fetch } = {}) {
  if (apiKey && from) {
    return {
      mode: 'resend',
      async send({ to, subject, text }) {
        try {
          const res = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: [to], subject, text }),
          })
          if (res.ok) return { accepted: true, mode: 'resend' }
          return { accepted: false, mode: 'resend', error: `provider responded ${res.status}` }
        } catch (err) {
          return { accepted: false, mode: 'resend', error: err.message }
        }
      },
    }
  }
  return {
    mode: 'log',
    async send({ to, subject, text }) {
      logger.log(`[mail not sent: no provider configured] to=${to} subject="${subject}"\n${text}\n`)
      return { accepted: false, mode: 'log', error: 'no email provider configured' }
    },
  }
}
