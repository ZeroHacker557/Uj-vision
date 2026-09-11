"""
Bot uchun Firestore va Storage qatlami.

Bu yerda faqat BOT ishlatadigan amallar bor: buyurtmani o'qish, chek
rasmini saqlash, foydalanuvchi telefoni, sozlamalarni boshlang'ich
qiymat bilan yaratish.

Mahsulot/kategoriya/promokod qo'shish, buyurtma holatini o'zgartirish,
statistika — bularning hammasi web admin panelida va ular server
tomonda `api/_lib/admin-actions.ts` da yoziladi. Ilgari xuddi shu
amallar bu yerda ham takrorlangan edi; bitta ma'lumot ikki joydan
yozilsa, ertami-kechmi ular bir-biriga mos kelmay qoladi.
"""
import os
import uuid
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore, storage

from config import (
    CARD_NUMBER, CARD_OWNER,
    FIREBASE_KEY_FILE, FIREBASE_STORAGE_BUCKET,
)

KEY_FILENAME = FIREBASE_KEY_FILE

# Service account fayli loyiha ildizida yoki bot/ papkasida bo'lishi mumkin
key_path = KEY_FILENAME
if not os.path.exists(key_path):
    key_path = os.path.join(os.path.dirname(__file__), "..", KEY_FILENAME)

if not firebase_admin._apps:
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        'storageBucket': FIREBASE_STORAGE_BUCKET
    })

db = firestore.client()
bucket = storage.bucket()


def format_price(amount: int | float) -> str:
    try:
        val = int(amount)
        return f"{val:,}".replace(",", " ") + " so'm"
    except (ValueError, TypeError):
        return f"{amount} so'm"


# ─── Storage ──────────────────────────────────────────────────

def upload_bytes_to_firebase(data: bytes, blob_name: str) -> str:
    """
    Baytlarni Storage'ga yuklaydi va ochiq havola qaytaradi.

    Havola download-token bilan yasaladi: shunda Storage qoidalari
    yopiq bo'lsa ham rasm ko'rinadi, lekin havolani bilmagan odam
    faylni topa olmaydi. Admin panel ham xuddi shu formatni ishlatadi.
    """
    try:
        token = uuid.uuid4().hex
        blob = bucket.blob(blob_name)
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        blob.upload_from_string(data, content_type="image/jpeg")

        encoded = blob_name.replace("/", "%2F")
        url = (f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
               f"/o/{encoded}?alt=media&token={token}")
        print(f"[OK] Storage'ga yuklandi: {blob_name}")
        return url
    except Exception as e:
        print(f"[ERR] Storage: {e}")
        return ""


# ─── Products / Categories (faqat o'qish) ─────────────────────

def get_products():
    docs = db.collection("products").get()
    products = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        products.append(d)
    return products


def get_product_by_id(prod_id: str | int):
    doc = db.collection("products").document(str(prod_id)).get()
    if doc.exists:
        d = doc.to_dict()
        d["id"] = doc.id
        return d
    return None


def get_categories():
    docs = db.collection("categories").get()
    categories = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        categories.append(d)
    return categories


# ─── Orders ───────────────────────────────────────────────────
#
# Buyurtmaning yagona kaliti — Firestore hujjat id'si. Ilgari "id" maydonidagi
# "#1234567" ishlatilgan edi, u har ~2.8 soatda takrorlanib, noto'g'ri
# buyurtma yangilanishiga olib kelardi. Eski yozuvlar buzilmasligi uchun
# quyidagi funksiyalar avval hujjat id'sini, topilmasa "id" maydonini qidiradi.


def _order_ref(order_id: str):
    """Hujjat havolasini qaytaradi: avval doc.id, keyin eski 'id' maydoni."""
    ref = db.collection("orders").document(str(order_id))
    if ref.get().exists:
        return ref

    docs = db.collection("orders").where("id", "==", str(order_id)).limit(1).get()
    for doc in docs:
        return doc.reference
    return None


def get_order_by_id(order_id: str):
    """Buyurtmani hujjat id'si (yoki eski 'id' maydoni) bo'yicha olish"""
    try:
        ref = _order_ref(order_id)
        if ref is None:
            return None
        snap = ref.get()
        if not snap.exists:
            return None
        d = snap.to_dict()
        d["_doc_id"] = snap.id
        return d
    except Exception as e:
        print(f"[ERR] get_order_by_id: {e}")
        return None


def set_order_receipt(order_id: str, url: str) -> bool:
    """
    Chek rasmining havolasini buyurtmaga yozadi.

    Admin panel buyurtma kartasida shu havolani ko'rsatadi — shu tariqa
    chek Telegram tarixida qolib ketmaydi.
    """
    try:
        ref = _order_ref(order_id)
        if ref is None:
            print(f"[ERR] set_order_receipt: {order_id} topilmadi")
            return False
        ref.update({
            "receiptUrl": url,
            "receiptAt": datetime.now().astimezone().isoformat(),
            "paymentStatus": "Kutilmoqda",
        })
        return True
    except Exception as e:
        print(f"[ERR] set_order_receipt: {e}")
        return False


def delete_order(doc_id: str) -> bool:
    """Buyurtmani butunlay o'chiradi (clear_orders.py skripti uchun)."""
    try:
        ref = db.collection("orders").document(str(doc_id))
        if not ref.get().exists:
            return False
        ref.delete()
        print(f"[DEL] Buyurtma o'chirildi: {doc_id}")
        return True
    except Exception as e:
        print(f"[ERR] delete_order: {e}")
        return False


def order_display_id(order: dict) -> str:
    """Foydalanuvchiga ko'rsatiladigan raqam (eski yozuvlarda 'id' maydoni)."""
    return order.get("orderNumber") or order.get("id") or "—"


_MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyun",
              "iyul", "avg", "sen", "okt", "noy", "dek"]


def order_date_text(order: dict) -> str:
    """
    Buyurtma sanasi. Yangi yozuvlarda createdAt (ISO, UTC) bor —
    uni o'qiladigan ko'rinishga aylantiramiz. Eski yozuvlarda
    formatlangan 'date' matni saqlanib qolgan (F-10).
    """
    created = order.get("createdAt")
    if created:
        try:
            dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            dt = dt.astimezone()
            return f"{dt.day} {_MONTHS_UZ[dt.month - 1]}, {dt.year} • {dt:%H:%M}"
        except (ValueError, TypeError):
            pass
    return order.get("date") or "—"


def get_user_orders(user_id: int):
    """Foydalanuvchining barcha buyurtmalarini olish"""
    try:
        docs = db.collection("orders").where("userId", "==", user_id).get()
        orders = []
        for doc in docs:
            d = doc.to_dict()
            d["_doc_id"] = doc.id
            orders.append(d)
        orders.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return orders
    except Exception as e:
        print(f"[ERR] get_user_orders: {e}")
        return []


# ─── Users ────────────────────────────────────────────────────

def get_user(user_id: int) -> dict | None:
    try:
        snap = db.collection("users").document(str(user_id)).get()
        return snap.to_dict() if snap.exists else None
    except Exception as e:
        print(f"[ERR] get_user: {e}")
        return None


def set_user_phone(user_id: int, phone: str):
    """Telefon raqamini saqlaydi — mini app uni avtomatik to'ldiradi (F-26)."""
    try:
        db.collection("users").document(str(user_id)).set(
            {"id": user_id, "phone": phone}, merge=True
        )
        print(f"[OK] Telefon saqlandi: {user_id}")
        return True
    except Exception as e:
        print(f"[ERR] set_user_phone: {e}")
        return False


# ─── Sozlamalar ───────────────────────────────────────────────
#
# Karta va yetkazib berish ma'lumoti settings/ hujjatlarida. Bot ham,
# mini app ham, admin panel ham shu yerdan o'qiydi (F-07). config.py
# faqat birinchi marta to'ldirish uchun boshlang'ich qiymat beradi;
# keyin ularni admin panelning "Sozlamalar" bo'limidan o'zgartiriladi.

def get_payment_settings() -> dict:
    try:
        snap = db.collection("settings").document("payment").get()
        if snap.exists:
            data = snap.to_dict() or {}
            return {
                "cardNumber": data.get("cardNumber") or CARD_NUMBER,
                "cardOwner": data.get("cardOwner") or CARD_OWNER,
            }
    except Exception as e:
        print(f"[ERR] get_payment_settings: {e}")
    return {"cardNumber": CARD_NUMBER, "cardOwner": CARD_OWNER}


def ensure_payment_settings():
    """Hujjat yo'q bo'lsa config.py qiymatlari bilan yaratadi."""
    try:
        ref = db.collection("settings").document("payment")
        if not ref.get().exists:
            ref.set({"cardNumber": CARD_NUMBER, "cardOwner": CARD_OWNER})
            print("[OK] settings/payment yaratildi")
    except Exception as e:
        print(f"[ERR] ensure_payment_settings: {e}")


def get_delivery_settings() -> dict:
    try:
        snap = db.collection("settings").document("delivery").get()
        if snap.exists:
            data = snap.to_dict() or {}
            return {
                "fee": max(int(data.get("fee") or 0), 0),
                "freeFrom": max(int(data.get("freeFrom") or 0), 0),
            }
    except Exception as e:
        print(f"[ERR] get_delivery_settings: {e}")
    return {"fee": 0, "freeFrom": 0}


def ensure_delivery_settings():
    try:
        ref = db.collection("settings").document("delivery")
        if not ref.get().exists:
            ref.set({"fee": 0, "freeFrom": 0})
            print("[OK] settings/delivery yaratildi")
    except Exception as e:
        print(f"[ERR] ensure_delivery_settings: {e}")


# UJ VISION ning uchta asosiy yo'nalishi — mini app'da bosh sahifadagi yirik
# kartalar va katalog menyusi shu nomlarga tayanadi
# (src/config/categories.ts). Bot birinchi ishga tushganda bazada yo'q
# bo'lsa yaratamiz, aks holda admin mahsulotni ularga biriktira olmaydi.
MAIN_CATEGORIES = [
    ("Tepa kiyimlar", "tepa"),
    ("Pastgi kiyimlar", "pastgi"),
    ("Oyoq kiyimlar", "oyoq"),
]


def ensure_main_categories():
    """Yetishmayotgan asosiy yo'nalishlarni qo'shadi. Borlariga tegmaydi."""
    try:
        existing = {c.get("name", "").strip().lower() for c in get_categories()}
        for name, icon in MAIN_CATEGORIES:
            if name.lower() in existing:
                continue
            cat_id = str(int(uuid.uuid4().int % 100000))
            db.collection("categories").document(cat_id).set(
                {"id": cat_id, "name": name, "icon": icon}
            )
            print(f"[OK] Asosiy kategoriya yaratildi: {name}")
    except Exception as e:
        print(f"[ERR] ensure_main_categories: {e}")
