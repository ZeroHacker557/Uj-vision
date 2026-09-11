/**
 * Firebase mijoz (web) konfiguratsiyasi.
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
 * o'qiydi va katalog bo'sh ko'rinadi. Hozir ikkalasi ham
 * `uj-vision-kiyimdokon`.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBhqa77i_53kUoBeY9_v7tUoXqL6SaZq0M',
  authDomain: 'uj-vision-kiyimdokon.firebaseapp.com',
  projectId: 'uj-vision-kiyimdokon',
  storageBucket: 'uj-vision-kiyimdokon.firebasestorage.app',
  messagingSenderId: '874718278871',
  appId: '1:874718278871:web:31cfb3bf1870355339ac92',
  measurementId: 'G-3QW73R1KC7',
}
