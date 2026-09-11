# Ishga tushirish qo'llanmasi

Loyiha to'rt qismdan iborat:

| Qism | Qayerda ishlaydi | Vazifasi |
|---|---|---|
| Mini app (`/`) | Vercel (statik) | Katalog, savat, buyurtma formasi — Telegram ichida |
| Admin panel (`/admin`) | Vercel (statik) | Buyurtma, mahsulot, mijoz, statistika — brauzerda, login/parol bilan |
| `/api/*` | Vercel (serverless) | Telegram imzosi, buyurtma yaratish, admin amallari, xabarnomalar |
| Bot | Sizning kompyuteringiz | Do'konni ochish, buyurtmalar tarixi, to'lov cheklarini qabul qilish |

> Bot endi admin panel emas. Mahsulot qo'shish, buyurtma holatini
> o'zgartirish va statistika — hammasi `/admin` sahifasida. Bot faqat
> mijoz bilan gaplashadi va chek rasmini qabul qiladi.

---

## 0. UJ VISION ga o'tish — to'ldiriladigan qiymatlar

Loyiha UJ VISION brendiga o'tkazildi: ranglar, matnlar, logotip, favicon,
kategoriyalar, ikonkalar va bot javoblari.

Kodda qolgan `TODO(UJ)` belgilari — ataylab keyinga qoldirilgan qiymatlar
(aloqa ma'lumotlari va to'lov kartasi). Ularni topish uchun:
`grep -rn "TODO(UJ)" src bot`.

| Nima | Qayerga | Holat |
|---|---|---|
| Bot tokeni | `bot/.env` (git'ga tushmaydi) | ✅ yozildi |
| **Bot tokeni** | Vercel env `BOT_TOKEN` | ❌ **siz qo'shasiz** |
| **Service account JSON** | Vercel env `FIREBASE_SERVICE_ACCOUNT` | ❌ **siz qo'shasiz** |
| **BotFather `/setdomain`** → `uj-vision.vercel.app` | Telegram | ❌ **siz qilasiz** |
| **Firestore Rules** (4-bo'lim) | Firebase Console | ❌ **siz qilasiz** |
| Bot username `@ujvision_robot` | `bot/config.py`, `src/config/brand.ts` | ✅ yozildi |
| Firebase web config | `src/config/firebase.ts` (`uj-vision-kiyimdokon`) | ✅ yozildi |
| Service account fayli va bucket | `bot/config.py`, loyiha ildizida JSON | ✅ yozildi |
| Mini app domeni | `bot/config.py` → `MINI_APP_URL` | ✅ yozildi |
| Admin Telegram ID `7203124812` | `bot/config.py` → `ADMIN_IDS` | ✅ eskisi qoldirildi |
| Aloqa raqami / email / Telegram | `src/config/brand.ts` va `bot/config.py` | ⬜ namunaviy, keyin almashtiriladi |
| To'lov kartasi | `bot/config.py` → `CARD_NUMBER`, `CARD_OWNER` | ⬜ eskisi qoldirildi |
| Logotip va favicon | `src/images/uj-mark.webp`, `public/favicon-*.png` | ✅ yaratildi |
| Brend ranglari va matnlar | `src/styles.css`, `src/i18n/*` | ✅ UJ VISION ga moslandi |
| Kategoriyalar va ikonkalar | `src/config/categories.ts`, `bot/firebase_db.py` | ✅ kiyimga moslandi |
| Hero surati | `src/pages/HomePage.tsx` | ⬜ ixtiyoriy (hozir fotosiz) |

> **Bot tokeni hech qachon git'ga tushmaydi.** U `bot/.env` da, `.gitignore`
> esa uni to'sadi. `bot/config.py` faqat `os.environ` dan o'qiydi. Yangi
> muhitda ishga tushirishdan oldin:
>
> ```
> cp bot/.env.example bot/.env
> ```
>
> va tokenni yozing. Token bo'lmasa bot tushunarli xabar bilan to'xtaydi.

> Firebase web config (`apiKey` va h.k.) maxfiy emas — Firebase uni brauzerga
> ataylab ochiq beradi, himoya Firestore Rules tomonida. Shuning uchun u env
> o'zgaruvchi emas, oddiy fayl.

> ⚠️ `src/config/firebase.ts` dagi `projectId` bot ishlatadigan service
> account bilan **bir xil loyihaga** tegishli bo'lishi shart. Aks holda bot
> bir bazaga yozadi, ilova boshqasidan o'qiydi — katalog bo'sh ko'rinadi.

Brend ranglari va shriftlari `src/styles.css` dagi CSS tokenlarida —
komponentlarda hex yozilmagan, shuning uchun rang o'zgartirish bitta joyda.

## 1. Bot tokeni

Token `bot/.env` da saqlanadi va git'ga tushmaydi. Uni almashtirish kerak
bo'lsa:

1. Telegram'da [@BotFather](https://t.me/BotFather) ni oching
2. `/mybots` → botni tanlang → **API Token**
3. Yangi tokenni `bot/.env` ga va Vercel env `BOT_TOKEN` ga yozing —
   **ikkalasi bir xil bo'lishi shart**

`initData` imzosi aynan shu token bilan tekshiriladi: token va Vercel'dagi
qiymat mos kelmasa, mini app "Tizimga kirilmagan" xatosini beradi.

> ⚠️ Bu repozitoriy oldingi loyihalardan (V7, MUSA) nusxalangan. Git
> tarixida eski `ecommercy_test_bot` tokeni ochiq qolgan, `bot/.env`
> faylida esa hozir ham eski token turibdi. UJ VISION uchun **yangi bot**
> oching va eski tokenlarni @BotFather → **Revoke current token** bilan
> bekor qiling — aks holda tokenni topgan odam o'sha bot nomidan ish
> yurita oladi.

---

## 2. Vercel Environment Variables

Vercel loyihasi → **Settings** → **Environment Variables**. Ikkalasini ham
Production, Preview va Development uchun qo'shing.

### `BOT_TOKEN`
Yuqorida olingan yangi token.

### `FIREBASE_SERVICE_ACCOUNT`
Firebase Console → ⚙️ **Project Settings** → **Service accounts** →
**Generate new private key**. Yuklab olingan JSON faylni matn muharririda
oching va **butun mazmunini** (`{` dan `}` gacha) qiymat sifatida joylang.

### `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`
Admin panelga kirish. Parol ochiq saqlanmaydi — faqat scrypt hash.
Yangi parol uchun hash yasash:

```
node -e "const{randomBytes,scryptSync}=require('crypto');const p=process.argv[1];const s=randomBytes(16);console.log('scrypt:'+s.toString('hex')+':'+scryptSync(p,s,32).toString('hex'))" "PAROLINGIZ"
```

`ADMIN_SESSION_SECRET` — istalgan uzun tasodifiy satr:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### `ADMIN_TELEGRAM_IDS`
Yangi buyurtma va to'lov cheki haqidagi xabarni kim oladi. Bir nechta
bo'lsa vergul bilan: `123456,789012`. Bot tomonidagi nusxasi —
`bot/config.py` → `ADMIN_IDS`.

### Ixtiyoriy
`FIREBASE_STORAGE_BUCKET` va `PUBLIC_APP_URL` — ko'rsatilmasa,
`uj-vision-kiyimdokon.firebasestorage.app` va
`https://uj-vision.vercel.app` ishlatiladi.

> Loyiha ildizida eski loyihalarning (`ecommercytest`, `musa-onlineshop`,
> `v7-savdo`) `*-firebase-adminsdk-*.json` fayllari turibdi. Ular
> `.gitignore` da — git'ga tushmagan, lekin diskda bor: UJ VISION kalitini
> qo'shgandan keyin ularni o'chirib tashlang.

Env o'zgaruvchilarni qo'shgandan keyin **qaytadan deploy qiling** —
Vercel ularni faqat yangi build'ga qo'llaydi.

---

## 2.5. Admin panel

Panel `https://<domeningiz>/admin` manzilida ochiladi — Telegram kerak
emas, oddiy brauzerda ishlaydi.

Bo'limlar:

| Bo'lim | Nima qiladi |
|---|---|
| Boshqaruv paneli | Buyurtma va tushum statistikasi, 14 kunlik grafik, qoldiq tugayotgan mahsulotlar |
| Buyurtmalar | Yangi → Qabul qilindi → Yetkazildi. Chekni ko'rish, to'lovni tasdiqlash |
| Mahsulotlar | Qo'shish, tahrirlash, rasm yuklash, tartibni o'zgartirish |
| Kategoriyalar | Tayyor ikonkalar ro'yxatidan tanlab qo'shish |
| Mijozlar | Ro'yxat, telefon, manzillar, xaridlar summasi |
| Xabar yuborish | Barcha yoki faqat xarid qilgan mijozlarga Telegram xabari |
| Sozlamalar | Karta, yetkazib berish narxi, aloqa ma'lumotlari, promokodlar, parol |

Xavfsizlik:

- Parol serverda scrypt hash bilan solishtiriladi, ochiq ko'rinishda
  hech qayerda saqlanmaydi.
- Sessiya — HttpOnly cookie'dagi imzolangan token (12 soat). JavaScript
  uni o'qiy olmaydi.
- Ketma-ket 5 marta noto'g'ri parol kiritilsa, hisob 15 daqiqaga
  bloklanadi.
- Barcha yozish amallari serverda bajariladi; brauzer Firestore'ga
  to'g'ridan-to'g'ri yoza olmaydi (`firestore.rules`).

> Parolni panelning o'zidan o'zgartirish mumkin: **Sozlamalar →
> Xavfsizlik**. Yangi hash Firestore'ga yoziladi va env'dagi qiymatdan
> ustun turadi.

---

## 3. Firebase Authentication'ni yoqing

Firebase Console → **Authentication** → **Get started**.

Custom token bilan kirish uchun alohida provider yoqish shart emas, lekin
Authentication bo'limi bir marta ishga tushirilgan bo'lishi kerak.

---

## 4. Firestore Rules'ni yangilang

Loyiha ildizidagi [`firestore.rules`](./firestore.rules) faylini oching va
mazmunini Firebase Console → **Firestore Database** → **Rules** ga nusxalab,
**Publish** bosing.

Yoki Firebase CLI bilan:

```bash
firebase deploy --only firestore:rules
```

Qoidalar nima qiladi:

- **products, categories** — hamma o'qiydi, hech kim yozmaydi (faqat bot)
- **orders** — foydalanuvchi faqat o'zinikini o'qiydi, yozish butunlay yopiq
  (buyurtmani `/api/orders` yaratadi)
- **users** — faqat o'z hujjati, faqat `first_name`, `last_name`, `phone`,
  `addresses` maydonlari
- **promocodes** — mijoz umuman ko'ra olmaydi
- **counters** — faqat server

> ⚠️ Rules'ni yangilashdan **oldin** yangi kodni deploy qiling. Aks holda
> eski mini app buyurtma yarata olmay qoladi (u to'g'ridan-to'g'ri yozardi).

---

## 5. To'g'ri tartib

```
1. Yangi kodni Vercel'ga deploy qiling (env o'zgaruvchilar bilan)
2. /admin ga kirib, kategoriya va mahsulot qo'shing
3. Mini appni ochib, buyurtma berib ko'ring — ishlashi kerak
4. Shundan keyin Firestore Rules'ni yangilang
5. Yana bir buyurtma berib tekshiring
6. bot/.env dagi tokenni tekshiring va botni qayta ishga tushiring
```

---

## 6. Tekshirish ro'yxati

**Do'kon**
- [ ] Mini app Telegram'da ochiladi, katalog ko'rinadi
- [ ] Brauzerda `/` ochilsa "Telegram'da ochish" ekrani chiqadi
- [ ] Buyurtma berilganda adminga Telegram xabari keladi, raqami `#1001` ko'rinishida
- [ ] "Buyurtmalarim" bo'limida buyurtma ko'rinadi
- [ ] Promokod qo'llanganda chegirma to'g'ri hisoblanadi
- [ ] Karta bilan to'lovda chek yuborish oqimi ishlaydi

**Admin panel**
- [ ] `/admin` ochiladi, noto'g'ri parol rad etiladi
- [ ] Mahsulot qo'shiladi va rasm yuklanadi
- [ ] Kategoriya ikonkasi mini app'da ham xuddi shunday ko'rinadi
- [ ] Buyurtma "Qabul qilindi" ga o'tkazilganda mijozga xabar boradi
- [ ] Chek rasmi buyurtma kartasida ko'rinadi
- [ ] Sozlamalardagi karta raqami mini app'dagi to'lov oynasida ko'rinadi
- [ ] Telefonda ham yon menyu va jadvallar qulay ochiladi

### Xatolarni qayerdan ko'rish

- **Mini app:** Telegram Desktop → mini app ustida o'ng tugma → Inspect
- **API:** Vercel → loyiha → **Logs** (`[auth]`, `[orders]`, `[promo]` teglari)
- **Bot:** terminal oynasidagi log

---

## Ma'lum cheklovlar

- **Bot shaxsiy kompyuterda ishlaydi.** Kompyuter o'chsa, mijoz botga
  yozolmaydi va chek yuborolmaydi. Lekin yangi buyurtma haqidagi xabarni
  bot emas, `/api/orders` yuboradi — shuning uchun bot o'chiq bo'lsa ham
  admin xabardor bo'ladi va panelda hammasini boshqara oladi. Doimiy
  ishlashi kerak bo'lsa, botni VPS yoki Railway'ga ko'chiring va
  `bot/.env` faylini birga olib o'ting (u git'da yo'q).
- **Ommaviy xabar sekin ketadi.** Telegram sekundiga cheklangan sonda
  xabar qabul qiladi, shuning uchun mijozlar ko'p bo'lsa "Xabar yuborish"
  bir necha soniya davom etadi — sahifani yopmang.
