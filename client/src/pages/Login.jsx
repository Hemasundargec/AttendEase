import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Field, { describedBy } from '../components/Field.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ rollNumber: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    const found = {}
    if (!values.rollNumber.trim()) found.rollNumber = 'Please enter your roll number.'
    if (!values.password) found.password = 'Please enter your password.'
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    setBusy(true)
    const res = await login({ rollNumber: values.rollNumber, password: values.password })
    setBusy(false)
    if (res.ok) {
      const dest = location.state?.from || (res.data.user.role === 'admin' ? '/admin' : '/dashboard')
      navigate(dest, { replace: true })
    } else setMessage(res.data.message || 'Could not log in.')
  }

  return (
    <div className="container section auth-wrap">
      <Seo path="/login" />
      <div className="band">
        <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.3rem)' }}>Log in</h1>
        <form className="form" onSubmit={onSubmit} noValidate>
          <Field id="rollNumber" label="Roll number" error={errors.rollNumber}>
            <input id="rollNumber" type="text" autoComplete="username" autoCapitalize="characters" value={values.rollNumber} onChange={set('rollNumber')}
              aria-invalid={Boolean(errors.rollNumber)} aria-describedby={describedBy('rollNumber', errors.rollNumber)} />
          </Field>
          <Field id="password" label="Password" error={errors.password}>
            <input id="password" type="password" autoComplete="current-password" value={values.password} onChange={set('password')}
              aria-invalid={Boolean(errors.password)} aria-describedby={describedBy('password', errors.password)} />
          </Field>
          {message && <p className="status err" role="alert">{message}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        </form>
        <p style={{ marginTop: 20 }}>New here? <Link to="/register">Create an account</Link></p>
      </div>
    </div>
  )
}
