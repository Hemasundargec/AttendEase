import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { createApp } from '../src/app.js'

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist')

test('serves built pages, real 404 status for unknown paths, robots and sitemap', { skip: !existsSync(distDir) && 'run `npm run build` first' }, async () => {
  const app = createApp({ storage: { kind: 'memory' }, formSecret: 's', distDir })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const home = await fetch(`${base}/`)
    assert.equal(home.status, 200)
    assert.match(await home.text(), /<title>AttendEase \|/)

    const privacy = await fetch(`${base}/privacy`)
    assert.equal(privacy.status, 200)
    assert.match(await privacy.text(), /<title>Privacy Policy \| AttendEase<\/title>/)

    const missing = await fetch(`${base}/does-not-exist`)
    assert.equal(missing.status, 404)
    const html = await missing.text()
    assert.match(html, /Page not found/)
    assert.match(html, /noindex/)

    for (const route of ['/dashboard', '/attendance', '/attendance/mark', '/attendance/predict', '/statistics', '/todos', '/profile', '/admin', '/login', '/register']) {
      assert.equal((await fetch(`${base}${route}`)).status, 200, `${route} must load on refresh`)
    }
    assert.equal((await fetch(`${base}/attendance/nope`)).status, 404)
    assert.equal((await fetch(`${base}/robots.txt`)).status, 200)
    assert.equal((await fetch(`${base}/sitemap.xml`)).status, 200)
  } finally { server.close() }
})
