import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'

export default function NotFound() {
  return (
    <div className="container notfound">
      <Seo path="/404" />
      <p className="code" aria-hidden="true">404</p>
      <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)' }}>We could not find that page</h1>
      <p>The link may be old or mistyped. Let's get you back on track.</p>
      <Link className="btn btn-primary" to="/">Back to the home page</Link>
    </div>
  )
}
