import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'

type Props = {
  /** To'liq URL'lar ro'yxati. */
  images: string[]
  index: number
  alt: string
  onIndexChange: (index: number) => void
  onClose: () => void
}

const MAX_SCALE = 4
/** Ikki marta bosish shu oraliqda sodir bo'lsa — kattalashtirish. */
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SCALE = 2.5
/** Keyingi rasmga o'tish uchun barmoq shuncha piksel surilishi kerak. */
const SWIPE_MIN_PX = 55

type Point = { x: number; y: number }

/**
 * Mahsulot rasmini butun ekranda ochadi.
 *
 * Boshqaruv: yonma-yon surish (rasmlar orasida yurish), ikki barmoq
 * bilan cho'zish, ikki marta bosish (1x ↔ 2.5x), kattalashtirilgan
 * holda surish, Escape yoki fon bosilganda yopish.
 *
 * Rasm bu yerda `contain` bilan chiziladi — katalogdagi kartada u
 * `cover` bilan qirqilgan, shuning uchun mijoz mahsulotni to'liq
 * ko'rishi uchun yagona joy shu.
 */
export function ImageLightbox({ images, index, alt, onIndexChange, onClose }: Props) {
  const t = useT()
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  /* Barmoq tekkanda animatsiya o'chadi — aks holda harakat kechikib
     ergashadi. Ref emas, holat: render paytida o'qilishi kerak. */
  const [interacting, setInteracting] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  // Faol barmoqlar — cho'zish ikkitasi bo'lganda boshlanadi
  const pointers = useRef(new Map<number, Point>())
  const pinch = useRef<{ dist: number; scale: number; offset: Point } | null>(null)
  const pan = useRef<{ start: Point; offset: Point } | null>(null)
  /**
   * Kattalashtirilmagan holatdagi bitta barmoq — rasmlar orasida yurish
   * uchun. Kattalashtirilganda esa o'sha harakat rasmni surishga ketadi
   * (pan), shuning uchun ikkalasi alohida saqlanadi.
   */
  const swipe = useRef<Point | null>(null)
  const lastTap = useRef(0)
  const moved = useRef(false)

  const multiple = images.length > 1

  /** Surishni chegaralaymiz — rasm ekrandan butunlay chiqib ketmasin. */
  const clamp = useCallback((next: Point, atScale: number): Point => {
    const box = stageRef.current?.getBoundingClientRect()
    if (!box) return next
    const maxX = (box.width * (atScale - 1)) / 2
    const maxY = (box.height * (atScale - 1)) / 2
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }, [])

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setInteracting(false)
  }, [])

  /** Rasm almashganda kattalashtirish bekor qilinadi. */
  const go = useCallback(
    (step: number) => {
      reset()
      onIndexChange((index + step + images.length) % images.length)
    },
    [index, images.length, onIndexChange, reset],
  )

  // Escape — yopish, o'q tugmalari — rasmlar orasida yurish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && multiple) go(-1)
      else if (e.key === 'ArrowRight' && multiple) go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, go, multiple])

  // Ochiq turganda orqa fon aylanmasin
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

  const onPointerDown = (e: React.PointerEvent) => {
    // Ba'zi WebView'larda setPointerCapture xato tashlaydi. U faqat
    // qulaylik uchun — xato butun ishlov beruvchini to'xtatmasligi kerak,
    // aks holda barmoq ro'yxatga tushmay, cho'zish umuman ishlamaydi.
    try {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      /* e'tiborsiz */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false

    const points = [...pointers.current.values()]
    if (points.length === 2) {
      pan.current = null
      pinch.current = { dist: distance(points[0], points[1]), scale, offset }
      setInteracting(true)
    } else if (points.length === 1 && scale > 1) {
      pan.current = { start: { x: e.clientX, y: e.clientY }, offset }
      setInteracting(true)
    } else if (points.length === 1) {
      swipe.current = { x: e.clientX, y: e.clientY }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const points = [...pointers.current.values()]

    if (points.length === 2 && pinch.current) {
      moved.current = true
      const ratio = distance(points[0], points[1]) / pinch.current.dist
      const next = Math.min(MAX_SCALE, Math.max(1, pinch.current.scale * ratio))
      setScale(next)
      setOffset(next === 1 ? { x: 0, y: 0 } : clamp(pinch.current.offset, next))
      return
    }

    if (points.length === 1 && pan.current) {
      const dx = e.clientX - pan.current.start.x
      const dy = e.clientY - pan.current.start.y
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true
      setOffset(clamp({ x: pan.current.offset.x + dx, y: pan.current.offset.y + dy }, scale))
      return
    }

    // Surish boshlandi — bu endi "bosish" emas, aks holda barmoq
    // ko'tarilganda ikki marta bosish hisoblanib qolardi.
    if (points.length === 1 && swipe.current) {
      if (
        Math.abs(e.clientX - swipe.current.x) > 8 ||
        Math.abs(e.clientY - swipe.current.y) > 8
      ) {
        moved.current = true
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) {
      pan.current = null
      setInteracting(false)
    }

    // Yonma-yon surish — faqat kattalashtirilmagan holatda va agar
    // harakat tikkasiga emas, ko'ndalangiga bo'lgan bo'lsa.
    if (swipe.current && multiple && scale === 1 && pointers.current.size === 0) {
      const dx = e.clientX - swipe.current.x
      const dy = e.clientY - swipe.current.y
      swipe.current = null
      if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        go(dx < 0 ? 1 : -1)
        return
      }
    }
    swipe.current = null

    // Surilmagan qisqa bosish: ikkinchisi tez kelsa — kattalashtiramiz
    if (!moved.current) {
      const now = Date.now()
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0
        if (scale > 1) reset()
        else setScale(DOUBLE_TAP_SCALE)
      } else {
        lastTap.current = now
      }
    }
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(e) => {
        // Fonga bosilganda yopiladi; rasmning o'ziga bosilganda emas
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button className="lightbox__close" onClick={onClose} aria-label={t('common.close')}>
        <X size={22} />
      </button>

      {multiple && (
        <>
          <button
            className="lightbox__nav lightbox__nav--prev"
            onClick={() => go(-1)}
            aria-label={t('common.back')}
          >
            <ChevronLeft size={26} />
          </button>
          <button
            className="lightbox__nav lightbox__nav--next"
            onClick={() => go(1)}
            aria-label={t('common.next')}
          >
            <ChevronRight size={26} />
          </button>
          <span className="lightbox__counter">
            {index + 1} / {images.length}
          </span>
        </>
      )}

      <div
        ref={stageRef}
        className="lightbox__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          className="lightbox__img"
          src={images[index]}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: interacting ? 'none' : 'transform 0.22s ease',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
        />
      </div>
    </div>
  )
}
