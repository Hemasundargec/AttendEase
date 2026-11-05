import { Link } from 'react-router-dom'
import { CalendarCheck, Table2, Calculator, UserRound, BarChart3, ListChecks } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useApi } from '../hooks.js'
import { fmtPercent } from '../lib/format.js'

const TODAY_TEXT = {
  saved: ['Attendance entry saved', 'You have entered every subject for today.'],
  partial: ['Partially completed', 'Some subjects are still missing for today.'],
  not_entered: ['Not yet entered', 'You have not entered attendance for today.'],
  no_subjects: ['No subjects yet', 'No subjects are set up for your semester yet.'],
}

export default function Dashboard() {
  const { user } = useAuth()
  const { loading, error, data } = useApi('/api/student/attendance/summary')
  const o = data?.overall

  return (
    <div className="container section">
      <Seo path="/dashboard" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Hello, {user.name.split(' ')[0]}</h1>
      <p>{user.roll ?? user.rollNumber} &middot; {user.branch} &middot; Year {user.year}, Semester {user.semester} &middot; {user.regulation}</p>

      {loading && <p role="status">Loading your attendance...</p>}
      {error && <p className="status err" role="alert">{error}</p>}

      {data && (
        <>
          <section className="card stack" aria-labelledby="overall-title">
            <h2 id="overall-title" style={{ fontSize: '1.2rem' }}>Overall attendance</h2>
            {o.conducted === 0 ? (
              <p>No classes entered yet, so there is no percentage to show. Start with <Link to="/attendance/mark">Mark attendance</Link>.</p>
            ) : (
              <>
                <p className="big">{fmtPercent(o.percentage)}</p>
                <ProgressBar percent={o.percentage} label="Overall attendance" />
                <p>{o.attended} attended of {o.conducted} classes conducted ({o.missed} missed)</p>
              </>
            )}
            <StatusBadge status={o.status} />
            <p className="small muted">
              Safe at {data.policy.safePercent}% or more. Condonation range from {data.policy.condonationPercent}% up to {data.policy.safePercent}%.
              Below {data.policy.condonationPercent}% is detention risk. These are the supplied policy values, and official eligibility depends on the college's rules and records.
            </p>
            {data.subjectWarnings.length > 0 && (
              <p className="status err" role="alert">
                Subject warning: {data.subjectWarnings.join(', ')} {data.subjectWarnings.length === 1 ? 'is' : 'are'} below {data.policy.subjectMinPercent}%.
              </p>
            )}
          </section>

          <section className="card stack" aria-labelledby="today-title">
            <h2 id="today-title" style={{ fontSize: '1.2rem' }}>Today</h2>
            <p><strong>{TODAY_TEXT[data.today.state][0]}.</strong> {TODAY_TEXT[data.today.state][1]}</p>
            {data.today.subjectCount > 0 && <p className="small muted">{data.today.entered} of {data.today.subjectCount} subjects entered for {data.today.date}.</p>}
          </section>

          <nav className="quick" aria-label="Quick access">
            <Link className="card quick-card" to="/attendance/mark"><CalendarCheck size={26} aria-hidden="true" /><strong>Mark attendance</strong><span>Enter today or fix a past day</span></Link>
            <Link className="card quick-card" to="/attendance"><Table2 size={26} aria-hidden="true" /><strong>Show attendance</strong><span>Subject-wise table and history</span></Link>
            <Link className="card quick-card" to="/attendance/predict"><Calculator size={26} aria-hidden="true" /><strong>Prediction</strong><span>Classes you can miss or must attend</span></Link>
            <Link className="card quick-card" to="/statistics"><BarChart3 size={26} aria-hidden="true" /><strong>Statistics</strong><span>Trend, best and worst subject</span></Link>
            <Link className="card quick-card" to="/todos"><ListChecks size={26} aria-hidden="true" /><strong>To-do list</strong><span>Assignments, records, exams</span></Link>
            <Link className="card quick-card" to="/profile"><UserRound size={26} aria-hidden="true" /><strong>Profile</strong><span>Name, semester, password</span></Link>
          </nav>

          <section className="card" aria-labelledby="snap-title">
            <h2 id="snap-title" style={{ fontSize: '1.2rem' }}>Subjects</h2>
            {data.subjects.length === 0 ? (
              <p>No subjects have been set up for your branch and semester yet. An administrator needs to add them.</p>
            ) : (
              <div className="table-wrap">
                <table className="plain">
                  <thead><tr><th>Code</th><th>Subject</th><th>Attended</th><th>Conducted</th><th>%</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.subjects.map((s) => (
                      <tr key={s.subjectId}>
                        <td>{s.code}</td><td>{s.name}</td><td>{s.attended}</td><td>{s.conducted}</td>
                        <td>{s.percentage === null ? '-' : fmtPercent(s.percentage)}</td>
                        <td><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <Disclaimer />
        </>
      )}
    </div>
  )
}
