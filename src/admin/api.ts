/**
 * Admin panel bilan server orasidagi yagona kanal.
 *
 * Barcha amallar `/api/admin` ga POST qilinadi va `action` maydoni
 * bilan ajratiladi. Sessiya HttpOnly cookie'da — uni JS o'qiy olmaydi,
 * shuning uchun bu yerda token bilan ishlash yo'q: brauzer cookie'ni
 * o'zi qo'shadi.
 */

export class AdminApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
  }
}

/** Sessiya tugaganda chaqiriladi — panel kirish ekraniga qaytadi. */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

export async function adminPost<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, ...params }),
    })
  } catch {
    throw new AdminApiError("Serverga ulanib bo'lmadi. Internetni tekshiring.", 0)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    // Sessiya tugagan — kirish oynasiga qaytaramiz. `me` bundan mustasno:
    // u sessiya bor-yo'qligini ataylab tekshiradi.
    if (response.status === 401 && action !== 'me' && action !== 'login') {
      onUnauthorized?.()
    }
    const message =
      (payload && typeof payload.error === 'string' && payload.error) || 'Amal bajarilmadi'
    throw new AdminApiError(message, response.status)
  }

  return payload as T
}

/**
 * Rasmni brauzerda kichraytirib, base64 ga aylantiradi.
 *
 * Serverless so'rov tanasi ~4.5 MB bilan cheklangan, telefonda olingan
 * surat esa bemalol 5 MB dan oshadi. Shuning uchun yuborishdan oldin
 * eni 1400px gacha kichraytiriladi va WEBP ga o'tkaziladi — sifat
 * ko'zga bilinmaydi, hajm esa bir necha barobar kamayadi.
 */
export function fileToDataUrl(file: File, maxSize = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Faqat rasm fayllarini yuklash mumkin'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Rasmni ochib bo‘lmadi'))
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.round(image.width * scale)
        const height = Math.round(image.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Brauzer rasmni qayta ishlay olmadi'))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/webp', 0.86))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/** 150000 → "150 000" */
export function money(amount: unknown): string {
  const value = Math.round(Number(amount) || 0)
  // ru-RU minglikni uzilmas probel bilan ajratadi — oddiy probelga almashtiramiz
  return value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
}

/** ISO sanadan "12-sen, 14:30" ko'rinishidagi qisqa matn. */
export function shortDate(iso: unknown): string {
  const parsed = Date.parse(String(iso ?? ''))
  if (Number.isNaN(parsed)) return '—'
  return new Date(parsed).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
