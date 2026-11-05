// Runs after `vite build`. Static hosts and crawlers do not run JavaScript, so we
// write a real HTML file per route with the right title/description/social tags,
// plus sitemap.xml and robots.txt for the configured site URL.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
const { pages } = await import(pathToFileURL(join(root, 'src/lib/seo.js')).href)

const template = readFileSync(join(dist, 'index.html'), 'utf8')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function render(path, page) {
  const url = `${siteUrl}${path === '/' || path === '/404' ? '' : path}${path === '/' ? '/' : ''}`
  let html = template.replaceAll('__SITE_URL__', siteUrl)
  const swapContent = (pattern, value) => { html = html.replace(pattern, (_, a, b) => `${a}${esc(value)}${b}`) }
  html = html.replace(/<title>.*?<\/title>/s, `<title>${esc(page.title)}</title>`)
  swapContent(/(<meta name="description" content=")[^"]*(")/, page.description)
  swapContent(/(<meta property="og:title" content=")[^"]*(")/, page.title)
  swapContent(/(<meta property="og:description" content=")[^"]*(")/, page.description)
  swapContent(/(<meta name="twitter:title" content=")[^"]*(")/, page.title)
  swapContent(/(<meta name="twitter:description" content=")[^"]*(")/, page.description)
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
  if (page.noindex) {
    html = html.replace(/<link rel="canonical"[^>]*>/, '<meta name="robots" content="noindex" />')
  } else {
    html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  }
  return html
}

const sitemapUrls = []
for (const [path, page] of Object.entries(pages)) {
  // Logged-in app pages are noindex and served from the app shell (see server APP_ROUTES), so no static file is needed.
  if (page.noindex && path !== '/404') continue
  const html = render(path, page)
  if (path === '/') writeFileSync(join(dist, 'index.html'), html)
  else if (path === '/404') writeFileSync(join(dist, '404.html'), html)
  else {
    // privacy.html (not privacy/index.html) so /privacy answers 200 directly, matching the canonical URL
    writeFileSync(join(dist, `${path.slice(1)}.html`), html)
  }
  if (!page.noindex) sitemapUrls.push(`${siteUrl}${path === '/' ? '/' : path}`)
}

const lastmod = new Date().toISOString().slice(0, 10)
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemapUrls.map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`,
)
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /attendance\nDisallow: /statistics\nDisallow: /todos\nDisallow: /timetable\nDisallow: /profile\nDisallow: /admin\n\nSitemap: ${siteUrl}/sitemap.xml\n`)
console.log(`postbuild: ${sitemapUrls.length} pages in sitemap for ${siteUrl}`)
