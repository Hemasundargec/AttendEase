// Local development only (no MONGODB_URI): keeps the in-memory repositories in a JSON file so that
// accounts and attendance survive a server restart. Never used in production or in tests.
import fs from 'node:fs'
import path from 'node:path'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const revive = (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v)

export function attachFilePersistence(file, repos) {
  let loaded = 0
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'), revive)
    for (const [name, repo] of Object.entries(repos)) {
      for (const [k, v] of saved[name] || []) { repo._store.set(k, v); loaded++ }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      const backup = `${file}.corrupt-${Date.now()}`
      try { fs.renameSync(file, backup) } catch { /* ignore */ }
      console.warn(`Could not read ${file} (${e.message}). Starting empty; the unreadable file was kept as ${backup}.`)
    }
  }

  let timer = null
  const flush = () => {
    clearTimeout(timer); timer = null
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const out = Object.fromEntries(Object.entries(repos).map(([name, repo]) => [name, [...repo._store.entries()]]))
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(out))
      fs.renameSync(tmp, file) // atomic: a crash mid-write can never leave a half-written file
    } catch (e) { console.error('Could not save development data:', e.message) }
  }
  const schedule = () => { if (!timer) timer = setTimeout(flush, 150) }

  for (const repo of Object.values(repos)) {
    for (const [key, fn] of Object.entries(repo)) {
      if (typeof fn !== 'function') continue
      repo[key] = async (...args) => { const out = await fn.apply(repo, args); schedule(); return out }
    }
  }
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { flush(); process.exit(0) })
  process.once('beforeExit', flush)
  return loaded
}
