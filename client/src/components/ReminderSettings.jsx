import { useEffect, useState } from 'react'
import Field from './Field.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { api } from '../lib/api.js'

// Email reminders. Everything shown here comes from the server, including whether email can really be sent.
export default function ReminderSettings() {
  const [state, setState] = useState(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [codeAsked, setCodeAsked] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const load = async () => { const r = await api('/api/student/reminders'); if (r.ok) setState(r.data); else setMsg({ kind: 'err', text: r.data.message || 'Could not load reminder settings.' }) }
  useEffect(() => { load() }, [])

  const sendCode = async (e) => {
    e.preventDefault(); setMsg(null); setErrors({})
    if (!email.trim()) { setErrors({ email: 'Please enter your email address.' }); return }
    setBusy(true)
    const r = await api('/api/student/email', { method: 'POST', body: { email } })
    setBusy(false)
    if (r.data.fieldErrors) { setErrors(r.data.fieldErrors); return }
    setCodeAsked(Boolean(r.data.sent))
    setMsg({ kind: r.data.sent ? 'ok' : 'err', text: r.data.message || 'Something went wrong. Please try again.' })
  }

  const verify = async (e) => {
    e.preventDefault(); setMsg(null); setErrors({})
    if (!/^\d{6}$/.test(code.trim())) { setErrors({ code: 'Enter the 6-digit code from the email.' }); return }
    setBusy(true)
    const r = await api('/api/student/email/verify', { method: 'POST', body: { code: code.trim() } })
    setBusy(false)
    if (r.ok) { setCode(''); setEmail(''); setCodeAsked(false); setMsg({ kind: 'ok', text: r.data.message }); load() } else setMsg({ kind: 'err', text: r.data.message || 'Could not verify the code.' })
  }

  const toggle = async (enabled) => {
    setMsg(null)
    setState((s) => ({ ...s, enabled })) // optimistic
    const r = await api('/api/student/reminders', { method: 'PUT', body: { enabled } })
    if (!r.ok) { setMsg({ kind: 'err', text: r.data.message || 'Could not change reminders.' }); load() } else setMsg({ kind: 'ok', text: r.data.message })
  }

  const remove = async () => {
    setBusy(true); const r = await api('/api/student/email', { method: 'DELETE' }); setBusy(false); setConfirmRemove(false)
    if (r.ok) { setMsg({ kind: 'ok', text: r.data.message }); load() } else setMsg({ kind: 'err', text: r.data.message || 'Could not remove the email.' })
  }

  const Msg = () => msg && <p className={`status ${msg.kind === 'ok' ? 'ok' : 'err'}`} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>

  return (
    <section className="card" aria-labelledby="p-rem">
      <h2 id="p-rem" style={{ fontSize: '1.2rem' }}>Reminders</h2>
      {!state && <p role="status">Loading...</p>}
      {state && (
        <div className="stack">
          <p className="small muted">
            Get an email at 5:00 PM if you have not entered today's attendance, and again at 8:00 PM and 10:00 PM only if it is still missing.
            They stop as soon as today is complete{state.skipsSundays ? ' and are not sent on Sundays' : ''}. Times are India time. If there were no classes, enter 0 and 0 and you will not be reminded.
          </p>
          {state.emailDelivery === 'not_configured' && (
            <p className="status err" role="note">Email sending is not set up on this server yet, so reminders and codes cannot be emailed until an administrator configures it.</p>
          )}

          {state.emailVerified ? (
            <>
              <p>Reminders go to <strong>{state.email}</strong> (verified).</p>
              <label className="check" htmlFor="rem-on">
                <input id="rem-on" type="checkbox" checked={state.enabled} onChange={(e) => toggle(e.target.checked)} />
                <span>Send me reminders</span>
              </label>
              <Msg />
              <button type="button" className="btn btn-quiet small-btn" onClick={() => setConfirmRemove(true)}>Remove email</button>
            </>
          ) : (
            <>
              <form className="form" onSubmit={sendCode} noValidate>
                <Field id="rem-email" label="Email address" error={errors.email} hint="We only use it for reminders. We will email a code to confirm it is yours.">
                  <input id="rem-email" type="email" autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
                </Field>
                <button className="btn btn-primary" type="submit" disabled={busy}>{state.pendingEmail || codeAsked ? 'Send a new code' : 'Send code'}</button>
              </form>
              {(codeAsked || state.pendingEmail) && (
                <form className="form" onSubmit={verify} noValidate>
                  <Field id="rem-code" label={`6-digit code${state.pendingEmail ? ` sent to ${state.pendingEmail}` : ''}`} error={errors.code}>
                    <input id="rem-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={Boolean(errors.code)} />
                  </Field>
                  <button className="btn btn-primary" type="submit" disabled={busy}>Verify and turn on reminders</button>
                </form>
              )}
              <Msg />
            </>
          )}
        </div>
      )}
      <ConfirmDialog open={confirmRemove} title="Remove your email?" confirmLabel="Remove email" busy={busy} onConfirm={remove} onCancel={() => setConfirmRemove(false)}>
        <p>Reminders will be turned off. You can add an email again later.</p>
      </ConfirmDialog>
    </section>
  )
}
