import Seo from '../components/Seo.jsx'
import { site } from '../siteConfig.js'

// Template written for the early-access site. Have it reviewed (and update the contact
// details in siteConfig.js) before launch. It is not legal advice.
export default function Privacy() {
  return (
    <div className="container section legal">
      <Seo path="/privacy" />
      <h1>Privacy Policy</h1>
      <p>Last updated: {site.legalUpdated}</p>

      <p>
        {site.name} is an independent attendance-tracking tool made by a student for students of {site.college}.
        This policy explains what we collect on this website, why, and the choices you have. We aim to collect as
        little as possible.
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        {site.name} is run by an individual student developer. For any privacy question or request, write to{' '}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Early-access form:</strong> your name and email address, and the fact that you agreed to be
          contacted. We use them only to tell you when {site.name} opens.
        </li>
        <li>
          <strong>Basic server logs:</strong> IP address, browser type and request time, kept briefly for security
          and to stop abuse such as spam submissions.
        </li>
        <li>
          <strong>Analytics (only if you accept):</strong> anonymised usage data such as pages visited, approximate
          location and device type, collected by Google Analytics.
        </li>
        <li>
          <strong>Your cookie choice:</strong> a small note in your browser remembering whether you accepted or
          rejected analytics.
        </li>
      </ul>
      <p>
        When the full {site.name} application launches, this policy will be updated to describe the account and
        attendance data you enter. We do not and will not access your college's official attendance systems.
      </p>

      <h2>3. Why we use it (lawful basis)</h2>
      <p>
        We process your information with your consent, which you give by ticking the form box or accepting analytics.
        You can withdraw consent at any time. Security logs are kept for our legitimate interest in protecting the site.
      </p>

      <h2 id="cookies">4. Cookies and similar storage</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Purpose</th><th>Type</th><th>Set when</th></tr>
          </thead>
          <tbody>
            <tr><td>attendease-consent</td><td>Remembers your cookie choice</td><td>Essential, stored in your browser</td><td>You choose</td></tr>
            <tr><td>_ga, _ga_*</td><td>Google Analytics: counts visits and pages</td><td>Analytics</td><td>Only after you accept</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Analytics does not load until you accept. Use "Cookie settings" in the footer to change your mind at any
        time. You can also clear cookies in your browser settings.
      </p>

      <h2>5. Who we share it with</h2>
      <ul>
        <li>Google, for analytics, only if you accept it.</li>
        <li>Our hosting and database providers, who store data on our behalf.</li>
      </ul>
      <p>We do not sell your information or use it for advertising. These providers may process data outside India.</p>

      <h2>6. How long we keep it</h2>
      <p>
        Early-access details are kept until {site.name} launches and you have been notified, or until you ask us to
        delete them, whichever is first. Server logs are kept for a short period for security.
      </p>

      <h2>7. Security</h2>
      <p>
        The site is served over HTTPS and we limit who can access stored data. No system is perfectly secure, so we
        cannot promise absolute security.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Under India's Digital Personal Data Protection Act, 2023 and similar laws, you may ask to access, correct or
        erase your personal data, withdraw consent, and raise a grievance. Email us and we will respond within a
        reasonable time. If you are not satisfied, you may approach the Data Protection Board of India once it is
        operational for your complaint.
      </p>

      <h2>9. Children</h2>
      <p>
        The site is intended for college students. If you are under 18, please ask a parent or guardian before
        sharing your details.
      </p>

      <h2>10. Changes</h2>
      <p>We will post updates on this page and change the date above.</p>
    </div>
  )
}
