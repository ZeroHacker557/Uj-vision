"""
UJ VISION Shop Telegram Bot — mijozlar bilan muloqot.

UJ VISION — kiyimlar do'koni: tepa kiyimlar, pastgi kiyimlar,
oyoq kiyimlari.

Bot nima qiladi:
  • do'konni (mini app) ochadi va buyurtmalar tarixini ko'rsatadi;
  • karta bilan to'laganda mijozdan chek rasmini oladi, uni Firebase
    Storage'ga yuklaydi va adminga xabar beradi;
  • telefon raqamini bir bosishda saqlashni taklif qiladi.

Bot nima QILMAYDI: mahsulot qo'shish, buyurtma holatini o'zgartirish,
statistika — bularning hammasi web admin panelida (`/admin`). Ilgari
bu yerda katta admin paneli bor edi; u panelga ko'chirildi, chunki
Telegram tugmalarida jadval, qidiruv va rasm yuklash qulay emas.

Yangi buyurtma haqidagi xabarni ham bot emas, `/api/orders` yuboradi —
shunda bot ishlamay qolgan paytda ham admin xabardor bo'ladi.
"""
import asyncio
import json
import logging

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, WebAppInfo, InlineKeyboardButton,
    InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton,
    MenuButtonWebApp, CallbackQuery
)
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.client.default import DefaultBotProperties

from config import (
    BOT_TOKEN, MINI_APP_URL, ADMIN_IDS,
    SUPPORT_PHONE, SUPPORT_EMAIL, SUPPORT_TELEGRAM, COMPANY_CITY, WORK_HOURS,
)
import firebase_db as db

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

if not BOT_TOKEN:
    raise SystemExit(
        "BOT_TOKEN topilmadi. bot/.env faylini yarating va tokenni yozing:\n"
        "    cp bot/.env.example bot/.env"
    )

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
dp = Dispatcher(storage=MemoryStorage())

#: Admin panelning buyurtmalar bo'limi — xabarlardagi tugma shu yerga olib boradi.
ADMIN_PANEL_URL = MINI_APP_URL.rstrip("/") + "/admin/orders"


# ─── FSM ─────────────────────────────────────────────────────

class PaymentUpload(StatesGroup):
    waiting_photo = State()


# ─── Status emoji ─────────────────────────────────────────────
# Uchta holat: "Yangi" (hali ko'rilmagan) va admin qo'yadigan ikkitasi.

STATUS_EMOJI = {
    "Yangi":          "🟡",
    "Qabul qilindi":  "🟢",
    "Yetkazildi":     "🎉",
}


# ─── Klaviaturalar ────────────────────────────────────────────

def main_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            # Tugmaning o'zi mini appni ochadi. Yozuv maydoni yonidagi menyu
            # tugmasi (set_chat_menu_button) ham ishlaydi, lekin u kichkina va
            # ko'pchilik uni sezmaydi — asosiy kirish nuqtasi shu tugma.
            [KeyboardButton(text="👗 Katalogni ochish", web_app=WebAppInfo(url=MINI_APP_URL))],
            [KeyboardButton(text="📦 Buyurtmalarim")],
            [KeyboardButton(text="📞 Biz bilan aloqa"), KeyboardButton(text="ℹ️ Yordam")],
        ],
        resize_keyboard=True,
    )


def open_app_kb() -> InlineKeyboardMarkup:
    """
    Xabar ostidagi yirik "Do'konni ochish" tugmasi.

    Reply-klaviatura ba'zan yig'ilgan holda turadi yoki foydalanuvchi uni
    yopib qo'yadi — inline tugma esa xabarning o'zida qoladi, shuning uchun
    /start da ikkalasi ham beriladi.
    """
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="👗 Do'konni ochish", web_app=WebAppInfo(url=MINI_APP_URL))
    ]])


def contact_kb() -> ReplyKeyboardMarkup:
    """Telefon raqamini bir bosishda olish uchun (F-26)."""
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Raqamni yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def receipt_kb(order_id: str, again: bool = False) -> InlineKeyboardMarkup:
    label = "💳 Qayta chek yuborish" if again else "💳 To'lov chekini yuborish"
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=label, callback_data=f"receipt:{order_id}")]
    ])


def admin_panel_kb() -> InlineKeyboardMarkup:
    """Adminga yuboriladigan xabarlarda — panelga o'tish tugmasi."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Admin panelda ochish", url=ADMIN_PANEL_URL)]
    ])


# ─── Yordamchi funksiyalar ────────────────────────────────────

def get_display_name(order_data: dict) -> str:
    raw = order_data.get("username", "")
    if raw and " " not in raw.strip():
        return f"@{raw}"
    return raw or order_data.get("customer", {}).get("name", "—")


def variant_text(item: dict) -> str:
    """Mahsulot variantini "(O'lcham: M, Rang: Qora)" ko'rinishida beradi."""
    parts = []
    if item.get("size"):
        parts.append(f"O'lcham: {item['size']}")
    if item.get("color"):
        parts.append(f"Rang: {item['color']}")
    return f" ({', '.join(parts)})" if parts else ""


# Telegram rasm izohi (caption) uchun chegara
CAPTION_LIMIT = 1024


def build_receipt_caption(order: dict | None, display_id: str) -> str:
    """
    Adminga yuboriladigan chek izohi: mijoz ma'lumotlari, mahsulotlar
    (rangi va o'lchami bilan) hamda to'liq hisob-kitob.

    Telegram izohni 1024 belgi bilan cheklaydi — sig'masa mahsulotlar
    ro'yxati qisqartiriladi, mijoz ma'lumotlari esa doim to'liq qoladi.
    """
    head = "💳 <b>TO'LOV CHEKI KELDI</b>\n" + "━" * 22 + "\n\n"
    head += f"🧾 <b>Buyurtma:</b> {display_id}\n"

    if not order:
        return head + "\n⚠️ Buyurtma ma'lumotlari topilmadi."

    customer = order.get("customer", {})
    head += f"📅 {db.order_date_text(order)}\n\n"
    head += f"👤 <b>Ism:</b> {customer.get('name', '—')}\n"
    head += f"📱 <b>Telegram:</b> {get_display_name(order)}\n"
    head += f"📞 <b>Tel:</b> <code>{customer.get('phone', '—')}</code>\n"
    head += f"📍 <b>Manzil:</b> {customer.get('address', '—')}\n"
    if customer.get("comment"):
        head += f"💬 <b>Izoh:</b> {customer['comment']}\n"

    # ── Hisob-kitob ──
    tail = "\n" + "━" * 22 + "\n"
    subtotal = order.get("subtotal")
    discount = order.get("discount") or 0
    delivery_fee = order.get("deliveryFee") or 0
    if isinstance(subtotal, (int, float)) and (discount or delivery_fee):
        tail += f"🧾 Mahsulotlar: {db.format_price(subtotal)}\n"
        if discount:
            promo = order.get("promoCode")
            promo_text = f" ({promo})" if promo else ""
            tail += f"🏷 Chegirma{promo_text}: -{db.format_price(discount)}\n"
        if delivery_fee:
            tail += f"🚚 Yetkazish: {db.format_price(delivery_fee)}\n"
        else:
            tail += "🚚 Yetkazish: bepul\n"

    total = order.get("total", 0)
    total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)
    tail += f"💰 <b>To'langan summa: {total_str}</b>\n\n"
    tail += "<i>Chekni tasdiqlash panelda: Buyurtmalar → To'landi.</i>"

    # ── Mahsulotlar ──
    products = order.get("products", [])
    lines = []
    for i, item in enumerate(products, 1):
        qty = item.get("quantity", 1)
        prod = item.get("product") or item
        name = prod.get("name", "—")
        price = prod.get("price", 0)
        lines.append(
            f"  <b>{i}. {name}</b>{variant_text(item)}\n"
            f"     └ {qty} ta × {db.format_price(price)} = <b>{db.format_price(price * qty)}</b>\n"
        )

    body_header = "\n📦 <b>Mahsulotlar:</b>\n"
    shown = list(lines)
    while shown:
        hidden = len(lines) - len(shown)
        more = f"  <i>...va yana {hidden} ta mahsulot</i>\n" if hidden else ""
        caption = head + body_header + "".join(shown) + more + tail
        if len(caption) <= CAPTION_LIMIT:
            return caption
        shown.pop()

    return head + body_header + f"  <i>{len(lines)} ta mahsulot</i>\n" + tail


# ─── /start ──────────────────────────────────────────────────

@dp.message(F.text.startswith("/start"))
async def cmd_start(message: Message, state: FSMContext):
    user = message.from_user

    # ── Deep link: /start receipt_<hujjat_id> ──
    # Mini app "To'lov chekini yuborish" tugmasi shu havolani ochadi.
    parts = message.text.split(" ", 1)
    if len(parts) > 1 and parts[1].startswith("receipt_"):
        raw_id = parts[1].replace("receipt_", "").strip()
        order = db.get_order_by_id(raw_id) or db.get_order_by_id(f"#{raw_id}")

        if order:
            await state.update_data(receipt_order_id=order.get("_doc_id", raw_id))
            await state.set_state(PaymentUpload.waiting_photo)

            total = order.get("total", 0)
            total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)

            text = "💳 <b>To'lov ma'lumotlari</b>\n" + "━" * 22 + "\n\n"
            text += f"🆔 Buyurtma: <b>{db.order_display_id(order)}</b>\n"
            text += "📦 <b>Mahsulotlar:</b>\n"
            for item in order.get("products", []):
                prod = item.get("product") or item
                text += f"  • {prod.get('name', '—')}{variant_text(item)}"
                text += f" — {item.get('quantity', 1)} ta\n"
            text += f"\n💰 <b>Jami: {total_str}</b>\n\n"

            payment = db.get_payment_settings()
            if payment.get("cardNumber"):
                text += f"💳 <b>Karta:</b> <code>{payment['cardNumber']}</code>\n"
                text += f"👤 <b>Egasi:</b> {payment.get('cardOwner', '—')}\n\n"

            text += "📸 To'lov chekini (screenshot) shu yerga yuboring."
            await message.answer(text, reply_markup=main_kb())
            return

        await message.answer(
            "❌ Buyurtma topilmadi.\n"
            "Iltimos, mini appdagi «To'lov chekini yuborish» tugmasini qayta bosing.",
            reply_markup=main_kb(),
        )
        return

    # ── Oddiy /start ──
    text = (
        f"Assalomu alaykum, <b>{user.first_name}</b>! 👋\n\n"
        "👗 <b>UJ VISION rasmiy do'koniga xush kelibsiz!</b>\n"
        "<i>Tanlangan modellar — tekshirilgan mato va tikuv sifati.</i>\n\n"
        "🧥 <b>Tepa kiyimlar, pastgi kiyimlar va oyoq kiyimlari.</b>\n\n"
        "👇 <i>Buyurtmani boshlash uchun quyidagi tugmani bosing:</i>"
    )
    # Ikki xil tugma ataylab: reply-klaviatura doimiy turadi, inline tugma
    # esa shu xabarning o'zida qoladi — foydalanuvchi klaviaturani yopib
    # qo'ysa ham do'konga kirish yo'li ko'rinib turadi.
    await message.answer(text, reply_markup=main_kb())
    await message.answer("👇 <b>Do'konni shu yerdan oching:</b>", reply_markup=open_app_kb())

    # Telefon raqami hali saqlanmagan bo'lsa, bir bosishda so'raymiz.
    # Mini app buni buyurtma formasiga avtomatik qo'yadi (F-26).
    saved = db.get_user(user.id) or {}
    if not saved.get("phone"):
        await message.answer(
            "📱 <b>Telefon raqamingizni qoldiring</b>\n\n"
            "Buyurtma berganingizda uni qayta yozib o'tirmaysiz, "
            "kuryer esa siz bilan tez bog'lana oladi.\n\n"
            "<i>Ixtiyoriy — keyinroq ilovaning «Shaxsiy ma'lumotlar» "
            "bo'limidan ham kiritish mumkin.</i>",
            reply_markup=contact_kb(),
        )


@dp.message(F.contact)
async def handle_contact(message: Message):
    """Foydalanuvchi «Raqamni yuborish» tugmasini bosganda (F-26)."""
    contact = message.contact

    # Faqat o'z raqamini qabul qilamiz — boshqa odamning kontaktini emas
    if contact.user_id != message.from_user.id:
        await message.answer(
            "❌ Iltimos, <b>o'zingizning</b> raqamingizni yuboring.",
            reply_markup=contact_kb(),
        )
        return

    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = f"+{phone}"

    if db.set_user_phone(message.from_user.id, phone):
        await message.answer(
            f"✅ Raqamingiz saqlandi: <code>{phone}</code>\n\n"
            "Endi buyurtma berishda u avtomatik to'ldiriladi.",
            reply_markup=main_kb(),
        )
    else:
        await message.answer(
            "❌ Raqamni saqlab bo'lmadi. Keyinroq qayta urinib ko'ring.",
            reply_markup=main_kb(),
        )


# ─── Katalog ─────────────────────────────────────────────────

@dp.message(F.text == "👗 Katalogni ochish")
async def handle_open_catalog(message: Message):
    """
    Zaxira yo'l: tugmaga web_app biriktirilgan, shuning uchun odatda
    bosilganda mini app darhol ochiladi va bu handler ishlamaydi. Lekin
    eski klaviatura qolib ketgan yoki mini appni qo'llab-quvvatlamaydigan
    mijozda tugma oddiy matn yuboradi — o'shanda ochish tugmasini beramiz.
    """
    await message.answer(
        "👗 <b>UJ VISION KATALOGI</b>\n\n"
        "Do'kon Telegram ilovasi ichida ochiladi — quyidagi tugmani bosing.\n\n"
        "<i>Tugma ko'rinmasa, /start yuborib klaviaturani yangilang.</i>",
        reply_markup=open_app_kb(),
    )


# ─── Buyurtmalarim ───────────────────────────────────────────

@dp.message(F.text == "📦 Buyurtmalarim")
async def handle_my_orders(message: Message):
    orders = db.get_user_orders(message.from_user.id)

    if not orders:
        await message.answer(
            "📦 <b>Sizda hozircha buyurtmalar mavjud emas.</b>\n\n"
            "Katalogdan yoqqan modelni tanlab, birinchi buyurtmangizni bering! 👗"
        )
        return

    text = f"📦 <b>Buyurtmalarim</b> ({len(orders)} ta)\n" + "━" * 22 + "\n\n"
    buttons = []

    for order in orders[:10]:
        # oid — ko'rsatish uchun, doc_id — tugmalar uchun (F-03)
        oid = db.order_display_id(order)
        doc_id = order.get("_doc_id", "")
        total = order.get("total", 0)
        status = order.get("status", "Yangi")
        pay_method = order.get("paymentMethod", "Naqd")
        pay_status = order.get("paymentStatus", "")
        total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)
        date_str = db.order_date_text(order)

        text += f"🧾 <b>Buyurtma:</b> {oid}\n"
        if date_str != "—":
            text += f"📅 <b>Sana:</b> {date_str}\n"
        text += f"📊 <b>Holat:</b> {STATUS_EMOJI.get(status, '🟡')} {status}\n"

        if pay_method == "Karta":
            if pay_status == "Tolangan":
                text += "💳 <b>To'lov:</b> Karta (✅ Tasdiqlangan)\n"
            elif pay_status == "Rad etildi":
                text += "💳 <b>To'lov:</b> Karta (❌ Rad etilgan)\n"
                buttons.append([InlineKeyboardButton(
                    text=f"💳 {oid} — qayta chek", callback_data=f"receipt:{doc_id}")])
            else:
                text += "💳 <b>To'lov:</b> Karta (⏳ Chek kutilmoqda)\n"
                buttons.append([InlineKeyboardButton(
                    text=f"💳 {oid} — chek yuborish", callback_data=f"receipt:{doc_id}")])
        else:
            text += "💳 <b>To'lov:</b> 💵 Naqd (yetkazganda)\n"

        text += "\n🛍 <b>Mahsulotlar:</b>\n"
        for index, item in enumerate(order.get("products", []), 1):
            prod = item.get("product") or item
            text += f"  {index}. {prod.get('name', '—')}{variant_text(item)}"
            text += f" — <b>{item.get('quantity', 1)} ta</b>\n"

        text += f"\n💰 <b>Jami summa:</b> {total_str}\n"
        text += "━" * 22 + "\n\n"

    await message.answer(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons) if buttons else None,
    )


# ─── Chek yuborish ────────────────────────────────────────────

@dp.callback_query(F.data.startswith("receipt:"))
async def cb_start_receipt(callback: CallbackQuery, state: FSMContext):
    order_id = callback.data.split("receipt:", 1)[-1]
    await state.update_data(receipt_order_id=order_id)
    await state.set_state(PaymentUpload.waiting_photo)
    await callback.message.answer(
        "📸 <b>To'lov chekini yuboring</b>\n\n"
        "Pul o'tkazilganini tasdiqlovchi <b>screenshot yoki rasmni</b> yuboring:"
    )
    await callback.answer()


@dp.message(PaymentUpload.waiting_photo, F.photo)
async def handle_receipt_photo(message: Message, state: FSMContext):
    """
    Chek rasmini qabul qiladi.

    Rasm ikki joyga boradi: Firebase Storage (admin panelda buyurtma
    kartasida ko'rinadi) va adminning Telegram'i (darhol xabardor
    bo'lishi uchun). Tasdiqlash esa faqat panelda bajariladi.
    """
    data = await state.get_data()
    order_id = data.get("receipt_order_id", "")
    order = db.get_order_by_id(order_id) if order_id else None
    display_id = db.order_display_id(order) if order else order_id

    # ── Rasmni Storage'ga yuklaymiz ──
    receipt_url = ""
    try:
        photo = message.photo[-1]
        buffer = await bot.download(photo.file_id)
        receipt_url = db.upload_bytes_to_firebase(
            buffer.read(), f"receipts/{order_id or 'nomalum'}_{photo.file_unique_id}.jpg"
        )
        if receipt_url and order_id:
            db.set_order_receipt(order_id, receipt_url)
    except Exception as e:
        logger.error(f"[RECEIPT] Storage'ga yuklab bo'lmadi: {e}")

    # ── Adminlarga xabar ──
    caption = build_receipt_caption(order, display_id)
    for admin_id in ADMIN_IDS:
        try:
            await bot.send_photo(
                admin_id,
                photo=message.photo[-1].file_id,
                caption=caption,
                reply_markup=admin_panel_kb(),
            )
        except Exception as e:
            logger.warning(f"[RECEIPT] Admin {admin_id} ga yuborib bo'lmadi: {e}")

    logger.info(f"[RECEIPT] {display_id} ← {message.from_user.id} | storage: {bool(receipt_url)}")

    await state.clear()
    await message.answer(
        "✅ <b>Chekingiz yuborildi!</b>\n\n"
        "Admin tekshirib, tez orada xabar beramiz 📬"
    )


@dp.message(PaymentUpload.waiting_photo)
async def handle_receipt_wrong(message: Message):
    await message.answer("❌ Iltimos, to'lov chekini <b>rasm (foto)</b> sifatida yuboring.")


# ─── Aloqa va yordam ─────────────────────────────────────────

@dp.message(F.text == "📞 Biz bilan aloqa")
async def cmd_contact(message: Message):
    await message.answer(
        "📞 <b>UJ VISION bilan bog'lanish:</b>\n\n"
        f"💬 <b>Mijozlar xizmati:</b> {SUPPORT_TELEGRAM}\n"
        f"📞 <b>Telefon raqam:</b> {SUPPORT_PHONE}\n"
        f"✉️ <b>Email:</b> {SUPPORT_EMAIL}\n"
        f"📍 <b>Manzil:</b> {COMPANY_CITY}\n"
        f"⏰ <b>Ish vaqti:</b> {WORK_HOURS}\n\n"
        "<i>Ulgurji xarid, hamkorlik va o'lcham almashtirish bo'yicha ham"
        " shu raqamga murojaat qiling.</i>"
    )


@dp.message(F.text.in_({"ℹ️ Yordam", "/help"}))
async def cmd_help(message: Message):
    await message.answer(
        "ℹ️ <b>Botdan qanday foydalanish mumkin?</b>\n\n"
        "1️⃣ <b>«👗 Katalogni ochish»</b> tugmasini bosib, "
        "UJ VISION kolleksiyasi bilan tanishing.\n"
        "2️⃣ Yoqqan modelning <b>o'lcham va rangini</b> tanlab, <b>Savatga</b> qo'shing.\n"
        "3️⃣ Buyurtmani rasmiylashtirishda <b>Naqd</b> yoki <b>Karta</b> orqali to'lov usulini tanlang.\n"
        "4️⃣ Agar karta orqali to'lov qilsangiz, to'lov chekini botga yuboring.\n"
        "5️⃣ Buyurtmangiz holatini <b>Buyurtmalarim</b> bo'limidan kuzatib boring.\n\n"
        "<i>Qo'shimcha savollar uchun <b>'📞 Biz bilan aloqa'</b> bo'limiga murojaat qiling.</i>"
    )


# ─── WebApp sendData (fallback) ───────────────────────────────

@dp.message(F.web_app_data)
async def handle_webapp_data(message: Message):
    """
    Eski mijozlar uchun zaxira yo'l.

    Odatda buyurtmani mini app `/api/orders` orqali yaratadi va adminga
    xabarni ham o'sha yuboradi. Bu handler faqat mijozga tasdiq beradi.
    """
    try:
        data = json.loads(message.web_app_data.data)
        if data.get("paymentMethod", "Naqd") == "Naqd":
            await message.answer(
                "🎉 <b>Buyurtmangiz qabul qilindi!</b>\n"
                f"🆔 Buyurtma: <b>{data.get('id', '')}</b>\n"
                "💵 To'lov: Naqd (yetkazganda)\n\n"
                "Operatorimiz tez orada bog'lanadi 📞"
            )
    except Exception as e:
        logger.error(f"WebApp data: {e}")
        await message.answer("❌ Xatolik. Qayta urinib ko'ring.")


# ─── Main ─────────────────────────────────────────────────────

async def main():
    # Sozlama hujjatlari hali yo'q bo'lsa, boshlang'ich qiymatlar bilan yaratamiz
    db.ensure_payment_settings()
    db.ensure_delivery_settings()
    db.ensure_main_categories()

    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="👗 Katalog", web_app=WebAppInfo(url=MINI_APP_URL))
        )
    except Exception as e:
        logger.warning(f"Menu button: {e}")

    logger.info("[BOT] Ishga tushdi ✅")

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
