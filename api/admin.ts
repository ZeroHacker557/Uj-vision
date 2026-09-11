import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, requirePost } from './_lib/http.js'
import {
  checkLock,
  clearSessionCookie,
  createSessionToken,
  currentAdmin,
  hashPassword,
  loadCredentials,
  registerFailure,
  registerSuccess,
  saveCredentials,
  setSessionCookie,
  verifyPassword,
} from './_lib/admin-auth.js'
import * as actions from './_lib/admin-actions.js'

/**
 * POST /api/admin   { action, ...params }
 *
 * Admin panelning yagona kirish nuqtasi. Vercel har bir fayl uchun
 * alohida serverless funksiya yaratadi va ularning soni cheklangan,
 * shuning uchun yigirmata endpoint o'rniga bitta dispetcher ishlatiladi.
 *
 * `login` dan boshqa har bir amal HttpOnly cookie'dagi imzolangan
 * sessiyani talab qiladi.
 */

/** Sessiyasiz bajariladigan amallar. */
const PUBLIC_ACTIONS = new Set(['login'])

type Handler = (params: Record<string, unknown>) => Promise<unknown>

const HANDLERS: Record<string, Handler> = {
  overview: () => actions.overview(),

  'orders.list': (p) => actions.ordersList(p),
  'orders.setStatus': (p) => actions.ordersSetStatus(p),
  'orders.setPayment': (p) => actions.ordersSetPayment(p),
  'orders.delete': (p) => actions.ordersDelete(p),

  'products.list': () => actions.productsList(),
  'products.save': (p) => actions.productsSave(p),
  'products.delete': (p) => actions.productsDelete(p),
  'products.reorder': (p) => actions.productsReorder(p),

  'categories.list': () => actions.categoriesList(),
  'categories.save': (p) => actions.categoriesSave(p),
  'categories.delete': (p) => actions.categoriesDelete(p),

  'customers.list': (p) => actions.customersList(p),
  broadcast: (p) => actions.broadcast(p),

  'settings.get': () => actions.settingsGet(),
  'settings.save': (p) => actions.settingsSave(p),

  'promo.list': () => actions.promoList(),
  'promo.save': (p) => actions.promoSave(p),
  'promo.delete': (p) => actions.promoDelete(p),

  upload: (p) => actions.uploadImage(p),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  const body = (req.body || {}) as Record<string, unknown>
  const action = String(body.action || '')

  // ── Sessiya ochish ─────────────────────────────────────────
  if (action === 'login') {
    const username = String(body.username || '').trim().slice(0, 80)
    const password = String(body.password || '')
    if (!username || !password) return fail(res, 400, 'Login va parolni kiriting')

    const lock = await checkLock(username)
    if (lock.locked) {
      return fail(
        res,
        429,
        `Juda ko'p urinish. ${lock.minutesLeft} daqiqadan keyin qayta urinib ko'ring.`,
      )
    }

    let credentials
    try {
      credentials = await loadCredentials()
    } catch (error) {
      console.error('[admin] hisob sozlanmagan:', error)
      return fail(res, 500, 'Admin hisobi sozlanmagan — Vercel env qiymatlarini tekshiring')
    }

    const ok = username === credentials.username && verifyPassword(password, credentials.passwordHash)
    if (!ok) {
      await registerFailure(username)
      return fail(res, 401, "Login yoki parol noto'g'ri")
    }

    try {
      setSessionCookie(req, res, createSessionToken(credentials.username))
    } catch (error) {
      console.error('[admin] sessiya kaliti yo‘q:', error)
      return fail(res, 500, 'ADMIN_SESSION_SECRET sozlanmagan')
    }

    await registerSuccess(username)
    return res.status(200).json({ ok: true, username: credentials.username })
  }

  // ── Shundan keyingi hammasi sessiya talab qiladi ───────────
  const admin = currentAdmin(req)

  if (action === 'me') {
    if (!admin) return fail(res, 401, 'Sessiya yo‘q')
    return res.status(200).json({ ok: true, username: admin })
  }

  if (action === 'logout') {
    clearSessionCookie(req, res)
    return res.status(200).json({ ok: true })
  }

  if (!admin && !PUBLIC_ACTIONS.has(action)) {
    return fail(res, 401, 'Avval tizimga kiring')
  }

  // Parolni almashtirish — amaldagi parolni qayta so'raymiz, shunda
  // ochiq qolgan sessiyani topgan odam parolni o'zgartira olmaydi.
  if (action === 'changePassword') {
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')
    const newUsername = String(body.username || admin || '').trim().slice(0, 80)

    if (newPassword.length < 8) return fail(res, 400, "Yangi parol kamida 8 ta belgi bo'lsin")
    if (!newUsername) return fail(res, 400, 'Login kiritilmagan')

    const credentials = await loadCredentials()
    if (!verifyPassword(currentPassword, credentials.passwordHash)) {
      return fail(res, 401, "Amaldagi parol noto'g'ri")
    }

    await saveCredentials(newUsername, hashPassword(newPassword))
    setSessionCookie(req, res, createSessionToken(newUsername))
    return res.status(200).json({ ok: true, username: newUsername })
  }

  const run = HANDLERS[action]
  if (!run) return fail(res, 400, `Noma'lum amal: ${action}`)

  try {
    const result = await run(body)
    return res.status(200).json(result ?? { ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xatolik'
    // Tekshiruv xatolari mijozga ko'rsatiladi, kutilmaganlari jurnalga
    console.error(`[admin] ${action}:`, error)
    return fail(res, 400, message)
  }
}
