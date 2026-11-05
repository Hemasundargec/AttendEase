// Google Analytics 4, loaded ONLY after the visitor accepts analytics cookies.
import { site } from '../siteConfig.js'

const KEY = 'attendease-consent' // stores "accepted" or "rejected"
let loaded = false

export function getConsent() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null // storage blocked: behave as "not decided", nothing is loaded
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* ignore: the choice just won't persist */
  }
  if (value === 'accepted') loadAnalytics()
}

export function loadAnalytics() {
  if (loaded || !site.gaId || getConsent() !== 'accepted') return
  loaded = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', site.gaId, { anonymize_ip: true, send_page_view: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(site.gaId)}`
  document.head.appendChild(script)
}

export function trackPageView(path) {
  if (loaded && window.gtag) window.gtag('event', 'page_view', { page_path: path })
}

export function trackEvent(name, params = {}) {
  if (loaded && window.gtag) window.gtag('event', name, params)
}
