import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getConsent, setConsent } from '../lib/analytics.js'
import { site } from '../siteConfig.js'

// Accept and Reject are equally easy to reach. Nothing optional loads before "Accept".
export default function ConsentBanner({ forceOpen, onClose }) {
  const [undecided, setUndecided] = useState(false)

  useEffect(() => { setUndecided(getConsent() === null) }, [])

  const visible = undecided || forceOpen
  if (!visible) return null

  const choose = (value) => {
    setConsent(value)
    setUndecided(false)
    onClose()
  }

  return (
    <section className="consent" role="dialog" aria-labelledby="consent-title" aria-live="polite">
      <h2 id="consent-title" style={{ fontSize: '1.1rem', marginBottom: 8 }}>Cookies and analytics</h2>
      <p>
        {site.name} uses essential storage to remember this choice. With your permission we also use Google
        Analytics to see which pages are useful, with IP anonymisation turned on. Read the{' '}
        <Link to="/privacy#cookies">Privacy Policy</Link> for details.
      </p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => choose('accepted')}>Accept analytics</button>
        <button type="button" className="btn btn-quiet" onClick={() => choose('rejected')}>Reject</button>
      </div>
    </section>
  )
}
