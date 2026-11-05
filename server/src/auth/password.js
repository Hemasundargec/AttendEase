import bcrypt from 'bcryptjs'

const cost = () => Number(process.env.BCRYPT_COST) || 12

export const hashPassword = (plain) => bcrypt.hash(plain, cost())
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash)

// Compared against when the roll number does not exist, so "unknown user" and
// "wrong password" take about the same time and cannot be told apart by timing.
let dummyHash
export async function verifyAgainstDummy(plain) {
  dummyHash ||= await bcrypt.hash('not-a-real-password', cost())
  return bcrypt.compare(plain, dummyHash)
}
