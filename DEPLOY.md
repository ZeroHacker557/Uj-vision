# Ishga tushirish qo'llanmasi

3-blokdagi xavfsizlik o'zgarishlaridan keyin loyiha uchta qismdan iborat:

| Qism | Qayerda ishlaydi | Vazifasi |
|---|---|---|
| Mini app | Vercel (statik) | Katalog, savat, buyurtma formasi |
| `/api/*` | Vercel (serverless) | Telegram imzosini tekshirish, buyurtma yaratish, promokod |
| Bot | Sizning kompyuteringiz | Admin panel, buyurtma xabarnomalari, to'lov cheklari |

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

> Loyiha ildizida eski loyihalarning (`ecommercytest`, `musa-onlineshop`,
> `v7-savdo`) `*-firebase-adminsdk-*.json` fayllari turibdi. Ular
> `.gitignore` da — git'ga tushmagan, lekin diskda bor: UJ VISION kalitini
> qo'shgandan keyin ularni o'chirib tashlang.

Env o'zgaruvchilarni qo'shgandan keyin **qaytadan deploy qiling** —
Vercel ularni faqat yangi build'ga qo'llaydi.

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
2. Mini appni ochib, buyurtma berib ko'ring — ishlashi kerak
3. Shundan keyin Firestore Rules'ni yangilang
4. Yana bir buyurtma berib tekshiring
5. bot/.env dagi tokenni tekshiring va botni qayta ishga tushiring
```

---

## 6. Tekshirish ro'yxati

- [ ] Mini app Telegram'da ochiladi, katalog ko'rinadi
- [ ] Brauzerda ochilsa "Telegram'da ochish" ekrani chiqadi
- [ ] Buyurtma berilganda adminga xabar keladi, raqami `#1001` ko'rinishida
- [ ] "Buyurtmalarim" bo'limida buyurtma ko'rinadi
- [ ] Promokod qo'llanganda chegirma to'g'ri hisoblanadi
- [ ] Bot o'chirilgan holda buyurtma berilsa, bot yoqilganda xabar keladi
- [ ] Karta bilan to'lovda chek yuborish oqimi ishlaydi

### Xatolarni qayerdan ko'rish

- **Mini app:** Telegram Desktop → mini app ustida o'ng tugma → Inspect
- **API:** Vercel → loyiha → **Logs** (`[auth]`, `[orders]`, `[promo]` teglari)
- **Bot:** terminal oynasidagi log

---

## Ma'lum cheklovlar

- **Bot shaxsiy kompyuterda ishlaydi** — kompyuter o'chsa, admin xabarnomalari
  kechikadi. Buyurtmalar yo'qolmaydi (`notified` bayrog'i tufayli), lekin
  admin ularni faqat bot yoqilganda ko'radi. Doimiy ishlashi kerak bo'lsa,
  botni VPS yoki Railway'ga ko'chirish kerak.
- **Bot lokal ishlaydi** — hozircha VPS'ga ko'chirilmagan. Ko'chirilganda
  `bot/.env` faylini ham birga olib o'tish kerak (u git'da yo'q).
