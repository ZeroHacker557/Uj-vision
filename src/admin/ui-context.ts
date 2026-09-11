import { createContext, useContext } from 'react'

/**
 * Panelning umumiy konteksti — xabarnoma va tasdiqlash oynasi.
 *
 * Kontekst va hook komponentlardan alohida faylda: Vite'ning tez
 * yangilanishi (Fast Refresh) bir faylda ham komponent, ham oddiy
 * funksiya eksport qilinsa ishlamay qoladi.
 */

export type ConfirmRequest = {
  title: string
  text?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

export type UiContextValue = {
  notify: (message: string, tone?: 'ok' | 'error') => void
  confirm: (request: ConfirmRequest) => void
}

export const UiContext = createContext<UiContextValue | null>(null)

export function useUi(): UiContextValue {
  const context = useContext(UiContext)
  if (!context) throw new Error('useUi faqat UiProvider ichida ishlaydi')
  return context
}
