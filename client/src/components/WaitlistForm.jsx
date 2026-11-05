import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { site } from '../siteConfig.js'
import { trackEvent } from '../lib/analytics.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validate({ name, email, agreed }) {
  const errors = {}
  if (!name.trim()) errors.name = 'Please enter your name.'
  else if (name.trim().length > 80) errors.name = 'Name must be 80 characters or fewer.'
  if (!email.trim()) errors.email = 'Please enter your email address.'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'That email address does not look right.'
  if (!agreed) errors.agreed = 'Please tick the box so we can email you about AttendEase.'
  return errors
}

export default function WaitlistForm() {
  const [values, setValues] = useState({ name: '', email: '', agreed: false, website: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [turnstileToken, setTurnstileToken] = useState('')
  const [formToken, setFormToken] = useState('') // signed timestamp from the server (anti-spam)
  const widgetRef = useRef(null)

  useEffect(() => {
    fetch('/api/form-token')
      .then((r) => r.json())
      .then((d) => setFormToken(d.token || ''))
      .catch(() => {}) // the submit handler reports a clear error if this is still missing
  }, [])

  // Optional Cloudflare Turnstile (only if a public site key is configured).
  useEffect(() => {
    if (!site.turnstileSiteKey || !widgetRef.current) return
    const render = () => window.turnstile?.render(widgetRef.current, {
      sitekey: site.turnstileSiteKey,
      callback: setTurnstileToken,
      'expired-callback': () => setTurnstileToken(''),
    })
    if (window.turnstile) { render(); return }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = render
    document.head.appendChild(s)
  }, [])

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setValues((v) => ({ ...v, [field]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return
    if (site.turnstileSiteKey && !turnstileToken) {
      setStatus({ state: 'error', message: 'Please complete the human check first.' })
      return
    }

    setStatus({ state: 'sending', message: '' })
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          agreed: values.agreed,
          website: values.website, // honeypot, must stay empty
          formToken,
          turnstileToken,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors)
        setStatus({ state: 'error', message: data.message || 'Something went wrong. Please try again.' })
        return
      }
      setStatus({ state: 'success', message: data.message || 'You are on the list. Thank you!' })
      trackEvent('generate_lead', { method: 'early_access_form' })
      setValues({ name: '', email: '', agreed: false, website: '' })
    } catch {
      setStatus({ state: 'error', message: 'Could not reach the server. Check your connection and try again.' })
    }
  }

  if (status.state === 'success') {
    return <p className="status ok" role="status">{status.message}</p>
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" type="text" autoComplete="name" value={values.name} onChange={update('name')}
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-err' : undefined} maxLength={80} />
        {errors.name && <p className="error" id="name-err">{errors.name}</p>}
      </div>

      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" value={values.email} onChange={update('email')}
          aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-err' : undefined} maxLength={254} />
        {errors.email && <p className="error" id="email-err">{errors.email}</p>}
      </div>

      {/* Honeypot field: real people never see or fill this. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={update('website')} />
      </div>

      <div className="field">
        <label className="check" htmlFor="agreed">
          <input id="agreed" type="checkbox" checked={values.agreed} onChange={update('agreed')}
            aria-invalid={Boolean(errors.agreed)} aria-describedby={errors.agreed ? 'agreed-err' : undefined} />
          <span>
            I agree to be emailed about AttendEase and I have read the <Link to="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        {errors.agreed && <p className="error" id="agreed-err">{errors.agreed}</p>}
      </div>

      {site.turnstileSiteKey && <div ref={widgetRef} />}

      {status.state === 'error' && <p className="status err" role="alert">{status.message}</p>}

      <button className="btn btn-primary" type="submit" disabled={status.state === 'sending'}>
        <Send size={18} aria-hidden="true" />
        {status.state === 'sending' ? 'Sending...' : 'Join the early-access list'}
      </button>
    </form>
  )
}
