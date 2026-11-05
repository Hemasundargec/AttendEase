import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { site } from '../siteConfig.js'

// Template for the early-access site. Have it reviewed before launch. Not legal advice.
export default function Terms() {
  return (
    <div className="container section legal">
      <Seo path="/terms" />
      <h1>Terms and Conditions</h1>
      <p>Last updated: {site.legalUpdated}</p>

      <p>
        By using this website you agree to these terms. If you do not agree, please do not use it.
      </p>

      <h2>1. What {site.name} is</h2>
      <p>
        {site.name} is an independent, student-maintained tool for tracking attendance figures that students enter
        themselves. It is not affiliated with, endorsed by or connected to {site.college} or any university.
      </p>

      <h2>2. Not an official record</h2>
      <p>
        Everything {site.name} shows depends on the information entered by each student. It is not an official
        attendance record. It cannot guarantee examination eligibility, condonation or protection from detention.
        Future class counts may change, your college may apply extra rules, and official college records always
        take precedence. Please verify your attendance with your college.
      </p>

      <h2>3. Estimates and calculators</h2>
      <p>
        Percentages, safe-leave and recovery figures are mathematical estimates based on the data entered. They are
        not predictions or promises. Thresholds shown (for example 75%, 65% and 40%) reflect a configured policy and
        may differ from the rules that apply to you.
      </p>

      <h2>4. Your responsibilities</h2>
      <ul>
        <li>Enter accurate information and keep your account details private.</li>
        <li>Do not try to break, overload or gain unauthorised access to the service or other users' data.</li>
        <li>Do not use automated tools to submit forms or collect data from the site.</li>
        <li>Do not use the service for anything unlawful.</li>
      </ul>

      <h2>5. Accounts</h2>
      <p>
        When accounts are available, you are responsible for activity under yours. We may suspend accounts that
        break these terms or put others at risk.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        The {site.name} name, design and code belong to its maker. Data you enter remains yours. You may not copy or
        resell the service without permission.
      </p>

      <h2>7. Availability</h2>
      <p>
        {site.name} is provided free and "as is". It may change, pause or stop at any time, and we do not promise it
        will always be available or error-free.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for any loss, including missed exam eligibility,
        condonation fees or detention, arising from use of or reliance on {site.name}. Nothing here limits liability
        that cannot be limited by law.
      </p>

      <h2>9. Privacy</h2>
      <p>Our <Link to="/privacy">Privacy Policy</Link> explains how we handle your information.</p>

      <h2>10. Changes and governing law</h2>
      <p>
        We may update these terms and will change the date above. Continued use means you accept the update. These
        terms are governed by the laws of India, and courts in Andhra Pradesh will have jurisdiction, subject to any
        rights you have under law.
      </p>

      <h2>11. Contact</h2>
      <p>Questions? Email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</p>
    </div>
  )
}
