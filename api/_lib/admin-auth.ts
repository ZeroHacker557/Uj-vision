import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminDb } from './firebase-admin.js'

/**
 * Admin panel autentifikatsiyasi.
 *
 * Mini app Telegram imzosi bilan kiradi, admin panel esa login/parol
 * bilan — u Telegram ichida emas, oddiy brauzerda ochiladi.
 *
 * Tamoyillar:
 *  - Parol hech qayerda ochiq saqlanmaydi. Faqat scrypt hash: env
 *    o'zgaruvchisida (boshlang'ich) yoki Firestore'da (panel orqali
 *    o'zgartirilgandan keyin). Firestore'dagi qiymat ustunroq.
 *  - Sessiya — HttpOnly cookie'dagi imzolangan token. JS uni o'qiy
 *    olmaydi, demak XSS bilan o'g'irlab bo'lmaydi. Token ichida faqat
 *    login va muddat bor, imzo ADMIN_SESSION_SECRET bilan yasaladi.
 *  - Parolni taxminlashdan himoya: muvaffaqiyatsiz urinishlar
 *    Firestore'da sanaladi, 5 tadan keyin hisob 15 daqiqaga bloklanadi.
 */

const COOKIE_NAME = 'uj_admin'
/** Sessiya muddati — 12 soat. */
const SESSION_TTL_SECONDS = 12 * 60 * 60
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15

// ─── Parol hash ───────────────────────────────────────────────

const SCRYPT_KEYLEN = 32

/**
 * Yangi parol uchun hash yasaydi: `scrypt:<salt-hex>:<hash-hex>`.
 *
 * Ajratgich sifatida `$` emas, `:` ishlatiladi — `.env` fayllarini
 * o'qiydigan vositalar `$` dan keyingi qismni o'zgaruvchi deb bilib
 * uni bo'shliqqa almashtirib yuboradi.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

/** Parolni hash bilan solishtiradi. Vaqt bo'yicha hujumga chidamli. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored || '').split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(parts[1], 'hex')
    expected = Buffer.from(parts[2], 'hex')
  } catch {
    return false
  }
  if (expected.length !== SCRYPT_KEYLEN) return false

  const actual = scryptSync(password, salt, SCRYPT_KEYLEN)
  return timingSafeEqual(actual, expected)
}

// ─── Sessiya tokeni ───────────────────────────────────────────

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET sozlanmagan')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createSessionToken(username: string): string {
  const payload = b64url(
    JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
  )
  return `${payload}.${sign(payload)}`
}

/** Token haqiqiymi? Haqiqiy bo'lsa login qaytadi, aks holda null. */
export function readSessionToken(token: string): string | null {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) return null

  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof data.exp !== 'number' || data.exp * 1000 < Date.now()) return null
    return typeof data.u === 'string' ? data.u : null
  } catch {
    return null
  }
}

// ─── Cookie ───────────────────────────────────────────────────

function isSecureRequest(req: VercelRequest): boolean {
  // Vercel'da so'rov HTTPS bilan keladi; localhost'da esa Secure cookie
  // o'rnatilmaydi va panel mahalliy ishlab chiqishda ochilmay qoladi.
  return String(req.headers['x-forwarded-proto'] || '') === 'https'
}

export function setSessionCookie(req: VercelRequest, res: VercelResponse, token: string) {
  const flags = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
  if (isSecureRequest(req)) flags.push('Secure')
  res.setHeader('Set-Cookie', flags.join('; '))
}

export function clearSessionCookie(req: VercelRequest, res: VercelResponse) {
  const flags = [`${COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0']
  if (isSecureRequest(req)) flags.push('Secure')
  res.setHeader('Set-Cookie', flags.join('; '))
}

function readCookie(req: VercelRequest, name: string): string {
  const raw = String(req.headers.cookie || '')
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return ''
}

/** So'rov ortida haqiqiy admin sessiyasi bormi? */
export function currentAdmin(req: VercelRequest): string | null {
  try {
    return readSessionToken(readCookie(req, COOKIE_NAME))
  } catch {
    // ADMIN_SESSION_SECRET sozlanmagan — sessiya yo'q deb hisoblanadi
    return null
  }
}

// ─── Hisob ma'lumotlari ───────────────────────────────────────

type Credentials = { username: string; passwordHash: string }

/**
 * Amaldagi login/parol hash.
 *
 * Avval Firestore'ga qaraydi (panel orqali o'zgartirilgan bo'lsa),
 * topilmasa env'dagi boshlang'ich qiymatlarga qaytadi.
 */
export async function loadCredentials(): Promise<Credentials> {
  const envUser = String(process.env.ADMIN_USERNAME || '').trim()
  const envHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim()

  try {
    const snap = await (await adminDb()).collection('settings').doc('admin_auth').get()
    if (snap.exists) {
      const data = snap.data() || {}
      const username = String(data.username || envUser).trim()
      const passwordHash = String(data.passwordHash || envHash).trim()
      if (username && passwordHash) return { username, passwordHash }
    }
  } catch {
    // Baza javob bermasa env bilan davom etamiz — panelga kirish
    // butunlay yopilib qolmasin.
  }

  if (!envUser || !envHash) {
    throw new Error('ADMIN_USERNAME / ADMIN_PASSWORD_HASH sozlanmagan')
  }
  return { username: envUser, passwordHash: envHash }
}

export async function saveCredentials(username: string, passwordHash: string) {
  await (await adminDb())
    .collection('settings')
    .doc('admin_auth')
    .set({ username, passwordHash, updatedAt: new Date().toISOString() }, { merge: true })
}

// ─── Taxmin qilishdan himoya ──────────────────────────────────

type LockState = { locked: boolean; minutesLeft: number }

async function attemptsRef(username: string) {
  // Hujjat nomi sifatida loginni ishlatamiz — "/" kabi belgilar
  // hujjat yo'lini buzmasligi uchun tozalaymiz.
  const safe = username.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'admin'
  return (await adminDb()).collection('admin_logins').doc(safe)
}

export async function checkLock(username: string): Promise<LockState> {
  try {
    const snap = await (await attemptsRef(username)).get()
    const lockedUntil = Number(snap.data()?.lockedUntil || 0)
    if (lockedUntil > Date.now()) {
      return { locked: true, minutesLeft: Math.ceil((lockedUntil - Date.now()) / 60000) }
    }
  } catch {
    // Tekshiruv ishlamasa kirishni to'smaymiz — parol baribir tekshiriladi
  }
  return { locked: false, minutesLeft: 0 }
}

export async function registerFailure(username: string) {
  try {
    const ref = await attemptsRef(username)
    const snap = await ref.get()
    const failed = Number(snap.data()?.failed || 0) + 1
    await ref.set(
      {
        failed,
        lastFailedAt: new Date().toISOString(),
        lockedUntil: failed >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60_000 : 0,
      },
      { merge: true },
    )
  } catch {
    /* jurnal yozilmasa ham kirish jarayoni to'xtamaydi */
  }
}

export async function registerSuccess(username: string) {
  try {
    const ref = await attemptsRef(username)
    await ref.set(
      { failed: 0, lockedUntil: 0, lastLoginAt: new Date().toISOString() },
      { merge: true },
    )
  } catch {
    /* muhim emas */
  }
}
