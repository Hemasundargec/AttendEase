import { useEffect } from 'react'
import { site } from '../siteConfig.js'
import { pages } from '../lib/seo.js'

// Keeps title/description/canonical correct while navigating inside the app.
// (Initial page loads already have the right tags thanks to the build step.)
export default function Seo({ path }) {
  useEffect(() => {
    const page = pages[path] || pages['/404']
    document.title = page.title

    const setMeta = (selector, attr, value) => {
      const el = document.head.querySelector(selector)
      if (el) el.setAttribute(attr, value)
    }
    setMeta('meta[name="description"]', 'content', page.description)
    setMeta('meta[property="og:title"]', 'content', page.title)
    setMeta('meta[property="og:description"]', 'content', page.description)
    setMeta('meta[name="twitter:title"]', 'content', page.title)
    setMeta('meta[name="twitter:description"]', 'content', page.description)
    let robots = document.head.querySelector('meta[name="robots"]')
    if (page.noindex) {
      if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
      robots.content = 'noindex'
    } else robots?.remove()
    const url = `${site.url}${path === '/404' ? '' : path}`
    setMeta('link[rel="canonical"]', 'href', url)
    setMeta('meta[property="og:url"]', 'content', url)
  }, [path])
  return null
}
