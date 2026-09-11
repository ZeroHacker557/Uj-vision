import tepa from '../images/cat-tepa.webp'
import pastgi from '../images/cat-pastgi.webp'
import oyoq from '../images/cat-oyoq.webp'
import type { Category } from '../types/domain'

/**
 * UJ VISION ning uchta asosiy yo'nalishi.
 *
 * Bular Firestore'dan emas, shu yerdan keladi — bozorga chiqish
 * yo'nalishlari kamdan-kam o'zgaradi va katalog bo'sh bo'lganda ham
 * ko'rinib turishi kerak. Bot admin paneli orqali qo'shiladigan mayda
 * kategoriyalar (Ko'ylaklar, Futbolkalar, Kurtkalar...) esa bazadan
 * keladi va shularning yoniga qo'shiladi.
 *
 * ⚠️ `name` — mahsulotning Firestore'dagi `category` maydoni bilan
 * AYNAN mos bo'lishi shart. Bot admin panelida mahsulot qo'shganda
 * kategoriya nomi shu ro'yxatdan tanlanadi, shunda filtr ishlaydi.
 * Nomni o'zgartirsangiz, bot tomonidagi nusxasini ham o'zgartiring:
 * bot/firebase_db.py → MAIN_CATEGORIES.
 */
export type MainLine = {
  name: string
  /** category-icons.ts dagi kalit. */
  icon: string
  /** Karta foni — brend ko'kining uch pog'onasi. */
  gradient: string
  /**
   * Foto — gradient o'rniga ko'rinadi. Rasmning nisbati karta bilan
   * bir xil bo'lsin, aks holda `cover` uni qirqadi: keng karta 2.2:1
   * (1320x600), yarim kartalar 1.27:1 (990x780).
   *
   * Rasmning chap tomonida bo'sh joy qoldiring — sarlavha o'sha yerda
   * turadi va uning ostiga qorong'i parda tushadi.
   */
  image?: string
}

export const MAIN_LINES: MainLine[] = [
  {
    name: 'Tepa kiyimlar',
    icon: 'tepa',
    gradient: 'linear-gradient(135deg, #26325a 0%, #0e1426 100%)',
    image: tepa,
  },
  {
    name: 'Pastgi kiyimlar',
    icon: 'pastgi',
    gradient: 'linear-gradient(135deg, #3a4a7d 0%, #161d38 100%)',
    image: pastgi,
  },
  {
    name: 'Oyoq kiyimlar',
    icon: 'oyoq',
    gradient: 'linear-gradient(135deg, #4a5675 0%, #1d2438 100%)',
    image: oyoq,
  },
]

const MAIN_NAMES = new Set(MAIN_LINES.map((line) => line.name.toLowerCase()))

/** Yo'nalish nomimi? Bosh sahifadagi lentada takrorlanmasligi uchun. */
export function isMainLine(name: string): boolean {
  return MAIN_NAMES.has(name.trim().toLowerCase())
}

/**
 * Yo'nalishlarni bazadagi kategoriyalar bilan birlashtiradi.
 *
 * Yo'nalishlar oldinda turadi; bazada shu nomli kategoriya bo'lsa
 * ikki marta chiqmaydi. Identifikatorlar manfiy — bazadagi musbat
 * id'lar bilan to'qnashmaydi.
 */
export function withMainLines(dbCategories: Category[]): Category[] {
  const lines: Category[] = MAIN_LINES.map((line, index) => ({
    id: -100 - index,
    name: line.name,
    icon: line.icon,
  }))
  return [...lines, ...dbCategories.filter((c) => !isMainLine(c.name))]
}
