import mark from '../../images/uj-mark.webp'
import { BRAND } from '../../config/brand'

type Props = {
  /** Belgi o'lchami (px). Yozuv shunga nisbatan masshtablanadi. */
  size?: number
  /** Yozuvsiz — faqat belgi (kichik joylar uchun). */
  markOnly?: boolean
  className?: string
}

/**
 * UJ VISION logotipi.
 *
 * Belgi — logotipning qisqartmasi: to'q ko'k maydon ustidagi oq serif
 * "UJ" va ostidagi ingichka chiziq. Rasm allaqachon to'q ko'k bo'lgani
 * uchun ostiga qo'shimcha fon qo'yilmaydi, faqat burchaklari
 * yumaloqlanadi — shu tariqa yorug' va qorong'i temada bir xil
 * ko'rinadi va favicon bilan aynan mos tushadi.
 *
 * Yozuv esa logotipdagidek: serif, katta harf, keng interval (.logotype).
 */
export function BrandLogo({ size = 44, markOnly = false, className = '' }: Props) {
  return (
    <span className={'flex items-center gap-2.5 ' + className}>
      <img
        src={mark}
        alt={BRAND.name}
        width={size}
        height={size}
        className="shrink-0 object-cover"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          boxShadow: 'var(--shadow-brand)',
        }}
        decoding="async"
      />

      {!markOnly && (
        <span className="min-w-0 leading-none">
          <b
            className="logotype block"
            style={{ fontSize: size * 0.42, color: 'var(--ink)' }}
          >
            {BRAND.name}
          </b>
          <small
            className="mt-1.5 block truncate font-semibold uppercase"
            style={{
              fontSize: Math.max(7, size * 0.16),
              letterSpacing: '0.16em',
              color: 'var(--muted)',
            }}
          >
            {BRAND.tagline}
          </small>
        </span>
      )}
    </span>
  )
}
