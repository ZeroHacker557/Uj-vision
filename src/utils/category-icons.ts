import {
  Backpack, Baby, Briefcase, Crown, Footprints, Gem, Glasses, Grid2X2,
  Handbag, HardHat, Hand, Layers, Package, PersonStanding, Shirt, SportShoe,
  Sparkles, Umbrella, Watch, Wallet, Wind,
  type LucideIcon,
} from 'lucide-react'

/**
 * Kategoriya ikonkasi.
 *
 * Avval bazadagi `icon` maydoniga qaraydi (admin tanlagan), topilmasa
 * nom bo'yicha taxmin qiladi, u ham bo'lmasa umumiy ko'ylak ishlatiladi.
 * Ilgari faqat oldindan yozilgan nomlar bilan solishtirilardi, shuning
 * uchun har qanday yangi kategoriya doim quti bo'lib qolardi (F-17).
 *
 * Ro'yxat UJ VISION assortimentiga moslangan: tepa kiyimlar (ko'ylak,
 * futbolka, ko'zok, kurtka, kostyum), pastgi kiyimlar (shim, jinsi,
 * shortik, yubka), oyoq kiyimlar va aksessuarlar.
 */
const BY_KEY: Record<string, LucideIcon> = {
  all: Grid2X2,

  // Asosiy yo'nalishlar (config/categories.ts dagi kalitlar)
  tepa: Shirt,
  pastgi: PersonStanding,
  oyoq: SportShoe,

  // Tepa kiyimlar
  shirt: Shirt,
  koylak: Shirt,
  futbolka: Shirt,
  tshirt: Shirt,
  polo: Shirt,
  kozok: Layers,
  sviter: Layers,
  hoodie: Layers,
  tolstovka: Layers,
  kurtka: Wind,
  palto: Wind,
  jacket: Wind,
  plash: Umbrella,
  jilet: Layers,
  kostyum: Briefcase,
  suit: Briefcase,
  pidjak: Briefcase,

  // Pastgi kiyimlar
  shim: PersonStanding,
  pants: PersonStanding,
  jeans: PersonStanding,
  shortik: PersonStanding,
  yubka: PersonStanding,
  dress: PersonStanding,
  libos: PersonStanding,

  // Oyoq kiyimlar
  poyabzal: SportShoe,
  shoes: SportShoe,
  krossovka: SportShoe,
  botinka: SportShoe,
  tufli: SportShoe,
  shippak: SportShoe,
  paypoq: Footprints,

  // Aksessuarlar
  sumka: Handbag,
  bag: Handbag,
  ryukzak: Backpack,
  hamyon: Wallet,
  kamar: Hand,
  soat: Watch,
  watch: Watch,
  kozoynak: Glasses,
  zargarlik: Gem,
  taqinchoq: Gem,
  bosh_kiyim: HardHat,
  shapka: HardHat,
  kepka: HardHat,

  // Boshqa
  bolalar: Baby,
  kids: Baby,
  premium: Crown,
  yangi: Sparkles,
  new: Sparkles,
  set: Layers,
  box: Package,
}

const BY_NAME: [RegExp, LucideIcon][] = [
  // Asosiy yo'nalishlar — bazadagi nom bilan kelganda ham tanilsin
  [/tepa kiyim|верхн(яя|ие) одежд|tops?\b/i, Shirt],
  [/pastgi kiyim|нижн(яя|ие) одежд|bottoms?\b/i, PersonStanding],
  [/oyoq kiyim|обув/i, SportShoe],
  [/bola|kids|child|детск|дети/i, Baby],
  [/ko'?ylak|koylak|koʻylak|рубашк|сорочк|shirt/i, Shirt],
  [/futbolka|t-?shirt|polo|футболк|поло/i, Shirt],
  [/ko'?zok|sviter|svitr|hoodie|tolstovka|свитер|худи|толстовк|кофт/i, Layers],
  [/kurtka|palto|plash|куртк|пальто|плащ|jacket|coat/i, Wind],
  [/kostyum|pidjak|костюм|пиджак|suit|blazer/i, Briefcase],
  [/shim|jeans|jinsi|shortik|брюк|джинс|шорт|штан|pants/i, PersonStanding],
  [/yubka|libos|ko'?ylakcha|платье|юбк|dress|skirt/i, PersonStanding],
  [/poyabzal|krossovka|botinka|tufli|shippak|кроссовк|ботинк|туфл|shoes|sneaker/i, SportShoe],
  [/paypoq|носк|socks/i, Footprints],
  [/sumka|сумк|bag|clutch/i, Handbag],
  [/ryukzak|рюкзак|backpack/i, Backpack],
  [/hamyon|кошел|портмоне|wallet/i, Wallet],
  [/kamar|ремен|поясь?|belt/i, Hand],
  [/soat|час(ы|ов)|watch/i, Watch],
  [/ko'?zoynak|очк|glasses|sunglass/i, Glasses],
  [/zargar|taqinchoq|bijut|украшен|ювелир|jewel/i, Gem],
  [/shapka|kepka|bosh kiyim|шапк|кепк|головн|hat|cap/i, HardHat],
  [/aksessuar|аксессуар|accessor/i, Watch],
  [/premium|lyuks|люкс|премиум/i, Crown],
  [/yangi|nov(inka|yy)|нов(ый|инк)|new/i, Sparkles],
  [/to'?plam|set|combo|набор/i, Layers],
  [/barcha|hamma|все|all/i, Grid2X2],
]

/**
 * Bot yangi kategoriyaga doim "package" yozadi — bu "tanlanmagan" degani.
 * Shuning uchun uni e'tiborsiz qoldirib, nom bo'yicha aniqlashga o'tamiz.
 */
const UNSET_ICONS = new Set(['', 'package', 'Package'])

export function categoryIcon(icon?: string, name?: string): LucideIcon {
  if (icon && !UNSET_ICONS.has(icon.trim())) {
    const found = BY_KEY[icon.toLowerCase().trim()]
    if (found) return found
  }
  if (name) {
    for (const [pattern, Icon] of BY_NAME) {
      if (pattern.test(name)) return Icon
    }
  }
  return Shirt
}
