/**
 * Telegram Bot API ga oddiy xabar yuborish.
 *
 * Bot jarayoni har doim ham ishlab turmasligi mumkin, shuning uchun
 * mijozga va adminlarga xabarni serverless funksiyalarning o'zi
 * yuboradi — bot faqat foydalanuvchi bilan suhbat uchun qoladi.
 */

const API = 'https://api.telegram.org/bot'

export type InlineButton = { text: string; url: string }

function botToken(): string {
  const token = process.env.BOT_TOKEN
  if (!token) throw new Error('BOT_TOKEN sozlanmagan')
  return token
}

/** HTML parse_mode uchun xavfli belgilarni almashtiradi. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Bitta chatga xabar yuboradi.
 *
 * Xato bo'lsa tashlamaydi — faqat `false` qaytaradi: xabar yetib
 * bormagani uchun buyurtma yaratish yoki status o'zgartirish
 * to'xtamasligi kerak. Sabab jurnalga yoziladi.
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  buttons?: InlineButton[],
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }
    if (buttons?.length) {
      body.reply_markup = { inline_keyboard: buttons.map((button) => [button]) }
    }

    const response = await fetch(`${API}${botToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      console.error('[telegram] sendMessage:', response.status, await response.text())
      return false
    }
    return true
  } catch (error) {
    console.error('[telegram] sendMessage xatosi:', error)
    return false
  }
}

/** Bir nechta chatga ketma-ket yuboradi va nechtasi yetib borganini qaytaradi. */
export async function sendToMany(
  chatIds: (number | string)[],
  text: string,
  buttons?: InlineButton[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  for (const chatId of chatIds) {
    const ok = await sendMessage(chatId, text, buttons)
    if (ok) sent += 1
    else failed += 1
    // Telegram sekundiga ~30 xabarga ruxsat beradi — ozgina pauza
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  return { sent, failed }
}

/**
 * Adminlarning Telegram id'lari.
 *
 * Vercel env: ADMIN_TELEGRAM_IDS="123,456". Bo'sh bo'lsa hech kimga
 * xabar ketmaydi (xato emas — shunchaki xabarnoma o'chirilgan bo'ladi).
 */
export function adminChatIds(): number[] {
  return String(process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0)
}

/** Admin panelning manzili — xabarlardagi tugma shu yerga olib boradi. */
export function adminPanelUrl(path = ''): string {
  const base = String(process.env.PUBLIC_APP_URL || 'https://uj-vision.vercel.app').replace(
    /\/+$/,
    '',
  )
  return `${base}/admin${path}`
}
