import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Field, { describedBy } from '../components/Field.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

const EMPTY = { name: '', rollNumber: '', college: '', regulation: '', branch: '', year: '', semester: '', password: '', confirmPassword: '' }

// Same rules as the server (the server re-checks everything; this just gives faster feedback).
function check(v) {
  const e = {}
  if (!v.name.trim()) e.name = 'Please enter your full name.'
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{3,28}[A-Za-z0-9]$/.test(v.rollNumber.trim())) e.rollNumber = 'Roll number should be 5 to 30 letters or digits.'
  if (!v.college) e.college = 'Please choose your college.'
  if (!v.regulation) e.regulation = 'Please choose your regulation.'
  if (!v.branch) e.branch = 'Please choose your branch.'
  if (!v.year) e.year = 'Please choose your year.'
  if (!v.semester) e.semester = 'Please choose your semester.'
  if (v.password.length < 8) e.password = 'Password must be at least 8 characters.'
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) e.password = 'Password must contain at least one letter and one number.'
  if (!e.password && v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match.'
  return e
}

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/meta/academic-options').then((res) => {
      if (!res.ok) { setOptionsError('Could not load the college options. Please refresh the page.'); return }
      setOptions(res.data)
      // Only one college and regulation today, so pre-select them.
      setValues((v) => ({
        ...v,
        college: res.data.colleges.length === 1 ? res.data.colleges[0].id : v.college,
        regulation: res.data.regulations.length === 1 ? res.data.regulations[0].id : v.regulation,
      }))
    })
  }, [])

  if (user) return <Navigate to="/dashboard" replace />

  const set = (k) => (e) => {
    const value = e.target.value
    setValues((v) => (k === 'year' ? { ...v, year: value, semester: '' } : { ...v, [k]: value })) // changing year clears semester
  }
  const aria = (k) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': describedBy(k, errors[k]) })

  const onSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    const found = check(values)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    const res = await register({ ...values, year: Number(values.year), semester: Number(values.semester) })
    setBusy(false)
    if (res.ok) { navigate('/dashboard', { replace: true }); return }
    if (res.data.fieldErrors) setErrors(res.data.fieldErrors)
    setMessage(res.data.message || 'Could not create your account.')
  }

  const semesters = values.year && options ? options.semestersByYear[values.year] : []

  return (
    <div className="container section auth-wrap">
      <Seo path="/register" />
      <div className="band">
        <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.3rem)' }}>Create your account</h1>
        {optionsError && <p className="status err" role="alert">{optionsError}</p>}
        {!options && !optionsError && <p role="status">Loading...</p>}
        {options && (
          <form className="form" onSubmit={onSubmit} noValidate>
            <Field id="name" label="Full name" error={errors.name}>
              <input id="name" type="text" autoComplete="name" maxLength={80} value={values.name} onChange={set('name')} {...aria('name')} />
            </Field>
            <Field id="rollNumber" label="College roll number" error={errors.rollNumber} hint="This is your login. It cannot be changed later.">
              <input id="rollNumber" type="text" autoComplete="username" autoCapitalize="characters" maxLength={30} value={values.rollNumber} onChange={set('rollNumber')}
                {...{ 'aria-invalid': Boolean(errors.rollNumber), 'aria-describedby': describedBy('rollNumber', errors.rollNumber, true) }} />
            </Field>
            <Field id="college" label="College" error={errors.college}>
              <select id="college" value={values.college} onChange={set('college')} {...aria('college')}>
                <option value="">Choose...</option>
                {options.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="two-col">
              <Field id="regulation" label="Regulation" error={errors.regulation}>
                <select id="regulation" value={values.regulation} onChange={set('regulation')} {...aria('regulation')}>
                  <option value="">Choose...</option>
                  {options.regulations.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field id="branch" label="Branch" error={errors.branch}>
                <select id="branch" value={values.branch} onChange={set('branch')} {...aria('branch')}>
                  <option value="">Choose...</option>
                  {options.branches.map((b) => <option key={b.id} value={b.id}>{b.id} - {b.name}</option>)}
                </select>
              </Field>
              <Field id="year" label="Year of study" error={errors.year}>
                <select id="year" value={values.year} onChange={set('year')} {...aria('year')}>
                  <option value="">Choose...</option>
                  {options.years.map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </Field>
              <Field id="semester" label="Semester" error={errors.semester}>
                <select id="semester" value={values.semester} onChange={set('semester')} disabled={!values.year} {...aria('semester')}>
                  <option value="">{values.year ? 'Choose...' : 'Pick a year first'}</option>
                  {semesters.map((s) => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </Field>
            </div>
            <Field id="password" label="Password" error={errors.password} hint="At least 8 characters with a letter and a number.">
              <input id="password" type="password" autoComplete="new-password" value={values.password} onChange={set('password')}
                {...{ 'aria-invalid': Boolean(errors.password), 'aria-describedby': describedBy('password', errors.password, true) }} />
            </Field>
            <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
              <input id="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} {...aria('confirmPassword')} />
            </Field>
            <p className="small">By creating an account you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>
            {message && <p className="status err" role="alert">{message}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
          </form>
        )}
        <p style={{ marginTop: 20 }}>Already registered? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  )
}
