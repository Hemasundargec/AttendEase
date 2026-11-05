import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ConsentBanner from './ConsentBanner.jsx'
import { loadAnalytics, trackPageView } from '../lib/analytics.js'
import { site } from '../siteConfig.js'

export default function Layout() {
  const { pathname, hash } = useLocation()
  const [bannerOpen, setBannerOpen] = useState(false)
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  // Start analytics on load only if the visitor already accepted earlier.
  useEffect(() => { loadAnalytics() }, [])

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
    else document.getElementById(hash.slice(1))?.scrollIntoView() // e.g. /privacy#cookies
    trackPageView(pathname)
  }, [pathname, hash])

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand">
            <img src="/favicon-32.png" width="32" height="32" alt="" />
            {site.name}
          </Link>
          <nav className="nav" aria-label="Main">
            {!user && (
              <>
                <NavLink to="/" end>Home</NavLink>
                <a href="/#features">Features</a>
                <a href="/#how-it-works">How it works</a>
              </>
            )}
            {!loading && !user && <NavLink to="/login">Log in</NavLink>}
            {user && user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            {user && user.role === 'student' && (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/timetable">Timetable</NavLink>
                <NavLink to="/attendance/mark">Mark</NavLink>
                <NavLink to="/attendance" end>Attendance</NavLink>
                <NavLink to="/attendance/predict">Prediction</NavLink>
                <NavLink to="/statistics">Statistics</NavLink>
                <NavLink to="/todos">To-do</NavLink>
                <NavLink to="/profile">Profile</NavLink>
              </>
            )}
            {user && (
              <button type="button" className="navlink-btn" onClick={async () => { await logout(); navigate('/', { replace: true }) }}>
                Log out
              </button>
            )}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms and Conditions</Link>
            <button type="button" className="link" onClick={() => setBannerOpen(true)}>
              Cookie settings
            </button>
          </div>
          <p>
            {site.name} is an independent, student-maintained tool. It is not an official record of {site.college}{' '}
            and cannot guarantee examination eligibility.
          </p>
          <p>&copy; {new Date().getFullYear()} {site.name}</p>
        </div>
      </footer>

      <ConsentBanner forceOpen={bannerOpen} onClose={() => setBannerOpen(false)} />
    </>
  )
}
