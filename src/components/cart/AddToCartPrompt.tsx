import { Check, X } from 'lucide-react'
import { getImageUrl } from '../../utils/telegram'
import { useT } from '../../i18n'
import type { CartPrompt } from '../../hooks/use-shop-store'

type Props = {
  prompt: CartPrompt
  onConfirm: () => void
  onReject: () => void
  onClose: () => void
}

/**
 * Savatga qo'shilgandan keyingi tasdiq paneli.
 *
 * Ilgari bu yerda oddiy "savatga qo'shildi" xabari chiqardi va mijoz
 * savatni ochish uchun yuqoridagi kichkina ikonkani qidirishi kerak
 * edi. Endi panel darhol ikki yo'lni taklif qiladi: buyurtmani
 * rasmiylashtirish yoki qo'shishni bekor qilish.
 *
 * Panel pastki menyu ustida turadi va o'n soniyada o'zi yopiladi —
 * o'shanda mahsulot savatda qolaveradi.
 */
export function AddToCartPrompt({ prompt, onConfirm, onReject, onClose }: Props) {
  const t = useT()

  const variant = [
    prompt.size && `${t('cart.size')}: ${prompt.size}`,
    prompt.color && `${t('cart.color')}: ${prompt.color}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="cart-prompt" role="dialog" aria-live="polite">
      <button className="cart-prompt__close" onClick={onClose} aria-label={t('common.close')}>
        <X size={16} />
      </button>

      <div className="cart-prompt__row">
        {prompt.image ? (
          <img className="cart-prompt__image" src={getImageUrl(prompt.image)} alt="" />
        ) : (
          <span className="cart-prompt__image" />
        )}

        <div className="min-w-0 flex-1">
          <p className="cart-prompt__name">{prompt.name}</p>
          {variant && <p className="cart-prompt__variant">{variant}</p>}
          <p className="cart-prompt__question">{t('cart.promptTitle')}</p>
        </div>
      </div>

      <div className="cart-prompt__actions">
        <button className="cart-prompt__btn cart-prompt__btn--no" onClick={onReject}>
          <X size={17} />
          {t('common.no')}
        </button>
        <button className="cart-prompt__btn cart-prompt__btn--yes" onClick={onConfirm}>
          <Check size={17} />
          {t('common.yes')}
        </button>
      </div>
    </div>
  )
}
