# ═══════════════════════════════════════════════════════════
# UJ VISION Shop — bot sozlamalari
#
# Frontend tomonidagi mos fayllar:
#   src/config/brand.ts     — bot username, aloqa ma'lumotlari
#   src/config/firebase.ts  — Firebase web config
#
# MAXFIY qiymatlar (BOT_TOKEN) bu faylda EMAS — ular `bot/.env`
# faylida turadi, u esa .gitignore'da. Namuna: bot/.env.example
# ═══════════════════════════════════════════════════════════
import os
from pathlib import Path


def _load_env() -> None:
    """
    bot/.env faylini o'qib, os.environ ga yozadi.

    python-dotenv qo'shmaslik uchun qo'lda: bot yagona bog'liqligi
    aiogram bo'lib qolsin. Allaqachon mavjud env o'zgaruvchisi
    ustidan yozilmaydi — server muhitida env kuchliroq bo'ladi.
    """
    path = Path(__file__).with_name(".env")
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()

# ── Telegram ──
# Token .env dan keladi. Bo'sh bo'lsa bot ishga tushmaydi (bot.py tekshiradi).
BOT_TOKEN    = os.environ.get("BOT_TOKEN", "")
# TODO(UJ): @BotFather dan olingan yangi bot username'i.
BOT_USERNAME = "ujvision_bot"
# TODO(UJ): do'kon egasining Telegram ID'si (@userinfobot dan olinadi).
ADMIN_IDS    = {7203124812}   # Egalar — panel orqali o'chirib bo'lmaydi
# TODO(UJ): Vercel'dagi yangi domen.
# BotFather /setdomain da ham aynan shu domen ko'rsatilgan bo'lishi kerak.
MINI_APP_URL = "https://uj-vision.vercel.app"

# ── Kompaniya aloqa ma'lumotlari (bot javoblarida ko'rinadi) ──
# Frontend tomonidagi nusxasi: src/config/brand.ts
COMPANY_NAME     = "UJ VISION"
COMPANY_TAGLINE  = "Kiyimlar do'koni"
# TODO(UJ): haqiqiy aloqa ma'lumotlari.
SUPPORT_PHONE    = "+998 97 400 98 77"
SUPPORT_EMAIL    = "info@ujvision.uz"
SUPPORT_TELEGRAM = "@ujvision"
COMPANY_CITY     = "Toshkent, O'zbekiston"
WORK_HOURS       = "10:00 — 21:00"

# ── Firebase ──
# Service account JSON fayli (loyiha ildizida yoki bot/ papkasida).
# Firebase Console → Project Settings → Service accounts →
# "Generate new private key". Fayl .gitignore'da.
FIREBASE_KEY_FILE       = "uj-vision-kiyimdokon-firebase-adminsdk-fbsvc-9623c3463b.json"
# Storage bucket — mahsulot rasmlari shu yerga yuklanadi.
# Console → Storage → bucket nomi (odatda <project-id>.firebasestorage.app).
# src/config/firebase.ts dagi storageBucket bilan bir xil bo'lishi shart.
FIREBASE_STORAGE_BUCKET = "uj-vision-kiyimdokon.firebasestorage.app"

# ── Server ──
API_HOST     = "0.0.0.0"
API_PORT     = 8080
IMAGES_DIR   = "images"
DB_FILE      = "database.json"

# To'lov sozlamalari — faqat BOSHLANG'ICH qiymat.
# Bot birinchi ishga tushganda bular Firestore'dagi settings/payment
# hujjatiga ko'chiriladi. Undan keyin haqiqiy manba — o'sha hujjat (F-07).
# TODO(UJ): do'konning haqiqiy karta raqami va egasi.
CARD_NUMBER = "5614 6818 1872 7921"
CARD_OWNER  = "Abubakir Abdulbositov"
