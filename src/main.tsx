import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { TelegramGate } from './components/ui/TelegramGate'
import { I18nProvider } from './i18n'
import { applySafeArea, isTelegramEnvironment, waitForTelegram } from './utils/telegram'
import { applyTheme, getStoredTheme } from './utils/theme'

/**
 * Ilova ikki qismdan iborat va ikkalasi bitta bundle'da yashaydi:
 *
 *   /        — mijozlar do'koni, faqat Telegram mini app ichida ochiladi
 *   /admin   — do'kon egasining paneli, oddiy brauzerda login/parol bilan
 *
 * Panel dinamik import bilan yuklanadi: mijozlar uni hech qachon
 * ochmaydi, shuning uchun uning kodi alohida faylga ajraladi va
 * do'konning ochilishini sekinlashtirmaydi.
 */

const root = createRoot(document.getElementById('root')!)

const isAdminRoute = window.location.pathname.startsWith('/admin')

function renderAdmin() {
  applyTheme(getStoredTheme())
  // Dinamik import: panel kodi alohida faylga ajraladi va do'kon
  // ochilganda umuman yuklanmaydi.
  void import('./admin/AdminApp').then(({ default: AdminApp }) => {
    root.render(
      <StrictMode>
        <AdminApp />
      </StrictMode>,
    )
  })
}

function renderShop(insideTelegram: boolean) {
  // Tema birinchi bo'yoqdan oldin qo'llanadi — chaqnash bo'lmaydi
  applyTheme(getStoredTheme())
  applySafeArea()

  root.render(
    <StrictMode>
      {insideTelegram ? (
        <I18nProvider>
          <App />
        </I18nProvider>
      ) : (
        <TelegramGate />
      )}
    </StrictMode>,
  )
}

if (isAdminRoute) {
  // Panel Telegram'dan tashqarida ishlaydi — SDK ni kutish shart emas
  renderAdmin()
} else if (isTelegramEnvironment() || import.meta.env.DEV) {
  renderShop(true)
} else {
  // SDK skripti hali yuklanmagan bo'lishi mumkin — shoshilmaymiz
  waitForTelegram().then(() => renderShop(isTelegramEnvironment()))
}
