import { randomUUID } from 'node:crypto'
import { adminDb } from './firebase-admin.js'
import { adminPanelUrl, escapeHtml, sendMessage, sendToMany } from './telegram.js'

/**
 * Admin panelning barcha amallari.
 *
 * Hammasi bitta `/api/admin` funksiyasi orqali o'tadi: Vercel har bir
 * fayl uchun alohida serverless funksiya yaratadi va ularning soni
 * cheklangan, shuning uchun yigirmata endpoint o'rniga bitta dispetcher
 * ishlatiladi. Sessiya tekshiruvi chaqiruvchida (api/admin.ts) bo'ladi —
 * bu yerga faqat tasdiqlangan so'rov tushadi.
 *
 * Mijoz yuborgan hech bir qiymatga ishonilmaydi: har bir maydon shu
 * yerda tozalanadi va tipga keltiriladi.
 */

// ─── Buyurtma holatlari ───────────────────────────────────────

/**
 * Uchta holat, shundan ikkitasini admin qo'yadi.
 * "Yangi" — hali ko'rilmagan buyurtma, avtomatik qo'yiladi.
 */
export const ORDER_STATUSES = ['Yangi', 'Qabul qilindi', 'Yetkazildi'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

const PAYMENT_STATUSES = ['Kutilmoqda', 'Tolangan', 'Rad etildi'] as const

// ─── Kichik yordamchilar ──────────────────────────────────────

const text = (value: unknown, max = 200) => String(value ?? '').trim().slice(0, max)
const int = (value: unknown, fallback = 0) => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? n : fallback
}
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Vergul bilan yozilgan ro'yxatni massivga aylantiradi. */
function list(value: unknown, max = 30): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',')
  return raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, max)
}

function isoNow(): string {
  return new Date().toISOString()
}

type Row = Record<string, unknown> & { id: string }

function docsOf(snapshot: FirebaseFirestore.QuerySnapshot): Row[] {
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Row)
}

// ─── Buyurtmalar ──────────────────────────────────────────────

type OrderRow = Row

async function allOrders(limit = 500): Promise<OrderRow[]> {
  const db = await adminDb()
  // createdAt — ISO qator, shuning uchun matn bo'yicha saralash ham
  // xronologik to'g'ri chiqadi.
  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(limit).get()
  return docsOf(snap) as OrderRow[]
}

export async function ordersList(params: Record<string, unknown>) {
  const status = text(params.status)
  const search = text(params.search, 80).toLowerCase()
  const orders = await allOrders(int(params.limit, 300) || 300)

  const filtered = orders.filter((order) => {
    if (status && status !== 'all' && order.status !== status) return false
    if (!search) return true
    const customer = (order.customer || {}) as Record<string, unknown>
    const haystack = [order.orderNumber, customer.name, customer.phone, customer.address]
      .map((value) => String(value ?? '').toLowerCase())
      .join(' ')
    return haystack.includes(search)
  })

  const counts = {
    all: orders.length,
    Yangi: orders.filter((o) => o.status === 'Yangi').length,
    'Qabul qilindi': orders.filter((o) => o.status === 'Qabul qilindi').length,
    Yetkazildi: orders.filter((o) => o.status === 'Yetkazildi').length,
  }

  return { orders: filtered, counts }
}

/**
 * Buyurtma holatini o'zgartiradi va mijozga xabar beradi.
 *
 * Xabar ikki kanal bilan ketadi: Telegram (darhol ko'rinadi) va
 * ilovadagi bildirishnomalar ro'yxati (keyin ham qoladi).
 */
export async function ordersSetStatus(params: Record<string, unknown>) {
  const id = text(params.id, 120)
  const status = text(params.status) as OrderStatus
  if (!id) throw new Error('Buyurtma tanlanmagan')
  if (!ORDER_STATUSES.includes(status)) throw new Error('Holat notanish')

  const db = await adminDb()
  const ref = db.collection('orders').doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Buyurtma topilmadi')

  const order = snap.data() as Record<string, unknown>
  if (order.status === status) return { ok: true, unchanged: true }

  await ref.update({ status, statusUpdatedAt: isoNow() })

  const orderNumber = String(order.orderNumber || id)
  const userId = Number(order.userId)

  if (Number.isFinite(userId) && userId > 0) {
    const messages: Record<OrderStatus, string> = {
      Yangi: `Buyurtmangiz <b>${escapeHtml(orderNumber)}</b> qayta ko'rib chiqilmoqda.`,
      'Qabul qilindi':
        `✅ Buyurtmangiz <b>${escapeHtml(orderNumber)}</b> qabul qilindi!\n\n` +
        'Tayyorlab, tez orada yo‘lga chiqaramiz. Kuryer yetkazishdan oldin qo‘ng‘iroq qiladi.',
      Yetkazildi:
        `🎉 Buyurtmangiz <b>${escapeHtml(orderNumber)}</b> yetkazildi!\n\n` +
        'Xaridingiz muborak bo‘lsin. Mahsulotga baho qoldirsangiz, biz uchun juda qimmatli.',
    }

    await sendMessage(userId, messages[status])
    await db.collection('notifications').add({
      userId,
      title: status === 'Yetkazildi' ? 'Buyurtma yetkazildi' : 'Buyurtma qabul qilindi',
      body: `${orderNumber} — ${status}`,
      date: isoNow(),
      read: false,
      type: 'order',
    })
  }

  return { ok: true }
}

export async function ordersSetPayment(params: Record<string, unknown>) {
  const id = text(params.id, 120)
  const paymentStatus = text(params.paymentStatus)
  if (!id) throw new Error('Buyurtma tanlanmagan')
  if (!PAYMENT_STATUSES.includes(paymentStatus as (typeof PAYMENT_STATUSES)[number])) {
    throw new Error("To'lov holati notanish")
  }

  const db = await adminDb()
  const ref = db.collection('orders').doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Buyurtma topilmadi')

  await ref.update({ paymentStatus, paymentUpdatedAt: isoNow() })

  const order = snap.data() as Record<string, unknown>
  const userId = Number(order.userId)
  const orderNumber = String(order.orderNumber || id)

  if (Number.isFinite(userId) && userId > 0) {
    await sendMessage(
      userId,
      paymentStatus === 'Tolangan'
        ? `💳 <b>${escapeHtml(orderNumber)}</b> uchun to‘lovingiz tasdiqlandi. Rahmat!`
        : `❌ <b>${escapeHtml(orderNumber)}</b> uchun to‘lov cheki qabul qilinmadi.\n\n` +
            'Iltimos, to‘g‘ri chekni qayta yuboring yoki operator bilan bog‘laning.',
    )
  }

  return { ok: true }
}

export async function ordersDelete(params: Record<string, unknown>) {
  const id = text(params.id, 120)
  if (!id) throw new Error('Buyurtma tanlanmagan')
  await (await adminDb()).collection('orders').doc(id).delete()
  return { ok: true }
}

// ─── Boshqaruv paneli ─────────────────────────────────────────

function dayKey(iso: unknown): string {
  const parsed = Date.parse(String(iso ?? ''))
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10)
}

export async function overview() {
  const db = await adminDb()
  const [orders, usersSnap, productsSnap] = await Promise.all([
    allOrders(500),
    db.collection('users').get(),
    db.collection('products').get(),
  ])

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const since = (days: number) => now - days * dayMs

  const inRange = (order: OrderRow, days: number) => {
    const parsed = Date.parse(String(order.createdAt ?? ''))
    return !Number.isNaN(parsed) && parsed >= since(days)
  }

  const delivered = orders.filter((o) => o.status === 'Yetkazildi')
  const sum = (rows: OrderRow[]) => rows.reduce((acc, o) => acc + (Number(o.total) || 0), 0)

  // So'nggi 14 kunlik grafik — kun bo'yicha buyurtma soni va tushum
  const chart: { date: string; orders: number; revenue: number }[] = []
  for (let i = 13; i >= 0; i -= 1) {
    const key = new Date(now - i * dayMs).toISOString().slice(0, 10)
    const rows = orders.filter((o) => dayKey(o.createdAt) === key)
    chart.push({ date: key, orders: rows.length, revenue: sum(rows) })
  }

  // Eng ko'p sotilgan mahsulotlar — yetkazilgan buyurtmalar bo'yicha
  const sold = new Map<string, { name: string; quantity: number; revenue: number }>()
  delivered.forEach((order) => {
    const items = Array.isArray(order.products) ? order.products : []
    items.forEach((item: Record<string, unknown>) => {
      const product = (item.product || {}) as Record<string, unknown>
      const name = String(product.name || '—')
      const quantity = Number(item.quantity) || 0
      const entry = sold.get(name) || { name, quantity: 0, revenue: 0 }
      entry.quantity += quantity
      entry.revenue += (Number(product.price) || 0) * quantity
      sold.set(name, entry)
    })
  })

  const products = docsOf(productsSnap)
  const lowStock = products
    .filter((p) => typeof p.stock === 'number' && p.stock <= 3)
    .sort((a, b) => Number(a.stock) - Number(b.stock))
    .slice(0, 8)
    .map((p) => ({ id: p.id, name: String(p.name || ''), stock: Number(p.stock) }))

  return {
    totals: {
      orders: orders.length,
      newOrders: orders.filter((o) => o.status === 'Yangi').length,
      acceptedOrders: orders.filter((o) => o.status === 'Qabul qilindi').length,
      deliveredOrders: delivered.length,
      customers: usersSnap.size,
      products: productsSnap.size,
      revenue: sum(delivered),
      pendingRevenue: sum(orders.filter((o) => o.status !== 'Yetkazildi')),
    },
    periods: {
      today: {
        orders: orders.filter((o) => dayKey(o.createdAt) === dayKey(new Date().toISOString()))
          .length,
        revenue: sum(orders.filter((o) => dayKey(o.createdAt) === dayKey(new Date().toISOString()))),
      },
      week: {
        orders: orders.filter((o) => inRange(o, 7)).length,
        revenue: sum(orders.filter((o) => inRange(o, 7))),
      },
      month: {
        orders: orders.filter((o) => inRange(o, 30)).length,
        revenue: sum(orders.filter((o) => inRange(o, 30))),
      },
    },
    chart,
    topProducts: [...sold.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6),
    lowStock,
    recentOrders: orders.slice(0, 6),
  }
}

// ─── Mahsulotlar ──────────────────────────────────────────────

export async function productsList() {
  const snap = await (await adminDb()).collection('products').get()
  const products = docsOf(snap)
  // sortOrder qo'yilmagan eski mahsulotlar oxirida turadi
  products.sort((a, b) => {
    const left = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 1e9
    const right = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 1e9
    if (left !== right) return left - right
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
  return { products }
}

export async function productsSave(params: Record<string, unknown>) {
  const name = text(params.name, 140)
  const price = int(params.price)
  const category = text(params.category, 80)

  if (!name) throw new Error('Mahsulot nomi kiritilmagan')
  if (price <= 0) throw new Error("Narx noldan katta bo'lishi kerak")
  if (!category) throw new Error('Kategoriya tanlanmagan')

  const oldPriceRaw = int(params.oldPrice, 0)
  const images = list(params.images, 8)
  const payload: Record<string, unknown> = {
    name,
    price,
    oldPrice: oldPriceRaw > 0 ? oldPriceRaw : null,
    category,
    images,
    sizes: list(params.sizes, 30),
    color: list(params.colors, 30).join(', '),
    description: text(params.description, 2000),
    discount: text(params.discount, 20),
    stock: Math.max(int(params.stock, 0), 0),
    sortOrder: int(params.sortOrder, 0),
  }

  const db = await adminDb()
  const id = text(params.id, 120)

  if (id) {
    const ref = db.collection('products').doc(id)
    if (!(await ref.get()).exists) throw new Error('Mahsulot topilmadi')
    await ref.update(payload)
    return { ok: true, id }
  }

  // Yangi mahsulot — id hujjat nomi ham, ichidagi maydon ham bo'ladi
  // (bot va mini app shu formatni kutadi).
  const newId = String(Math.floor(Math.random() * 900000) + 100000)
  await db
    .collection('products')
    .doc(newId)
    .set({ ...payload, id: newId, rating: 5, reviews: 0, createdAt: isoNow() })
  return { ok: true, id: newId }
}

export async function productsDelete(params: Record<string, unknown>) {
  const id = text(params.id, 120)
  if (!id) throw new Error('Mahsulot tanlanmagan')
  await (await adminDb()).collection('products').doc(id).delete()
  return { ok: true }
}

/** Ro'yxatdagi tartibni saqlaydi — mini app shu tartibda ko'rsatadi. */
export async function productsReorder(params: Record<string, unknown>) {
  const ids = Array.isArray(params.ids) ? params.ids.map((id) => text(id, 120)).filter(Boolean) : []
  if (!ids.length) throw new Error("Tartib ro'yxati bo'sh")

  const db = await adminDb()
  const batch = db.batch()
  ids.slice(0, 500).forEach((id, index) => {
    batch.update(db.collection('products').doc(id), { sortOrder: index })
  })
  await batch.commit()
  return { ok: true }
}

// ─── Kategoriyalar ────────────────────────────────────────────

export async function categoriesList() {
  const snap = await (await adminDb()).collection('categories').get()
  const categories = docsOf(snap).sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || '')),
  )
  return { categories }
}

export async function categoriesSave(params: Record<string, unknown>) {
  const name = text(params.name, 80)
  const icon = text(params.icon, 40) || 'package'
  if (!name) throw new Error('Kategoriya nomi kiritilmagan')

  const db = await adminDb()
  const id = text(params.id, 120)

  // Bir xil nomli kategoriya ikki marta bo'lmasin — mini app filtri
  // nom bo'yicha ishlaydi.
  const existing = await db.collection('categories').where('name', '==', name).limit(1).get()
  if (!existing.empty && existing.docs[0].id !== id) {
    throw new Error('Bunday nomli kategoriya allaqachon bor')
  }

  if (id) {
    const ref = db.collection('categories').doc(id)
    const snap = await ref.get()
    if (!snap.exists) throw new Error('Kategoriya topilmadi')

    const oldName = String(snap.data()?.name || '')
    await ref.update({ name, icon })

    // Nom o'zgarsa, shu kategoriyadagi mahsulotlar "kategoriyasiz"
    // bo'lib qolmasligi uchun ularni ham yangilaymiz.
    if (oldName && oldName !== name) {
      const products = await db.collection('products').where('category', '==', oldName).get()
      const batch = db.batch()
      products.docs.forEach((doc) => batch.update(doc.ref, { category: name }))
      if (products.size) await batch.commit()
    }
    return { ok: true, id, renamed: oldName !== name }
  }

  const newId = String(Math.floor(Math.random() * 90000) + 10000)
  await db.collection('categories').doc(newId).set({ id: newId, name, icon })
  return { ok: true, id: newId }
}

export async function categoriesDelete(params: Record<string, unknown>) {
  const id = text(params.id, 120)
  if (!id) throw new Error('Kategoriya tanlanmagan')

  const db = await adminDb()
  const snap = await db.collection('categories').doc(id).get()
  if (!snap.exists) throw new Error('Kategoriya topilmadi')

  const name = String(snap.data()?.name || '')
  const used = await db.collection('products').where('category', '==', name).limit(1).get()
  if (!used.empty) {
    throw new Error("Bu kategoriyada mahsulotlar bor — avval ularni ko'chiring yoki o'chiring")
  }

  await db.collection('categories').doc(id).delete()
  return { ok: true }
}

// ─── Mijozlar ─────────────────────────────────────────────────

export async function customersList(params: Record<string, unknown>) {
  const db = await adminDb()
  const [usersSnap, orders] = await Promise.all([db.collection('users').get(), allOrders(1000)])

  const stats = new Map<number, { orders: number; spent: number; last: string }>()
  orders.forEach((order) => {
    const userId = Number(order.userId)
    if (!Number.isFinite(userId)) return
    const entry = stats.get(userId) || { orders: 0, spent: 0, last: '' }
    entry.orders += 1
    if (order.status === 'Yetkazildi') entry.spent += Number(order.total) || 0
    const createdAt = String(order.createdAt || '')
    if (createdAt > entry.last) entry.last = createdAt
    stats.set(userId, entry)
  })

  const search = text(params.search, 80).toLowerCase()
  const customers = docsOf(usersSnap)
    .map((user) => {
      const id = Number(user.id ?? user.docId ?? 0)
      const entry = stats.get(id) || { orders: 0, spent: 0, last: '' }
      return {
        id,
        firstName: String(user.first_name || ''),
        lastName: String(user.last_name || ''),
        username: String(user.username || ''),
        phone: String(user.phone || ''),
        photoUrl: String(user.photo_url || ''),
        language: String(user.language || ''),
        addresses: Array.isArray(user.addresses) ? user.addresses : [],
        lastActive: String(user.lastActive || ''),
        ordersCount: entry.orders,
        totalSpent: entry.spent,
        lastOrderAt: entry.last,
      }
    })
    .filter((customer) => {
      if (!search) return true
      return [customer.firstName, customer.lastName, customer.username, customer.phone, customer.id]
        .map((value) => String(value).toLowerCase())
        .join(' ')
        .includes(search)
    })
    .sort((a, b) => (b.lastOrderAt || b.lastActive).localeCompare(a.lastOrderAt || a.lastActive))

  return { customers }
}

// ─── Ommaviy xabar ────────────────────────────────────────────

export async function broadcast(params: Record<string, unknown>) {
  const message = text(params.text, 3000)
  const audience = text(params.audience) === 'buyers' ? 'buyers' : 'all'
  const title = text(params.title, 100) || 'Xabar'
  if (!message) throw new Error("Xabar matni bo'sh")

  const db = await adminDb()
  const usersSnap = await db.collection('users').get()
  let ids = docsOf(usersSnap)
    .map((user) => Number(user.id))
    .filter((id) => Number.isFinite(id) && id > 0)

  if (audience === 'buyers') {
    const orders = await allOrders(1000)
    const buyers = new Set(orders.map((order) => Number(order.userId)))
    ids = ids.filter((id) => buyers.has(id))
  }

  if (!ids.length) throw new Error('Xabar yuboriladigan foydalanuvchi topilmadi')

  const html = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`
  const result = await sendToMany(ids, html)

  // Ilovadagi bildirishnomalar ro'yxatiga ham yozamiz — foydalanuvchi
  // Telegram xabarini o'chirsa ham xabar do'kon ichida qoladi.
  const now = isoNow()
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch()
    ids.slice(i, i + 400).forEach((userId) => {
      batch.set(db.collection('notifications').doc(), {
        userId,
        title,
        body: message,
        date: now,
        read: false,
        type: 'promo',
      })
    })
    await batch.commit()
  }

  return { ok: true, total: ids.length, ...result }
}

// ─── Sozlamalar ───────────────────────────────────────────────

export async function settingsGet() {
  const db = await adminDb()
  const [payment, delivery, contact] = await Promise.all([
    db.collection('settings').doc('payment').get(),
    db.collection('settings').doc('delivery').get(),
    db.collection('settings').doc('contact').get(),
  ])

  return {
    payment: {
      cardNumber: String(payment.data()?.cardNumber || ''),
      cardOwner: String(payment.data()?.cardOwner || ''),
    },
    delivery: {
      fee: Number(delivery.data()?.fee) || 0,
      freeFrom: Number(delivery.data()?.freeFrom) || 0,
    },
    contact: {
      phone: String(contact.data()?.phone || ''),
      email: String(contact.data()?.email || ''),
      telegram: String(contact.data()?.telegram || ''),
      city: String(contact.data()?.city || ''),
      workHours: String(contact.data()?.workHours || ''),
    },
  }
}

export async function settingsSave(params: Record<string, unknown>) {
  const db = await adminDb()
  const section = text(params.section)
  const value = (params.value || {}) as Record<string, unknown>

  if (section === 'payment') {
    await db.collection('settings').doc('payment').set(
      {
        cardNumber: text(value.cardNumber, 40),
        cardOwner: text(value.cardOwner, 80),
        updatedAt: isoNow(),
      },
      { merge: true },
    )
    return { ok: true }
  }

  if (section === 'delivery') {
    await db.collection('settings').doc('delivery').set(
      {
        fee: Math.max(int(value.fee, 0), 0),
        freeFrom: Math.max(int(value.freeFrom, 0), 0),
        updatedAt: isoNow(),
      },
      { merge: true },
    )
    return { ok: true }
  }

  if (section === 'contact') {
    await db.collection('settings').doc('contact').set(
      {
        phone: text(value.phone, 40),
        email: text(value.email, 120),
        telegram: text(value.telegram, 60),
        city: text(value.city, 120),
        workHours: text(value.workHours, 60),
        updatedAt: isoNow(),
      },
      { merge: true },
    )
    return { ok: true }
  }

  throw new Error("Noma'lum sozlama bo'limi")
}

// ─── Promokodlar ──────────────────────────────────────────────

export async function promoList() {
  const snap = await (await adminDb()).collection('promocodes').get()
  const promocodes = docsOf(snap).sort((a, b) =>
    String(a.code || '').localeCompare(String(b.code || '')),
  )
  return { promocodes }
}

export async function promoSave(params: Record<string, unknown>) {
  const code = text(params.code, 40).toUpperCase()
  const discountPercent = clamp(int(params.discountPercent, 0), 1, 100)
  if (!code) throw new Error('Promokod kiritilmagan')

  const db = await adminDb()
  const id = text(params.id, 120)

  const duplicate = await db.collection('promocodes').where('code', '==', code).limit(1).get()
  if (!duplicate.empty && duplicate.docs[0].id !== id) {
    throw new Error('Bunday promokod allaqachon bor')
  }

  const maxUses = Math.max(int(params.maxUses, 0), 0)
  const minOrderTotal = Math.max(int(params.minOrderTotal, 0), 0)
  const expiresAt = text(params.expiresAt, 40)

  const payload = {
    code,
    discountPercent,
    active: params.active !== false,
    maxUses,
    minOrderTotal,
    expiresAt: expiresAt || null,
  }

  if (id) {
    await db.collection('promocodes').doc(id).update(payload)
    return { ok: true, id }
  }

  const ref = await db
    .collection('promocodes')
    .add({ ...payload, usageCount: 0, usedBy: [], createdAt: isoNow() })
  return { ok: true, id: ref.id }
}

export async function promoDelete(params: Record<string, unknown>) {
  const id = text(params.id, 120)
  if (!id) throw new Error('Promokod tanlanmagan')
  await (await adminDb()).collection('promocodes').doc(id).delete()
  return { ok: true }
}

// ─── Rasm yuklash ─────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
/** Vercel so'rov tanasi ~4.5MB bilan cheklangan — brauzer rasmni siqib yuboradi. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/**
 * Base64 dataURL ni Firebase Storage'ga yuklaydi.
 *
 * Ochiq havola download-token orqali yasaladi: shunda Storage
 * qoidalari yopiq bo'lsa ham rasm ko'rinadi, lekin havolani
 * bilmagan odam faylni topa olmaydi.
 */
export async function uploadImage(params: Record<string, unknown>) {
  const dataUrl = String(params.dataUrl || '')
  const match = /^data:([a-z/+-]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) throw new Error('Rasm formati tushunarsiz')

  const contentType = match[1].toLowerCase()
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Faqat JPG, PNG yoki WEBP rasm yuklash mumkin')
  }

  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Rasm hajmi 3 MB dan oshmasin')

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || 'uj-vision-kiyimdokon.firebasestorage.app'
  const { getStorage } = await import('firebase-admin/storage')
  const { getApps } = await import('firebase-admin/app')
  // adminDb() ilovani allaqachon yaratgan bo'ladi
  await adminDb()
  const bucket = getStorage(getApps()[0]).bucket(bucketName)

  const extension = contentType.split('/')[1].replace('jpeg', 'jpg')
  const token = randomUUID()
  const name = `products/${Date.now()}_${randomUUID().slice(0, 8)}.${extension}`

  await bucket.file(name).save(buffer, {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  })

  const url =
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/` +
    `${encodeURIComponent(name)}?alt=media&token=${token}`
  return { ok: true, url }
}

// ─── Buyurtma xabarnomasi (mini app tomonidan chaqiriladi) ────

/** Adminlarga yangi buyurtma haqida xabar — matnini shu yerda yasaymiz. */
export function newOrderMessage(order: Record<string, unknown>): string {
  const customer = (order.customer || {}) as Record<string, unknown>
  const items = Array.isArray(order.products) ? order.products : []

  const lines = items.map((item: Record<string, unknown>, index: number) => {
    const product = (item.product || {}) as Record<string, unknown>
    const variant = [item.size && `O'lcham: ${item.size}`, item.color && `Rang: ${item.color}`]
      .filter(Boolean)
      .join(', ')
    return (
      `${index + 1}. ${escapeHtml(product.name)} — ${item.quantity} dona` +
      (variant ? `\n    <i>${escapeHtml(variant)}</i>` : '')
    )
  })

  return (
    `🛒 <b>YANGI BUYURTMA ${escapeHtml(order.orderNumber)}</b>\n\n` +
    `👤 ${escapeHtml(customer.name)}\n` +
    `📞 ${escapeHtml(customer.phone)}\n` +
    `📍 ${escapeHtml(customer.address)}\n` +
    (customer.comment ? `💬 ${escapeHtml(customer.comment)}\n` : '') +
    `\n${lines.join('\n')}\n\n` +
    `💳 To'lov: ${escapeHtml(customer.paymentMethod)}\n` +
    `💰 Jami: <b>${Number(order.total || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} so'm</b>`
  )
}

export { adminPanelUrl }
