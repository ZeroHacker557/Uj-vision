/**
 * UJ VISION brend va kompaniya ma'lumotlari — bitta manba.
 *
 * Bot username, domen va aloqa raqamlari shu yerda turadi; ilovaning
 * qolgan qismi faqat shu konstantalarga murojaat qiladi. Yangi bot
 * tokeni / domen kelganda o'zgartiriladigan yagona fayl (bot tomonida
 * esa bot/config.py).
 */
export const BRAND = {
  name: 'UJ VISION',
  legalName: 'UJ VISION',
  tagline: 'Kiyimlar do‘koni',
  taglineRu: 'Магазин одежды',

  /** Telegram bot — mini app shu bot ichida ochiladi. */
  // TODO(UJ): @BotFather dan olingan yangi bot username'ini yozing.
  botUsername: 'ujvision_bot',

  /** Mijozlar xizmati. */
  // TODO(UJ): haqiqiy raqam va manzillarni yozing.
  phone: '+998 97 400 98 77',
  phoneHref: 'tel:+998974009877',
  email: 'info@ujvision.uz',
  telegram: '@ujvision',
  telegramHref: 'https://t.me/ujvision',

  /** Ish vaqti va manzil — bot javoblarida ham ishlatiladi. */
  city: "Toshkent, O'zbekiston",
  workHours: '10:00 — 21:00',
} as const

/**
 * Ilovani ishlab chiqqan dasturchi — "Yordam" sahifasidagi alohida blok.
 * Texnik savollar UJ VISION mijozlar xizmatiga emas, shu manzillarga tushadi.
 */
export const DEVELOPER = {
  name: 'Abubakr.A',
  phone: '+998 97 400 98 77',
  phoneHref: 'tel:+998974009877',
  telegram: '@for_name',
  telegramHref: 'https://t.me/for_name',
  email: 'abubakrfrontend@gmail.com',
} as const

export const BOT_URL = `https://t.me/${BRAND.botUsername}`
