import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import { UiContext } from './ui-context'
import type { ConfirmRequest } from './ui-context'

/**
 * Admin panelning umumiy qismlari.
 *
 * Mini app komponentlari mijoz uchun mo'ljallangan (katta tugmalar,
 * Telegram temasi), panel esa stol kompyuterida ham ishlatiladi —
 * shuning uchun alohida, zichroq to'plam. Ranglar baribir bitta
 * manbadan: styles.css dagi CSS tokenlari.
 */

// ─── Tugma ────────────────────────────────────────────────────

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  full?: boolean
  title?: string
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  full = false,
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`a-btn a-btn--${variant} a-btn--${size}${full ? ' a-btn--full' : ''}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  )
}

// ─── Maydonlar ────────────────────────────────────────────────

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="a-field">
      <span className="a-field__label">{label}</span>
      {children}
      {hint && <span className="a-field__hint">{hint}</span>}
    </label>
  )
}

type InputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number' | 'password' | 'date'
  autoFocus?: boolean
  disabled?: boolean
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoFocus,
  disabled,
}: InputProps) {
  return (
    <input
      className="a-input"
      value={value}
      type={type}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      className="a-input a-input--area"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select className="a-input" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

// ─── Kartalar va holatlar ─────────────────────────────────────

export function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  padded?: boolean
}) {
  return (
    <section className="a-card">
      {(title || action) && (
        <header className="a-card__head">
          {title && <h2 className="a-card__title">{title}</h2>}
          {action}
        </header>
      )}
      <div className={padded ? 'a-card__body' : undefined}>{children}</div>
    </section>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="a-spinner">
      <Loader2 size={20} className="animate-spin" />
      {label && <span>{label}</span>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="a-empty">
      {icon && <span className="a-empty__icon">{icon}</span>}
      <p className="a-empty__title">{title}</p>
      {text && <p className="a-empty__text">{text}</p>}
      {action}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
}) {
  return <span className={`a-badge a-badge--${tone}`}>{children}</span>
}

// ─── Modal ────────────────────────────────────────────────────

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  // Modal ochiqligida orqa fon aylanmasin — telefonda ayniqsa bezovta qiladi
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="a-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button className="a-modal__backdrop" onClick={onClose} aria-label="Yopish" />
      <div className={'a-modal__panel' + (wide ? ' a-modal__panel--wide' : '')}>
        <header className="a-modal__head">
          <h2>{title}</h2>
          <button onClick={onClose} className="a-icon-btn" aria-label="Yopish">
            <X size={18} />
          </button>
        </header>
        <div className="a-modal__body">{children}</div>
        {footer && <footer className="a-modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}

// ─── Xabarnomalar (toast) va tasdiqlash oynasi ────────────────

type Toast = { id: number; message: string; tone: 'ok' | 'error' }

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [busy, setBusy] = useState(false)

  const notify = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500)
  }, [])

  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), [])

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm])

  const runConfirm = async () => {
    if (!request) return
    setBusy(true)
    try {
      await request.onConfirm()
      setRequest(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <UiContext.Provider value={value}>
      {children}

      <div className="a-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`a-toast a-toast--${toast.tone}`}>
            {toast.tone === 'ok' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(request)}
        title={request?.title || ''}
        onClose={() => (busy ? undefined : setRequest(null))}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRequest(null)} disabled={busy}>
              Bekor qilish
            </Button>
            <Button variant={request?.danger ? 'danger' : 'primary'} onClick={runConfirm} loading={busy}>
              {request?.confirmLabel || 'Tasdiqlash'}
            </Button>
          </>
        }
      >
        <p className="a-modal__text">{request?.text}</p>
      </Modal>
    </UiContext.Provider>
  )
}
