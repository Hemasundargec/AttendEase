import { useState } from 'react'
import Seo from '../components/Seo.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import { useApi } from '../hooks.js'
import { fmtPercent } from '../lib/format.js'

function SafeLeaveText({ r, target }) {
  if (!r.available) return <>Not available yet. No classes have been entered.</>
  if (r.belowTarget) return <>You are already below {target}%, so there are no classes you can safely miss right now.</>
  return <>You can miss up to <strong>{r.canMiss}</strong> more class{r.canMiss === 1 ? '' : 'es'} and still stay at or above {target}%.</>
}
function RecoveryText({ r, target }) {
  if (!r.available) return <>Not available yet.</>
  if (!r.reachable) return <>{target}% can no longer be reached, because even one missed class keeps you below 100%. Try a lower target.</>
  if (r.mustAttend === 0) return <>You are already at or above {target}%.</>
  return <>Attend the next <strong>{r.mustAttend}</strong> class{r.mustAttend === 1 ? '' : 'es'} in a row, without missing any, to reach {target}%.</>
}

export default function Predict() {
  const [input, setInput] = useState('75')
  const [target, setTarget] = useState('75')
  const valid = /^\d{1,3}$/.test(input) && Number(input) >= 1 && Number(input) <= 100
  const { loading, error, data } = useApi(`/api/student/attendance/predict?target=${target}`)

  const apply = (e) => { e.preventDefault(); if (valid) setTarget(String(Number(input))) }

  return (
    <div className="container section">
      <Seo path="/attendance/predict" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Attendance prediction</h1>
      <form className="card stack" onSubmit={apply} noValidate>
        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="target">Target attendance (%)</label>
          <input id="target" type="number" inputMode="numeric" min="1" max="100" step="1" value={input} onChange={(e) => setInput(e.target.value)}
            aria-invalid={!valid} aria-describedby={!valid ? 'target-err' : undefined} />
          {!valid && <p className="error" id="target-err">Enter a whole number from 1 to 100.</p>}
        </div>
        <button className="btn btn-primary" type="submit" disabled={!valid}>Calculate</button>
      </form>

      {loading && <p role="status">Calculating...</p>}
      {error && <p className="status err" role="alert">{error}</p>}

      {data && data.noData && <p className="card">Enter some attendance first. Until classes are recorded there is nothing to predict.</p>}

      {data && !data.noData && (
        <>
          <section className="card stack" aria-labelledby="agg">
            <h2 id="agg" style={{ fontSize: '1.2rem' }}>Aggregate (all subjects together)</h2>
            <p>Currently {fmtPercent(data.overall.percentage)} ({data.overall.attended} of {data.overall.conducted}). Target {data.target}%.</p>
            <p><strong>Safe leave:</strong> <SafeLeaveText r={data.overall.safeLeave} target={data.target} /></p>
            <p><strong>Recovery:</strong> <RecoveryText r={data.overall.recovery} target={data.target} /></p>
          </section>

          <section className="card" aria-labelledby="subj">
            <h2 id="subj" style={{ fontSize: '1.2rem' }}>Subject minimum ({data.subjectMinimum.target}%)</h2>
            <p className="small muted">This is a separate rule from the aggregate above. It is not combined with it.</p>
            <div className="table-wrap">
              <table className="plain">
                <thead><tr><th>Subject</th><th>Now</th><th>What you need</th></tr></thead>
                <tbody>
                  {data.subjectMinimum.subjects.map((s) => (
                    <tr key={s.code}>
                      <td>{s.name} ({s.code})</td>
                      <td>{s.percentage === null ? '-' : fmtPercent(s.percentage)}</td>
                      <td>{!s.belowMinimum ? 'At or above the minimum.' : <RecoveryText r={s.recovery} target={data.subjectMinimum.target} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <Disclaimer />
    </div>
  )
}
