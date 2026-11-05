// Protected setup command for the FIRST administrator. There is no public admin signup.
//   cd server && MONGODB_URI="..." node scripts/create-admin.js
// You choose the username and password interactively; nothing is hardcoded or stored in files.
import 'dotenv/config'
import readline from 'node:readline'
import mongoose from 'mongoose'
import { createMongoUserRepo } from '../src/repos/mongoUserRepo.js'
import { hashPassword } from '../src/auth/password.js'
import { validatePassword } from '../src/validators/auth.js'
import { DuplicateUserError } from '../src/repos/errors.js'
import { academics } from '../src/config/academics.js'

if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI first.'); process.exit(1) }

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))
// Hide typed characters for the password prompt.
const askHidden = (q) => new Promise((res) => {
  process.stdout.write(q)
  rl._writeToOutput = () => {}
  rl.question('', (a) => { rl._writeToOutput = rl.constructor.prototype._writeToOutput; process.stdout.write('\n'); res(a) })
})

const name = (await ask('Admin full name: ')).trim()
const username = (await ask('Admin username (used to log in, e.g. ADMIN01): ')).trim().toUpperCase()
const password = await askHidden('Password (min 10 chars, letters and numbers): ')
const again = await askHidden('Repeat password: ')
rl.close()

if (!name || !username) { console.error('Name and username are required.'); process.exit(1) }
if (password !== again) { console.error('Passwords do not match.'); process.exit(1) }
const problem = validatePassword(password, { minLength: 10, rollNumber: username })
if (problem) { console.error(problem); process.exit(1) }

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
const repo = createMongoUserRepo()
await repo.init()
try {
  await repo.create({ name, rollNumber: username, college: academics.colleges[0].id, role: 'admin', passwordHash: await hashPassword(password) })
  console.log(`Administrator ${username} created. Log in at /login.`)
} catch (err) {
  console.error(err instanceof DuplicateUserError ? 'That username already exists.' : `Failed: ${err.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
