import { categoryIcon } from '../utils/category-icons'

/**
 * Kategoriya uchun tayyor ikonkalar ro'yxati.
 *
 * Kalitlar `src/utils/category-icons.ts` dagi BY_KEY bilan bir xil —
 * admin shu yerdan tanlaydi, mini app esa o'sha kalit bo'yicha aynan
 * shu ikonkani chizadi. Yangi ikonka qo'shish uchun ikkala faylga ham
 * kalit qo'shiladi.
 */
export const ICON_CHOICES: { key: string; label: string }[] = [
  { key: 'tepa', label: 'Tepa kiyim' },
  { key: 'pastgi', label: 'Pastgi kiyim' },
  { key: 'oyoq', label: 'Oyoq kiyim' },

  { key: 'koylak', label: "Ko'ylak" },
  { key: 'futbolka', label: 'Futbolka' },
  { key: 'polo', label: 'Polo' },
  { key: 'kozok', label: "Ko'zok" },
  { key: 'hoodie', label: 'Hudi' },
  { key: 'kurtka', label: 'Kurtka' },
  { key: 'palto', label: 'Palto' },
  { key: 'plash', label: 'Plash' },
  { key: 'kostyum', label: 'Kostyum' },
  { key: 'pidjak', label: 'Pidjak' },

  { key: 'shim', label: 'Shim' },
  { key: 'jeans', label: 'Jinsi' },
  { key: 'shortik', label: 'Shortik' },
  { key: 'yubka', label: 'Yubka' },
  { key: 'dress', label: 'Libos' },

  { key: 'krossovka', label: 'Krossovka' },
  { key: 'botinka', label: 'Botinka' },
  { key: 'tufli', label: 'Tufli' },
  { key: 'paypoq', label: 'Paypoq' },

  { key: 'sumka', label: 'Sumka' },
  { key: 'ryukzak', label: 'Ryukzak' },
  { key: 'hamyon', label: 'Hamyon' },
  { key: 'kamar', label: 'Kamar' },
  { key: 'soat', label: 'Soat' },
  { key: 'kozoynak', label: "Ko'zoynak" },
  { key: 'zargarlik', label: 'Taqinchoq' },
  { key: 'shapka', label: 'Bosh kiyim' },

  { key: 'bolalar', label: 'Bolalar' },
  { key: 'premium', label: 'Premium' },
  { key: 'yangi', label: 'Yangi' },
  { key: 'set', label: "To'plam" },
  { key: 'all', label: 'Barchasi' },
  { key: 'box', label: 'Boshqa' },
]

/** Tanlangan kalit bo'yicha komponent — mini app bilan bir xil. */
export const iconFor = categoryIcon
