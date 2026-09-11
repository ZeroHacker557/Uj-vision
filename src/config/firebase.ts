/**
 * Firebase mijoz (web) konfiguratsiyasi.
 *
 * ⚠️ TODO(UJ): `apiKey`, `messagingSenderId`, `appId` va `measurementId`
 * hali ESKI loyihaniki. Firebase Console → uj-vision-kiyimdokon →
 * ⚙️ Project Settings → General → Your apps → Web app → Config dan
 * olib, quyidagi qiymatlarni almashtiring. `projectId`, `authDomain`
 * va `storageBucket` allaqachon yangi loyihaga qaratilgan.
 *
 * Bu qiymatlar MAXFIY EMAS — Firebase ularni brauzerga ataylab ochiq
 * beradi, himoya Firestore Rules va App Check tomonida. Shuning uchun
 * env o'zgaruvchi emas, oddiy konstanta: Vercel'da 7 ta o'zgaruvchini
 * to'ldirish o'rniga shu faylni almashtirish kifoya.
 *
 * Firebase Console → ⚙️ Project Settings → General → "Your apps" →
 * Web app → SDK setup and configuration → Config.
 *
 * DIQQAT: bu yerdagi projectId bot ishlatadigan service account
 * (bot/config.py → FIREBASE_KEY_FILE) bilan BIR XIL loyihaga tegishli
 * bo'lishi shart. Aks holda bot bir bazaga yozadi, ilova boshqasidan
 * o'qiydi va katalog bo'sh ko'rinadi.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDGsAmf8pfHbFxyX2z5za_t3oWbTcbBQSk',
  authDomain: 'uj-vision-kiyimdokon.firebaseapp.com',
  projectId: 'uj-vision-kiyimdokon',
  storageBucket: 'uj-vision-kiyimdokon.firebasestorage.app',
  messagingSenderId: '265389492045',
  appId: '1:265389492045:web:46283533b7404304e01904',
  measurementId: 'G-XW664F7E30',
}
