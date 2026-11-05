import { BarChart3, CalendarCheck, ShieldCheck, Calculator, ListChecks, Smartphone } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import WaitlistForm from '../components/WaitlistForm.jsx'
import { site } from '../siteConfig.js'

const features = [
  { icon: CalendarCheck, title: 'Daily attendance in seconds', text: 'Enter classes conducted and attended per subject. Pick any past date to correct a mistake.' },
  { icon: BarChart3, title: 'Subject-wise and overall %', text: 'See exactly where you stand in every subject and in aggregate, with clear safe, condonation and detention-risk labels.' },
  { icon: Calculator, title: 'Safe-leave and recovery maths', text: 'Know how many classes you can still miss, or how many you must attend in a row to reach your target.' },
  { icon: ListChecks, title: 'Built-in to-do list', text: 'Keep assignments, lab records and exam prep in one place next to your attendance.' },
  { icon: Smartphone, title: 'Made for your phone', text: 'Fast, readable on small screens, and works between classes.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'No college login needed. You enter your own numbers and nobody else can see them.' },
]

export default function Home() {
  return (
    <>
      <Seo path="/" />

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">For SRGEC students</span>
            <h1>Know your attendance before it becomes a problem.</h1>
            <p className="lead">
              AttendEase turns the numbers you enter into subject-wise percentages, warnings and a clear plan, so you
              never find out about a shortage at the last minute.
            </p>
            <a className="btn btn-primary" href="#join">Join the early-access list</a>
            <p className="hero-note">Free for students. No college password required.</p>
          </div>
          <figure style={{ margin: 0 }}>
            <img
              className="hero-img"
              src="/hero-dashboard.webp"
              width="960"
              height="640"
              fetchPriority="high"
              alt="Illustration of the AttendEase dashboard showing an overall attendance bar and a list of subjects with their percentages"
            />
            <figcaption className="hero-img-caption">Illustration with sample numbers, not real student data.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <h2>Everything you need to stay above the line</h2>
          <div className="grid cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article className="card" key={title}>
                <Icon size={28} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container grid cols-2">
          <div>
            <h2>How it works</h2>
            <ol className="steps">
              <li><strong>Sign up with your roll number.</strong> Choose your branch, year and semester.</li>
              <li><strong>Enter each day's classes.</strong> Conducted and attended, per subject.</li>
              <li><strong>Read your numbers.</strong> Get percentages, warnings and how many classes you can miss or must attend.</li>
            </ol>
          </div>
          <div className="notice">
            <h3>Please read this</h3>
            <p>
              {site.name} is an independent, student-maintained tool. Its results depend on what you enter and are not
              an official college record. It cannot guarantee exam eligibility or prevent detention. Official records
              always take precedence.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="join">
        <div className="container">
          <div className="band">
            <h2>Get early access</h2>
            <p>Leave your email and we will tell you the day AttendEase opens for SRGEC students. One email, no spam.</p>
            <WaitlistForm />
          </div>
        </div>
      </section>
    </>
  )
}
