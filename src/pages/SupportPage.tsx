import {
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  Phone,
  MapPin,
  ArrowLeft,
  Headphones,
  Clock,
  CheckCircle2,
  Code2,
  BadgeCheck,
  RefreshCw,
  Shirt,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { BRAND, DEVELOPER } from '../config/brand'
import { getContactSettings } from '../lib/firebase'
import { useT } from '../i18n'
import type { ContactSettings } from '../types/domain'

type Props = {
  onBack: () => void
}

const faqs_uz = [
  {
    q: "UJ VISION qanday do'kon?",
    a: "UJ VISION — zamonaviy kiyimlar do'koni: tepa kiyimlar, pastgi kiyimlar va oyoq kiyimlari. Har bir model qo'lda tanlanadi: mato sifati, tikuv va posadka tekshirilgandan keyingina katalogga qo'yiladi.",
  },
  {
    q: "O'lchamni qanday tanlayman?",
    a: "Har bir mahsulot sahifasida mavjud o'lchamlar ko'rsatilgan (S, M, L, XL yoki raqamli). Ikkilansangiz, Telegram orqali yozing — bo'y va vazningizga qarab o'lcham tavsiya qilamiz.",
  },
  {
    q: "O'lcham to'g'ri kelmasa, almashtirsa bo'ladimi?",
    a: "Ha. Mahsulot kiyilmagan, yorliqlari joyida va savdo ko'rinishi saqlangan bo'lsa, 3 kun ichida boshqa o'lchamga almashtiramiz. Almashtirish uchun operatorga yozing.",
  },
  {
    q: "Buyurtma qancha vaqtda yetkaziladi?",
    a: "Toshkent bo'ylab 24 soat ichida. Viloyatlarga pochta xizmati orqali 2–4 kunda. Buyurtma holati o'zgarganda sizga avtomatik bildirishnoma keladi.",
  },
  {
    q: "Kiyimni ko'rib, keyin to'lasam bo'ladimi?",
    a: "Ha. Naqd to'lovni tanlasangiz, kuryer yetkazib bergan joyda mahsulotni ko'rib, o'lchab ko'rishingiz mumkin.",
  },
  {
    q: "To'lov qanday amalga oshiriladi?",
    a: "Naqd pul (yetkazishda) yoki karta orqali o'tkazma. Karta orqali to'lasangiz, chekni botga yuboring — operator tekshirib tasdiqlaydi.",
  },
  {
    q: "Ulgurji xarid yoki hamkorlik mumkinmi?",
    a: "Ha. Do'konlar va qayta sotuvchilar uchun alohida narxlar bor — quyidagi raqam yoki Telegram orqali bog'laning.",
  },
  {
    q: "Promo kod qanday ishlatiladi?",
    a: "Buyurtma berish sahifasida «Promokod» maydoniga kodingizni kiriting va «Qo'llash» tugmasini bosing. Chegirma avtomatik qo'shiladi.",
  },
]

const faqs_ru = [
  {
    q: "Что за магазин UJ VISION?",
    a: "UJ VISION — магазин современной одежды: верхняя одежда, нижняя одежда и обувь. Каждая модель отбирается вручную: качество ткани, пошив и посадка проверяются до попадания в каталог.",
  },
  {
    q: "Как выбрать размер?",
    a: "На странице каждого товара указаны доступные размеры (S, M, L, XL или числовые). Если сомневаетесь — напишите в Telegram, подберём размер по росту и весу.",
  },
  {
    q: "Можно ли обменять, если размер не подошёл?",
    a: "Да. Если вещь не носили, бирки на месте и товарный вид сохранён, обменяем на другой размер в течение 3 дней. Для обмена напишите оператору.",
  },
  {
    q: "Сколько идёт доставка?",
    a: "По Ташкенту — в течение 24 часов. В регионы почтовой службой за 2–4 дня. При изменении статуса заказа вы получите уведомление.",
  },
  {
    q: "Можно посмотреть вещь перед оплатой?",
    a: "Да. При оплате наличными вы можете осмотреть и примерить товар при получении у курьера.",
  },
  {
    q: "Как осуществляется оплата?",
    a: "Наличными при доставке или переводом на карту. При оплате картой отправьте чек боту — оператор проверит и подтвердит.",
  },
  {
    q: "Возможна ли оптовая закупка или сотрудничество?",
    a: "Да. Для магазинов и реселлеров действуют отдельные цены — свяжитесь по телефону или в Telegram ниже.",
  },
  {
    q: "Как использовать промокод?",
    a: "На странице оформления заказа введите код в поле «Промокод» и нажмите «Применить». Скидка добавится автоматически.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition active:opacity-70"
      >
        <span className="font-semibold text-sm leading-snug" style={{ color: 'var(--ink)' }}>
          {q}
        </span>
        <span className="shrink-0" style={{ color: 'var(--brand)' }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      {open && (
        <div
          className="px-5 pb-4 text-sm leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          {a}
        </div>
      )}
    </div>
  )
}

export function SupportPage({ onBack }: Props) {
  const t = useT()
  // detect lang from localStorage
  const lang = (localStorage.getItem('ujvisionLang') ?? 'uz') as 'uz' | 'ru'
  const faqs = lang === 'ru' ? faqs_ru : faqs_uz

  /*
   * Aloqa ma'lumotlari admin panelda o'zgartiriladi (settings/contact).
   * Baza javob bermaguncha yoki maydon bo'sh bo'lsa — brand.ts dagi
   * qiymat ko'rinadi, shu sabab sahifa hech qachon bo'sh qolmaydi.
   */
  const [contact, setContact] = useState<ContactSettings>({
    phone: BRAND.phone,
    email: BRAND.email,
    telegram: BRAND.telegram,
    city: BRAND.city,
    workHours: BRAND.workHours,
  })

  useEffect(() => {
    let cancelled = false
    getContactSettings().then((saved) => {
      if (cancelled) return
      setContact((current) => ({
        phone: saved.phone ?? current.phone,
        email: saved.email ?? current.email,
        telegram: saved.telegram ?? current.telegram,
        city: saved.city ?? current.city,
        workHours: saved.workHours ?? current.workHours,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const telegramHandle = contact.telegram.replace(/^@/, '')

  const contacts = [
    {
      id: 'phone',
      icon: Phone,
      label: lang === 'ru' ? 'Телефон' : 'Telefon',
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^+\d]/g, '')}`,
      color: 'var(--brand)',
      bg: 'var(--brand-soft)',
    },
    {
      id: 'telegram',
      icon: MessageCircle,
      label: 'Telegram',
      value: contact.telegram,
      href: `https://t.me/${telegramHandle}`,
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,0.12)',
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Email',
      value: contact.email,
      href: `mailto:${contact.email}`,
      color: 'var(--gold)',
      bg: 'var(--gold-soft)',
    },
  ]

  const devContacts = [
    { icon: Phone, value: DEVELOPER.phone, href: DEVELOPER.phoneHref },
    { icon: MessageCircle, value: DEVELOPER.telegram, href: DEVELOPER.telegramHref },
    { icon: Mail, value: DEVELOPER.email, href: `mailto:${DEVELOPER.email}` },
  ]

  const about = lang === 'ru'
    ? [
        { icon: BadgeCheck, title: 'Проверенное качество', text: 'Ткань, пошив и посадка проверяются до попадания в каталог.' },
        { icon: RefreshCw, title: 'Обмен размера', text: 'Не подошёл размер — обменяем в течение 3 дней.' },
        { icon: Shirt, title: 'Широкий ассортимент', text: 'Верхняя и нижняя одежда, обувь.' },
      ]
    : [
        { icon: BadgeCheck, title: 'Tekshirilgan sifat', text: "Mato, tikuv va posadka katalogga qo‘yilishdan oldin tekshiriladi." },
        { icon: RefreshCw, title: "O‘lcham almashtirish", text: "O‘lcham to‘g‘ri kelmasa, 3 kun ichida almashtiramiz." },
        { icon: Shirt, title: 'Keng assortiment', text: 'Tepa va pastgi kiyimlar hamda oyoq kiyimlari.' },
      ]

  const features = lang === 'ru'
    ? [
        { icon: Clock, text: `Приём заказов ${contact.workHours}` },
        { icon: CheckCircle2, text: 'Быстрый ответ' },
        { icon: MapPin, text: contact.city },
      ]
    : [
        { icon: Clock, text: `Buyurtmalar ${contact.workHours}` },
        { icon: CheckCircle2, text: 'Tez javob' },
        { icon: MapPin, text: contact.city },
      ]

  return (
    <>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 pt-8 pb-5 sm:px-10"
        style={{ animation: 'fadeInUp 0.3s ease' }}
      >
        <button
          onClick={onBack}
          className="grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-90"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight" style={{ color: 'var(--ink)' }}>
            {lang === 'ru' ? 'Помощь и поддержка' : "Yordam va qo'llab-quvvatlash"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {lang === 'ru' ? 'Мы всегда рядом' : "Biz doim siz bilan"}
          </p>
        </div>
      </header>

      {/* Hero Card */}
      <section className="px-5 sm:px-10" style={{ animation: 'fadeInUp 0.35s ease 0.05s both' }}>
        <div
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, #243155 0%, #10172c 100%)',
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -right-8 -top-8 size-32 rounded-full opacity-20"
            style={{ background: 'white' }}
          />
          <div
            className="absolute -bottom-6 right-10 size-20 rounded-full opacity-10"
            style={{ background: 'white' }}
          />

          <div className="relative z-10">
            <div
              className="inline-grid size-14 place-items-center rounded-2xl mb-4"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Headphones size={28} color="white" />
            </div>
            <h2 className="wordmark text-xl text-white leading-tight">
              {lang === 'ru' ? `Служба заботы ${BRAND.name}` : `${BRAND.name} mijozlar xizmati`}
            </h2>
            <p className="mt-1.5 text-sm text-white opacity-80">
              {lang === 'ru'
                ? 'Свяжитесь с нами любым удобным способом'
                : "Qulay usul orqali biz bilan bog'laning"}
            </p>

            {/* Feature badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {features.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}
                >
                  <Icon size={12} />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Cards */}
      <section
        className="px-5 pt-6 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Контакты' : "Bog'lanish"}
        </h2>
        <div className="flex flex-col gap-3">
          {contacts.map(({ id, icon: Icon, label, value, href, color, bg }) => (
            <a
              key={id}
              id={`support-contact-${id}`}
              href={href}
              target={id !== 'phone' ? '_blank' : undefined}
              rel="noreferrer"
              className="flex items-center gap-4 rounded-2xl border p-4 transition active:scale-[0.98] hover:opacity-90"
              style={{ borderColor: 'var(--line)', background: 'var(--surface)', textDecoration: 'none' }}
            >
              <span
                className="grid size-12 shrink-0 place-items-center rounded-2xl"
                style={{ background: bg, color }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  {label}
                </p>
                <p className="mt-0.5 truncate font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  {value}
                </p>
              </div>
              <span
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                style={{ background: bg, color }}
              >
                {lang === 'ru' ? 'Написать' : 'Yozish'}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Brend haqida */}
      <section
        className="px-5 pt-7 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.12s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? `О ${BRAND.name}` : `${BRAND.name} haqida`}
        </h2>
        <div
          className="rounded-2xl border p-2"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          {about.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3 p-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
              >
                <Icon size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dasturchi — texnik savollar shu yerga */}
      <section
        className="px-5 pt-7 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.14s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Разработчик' : 'Dasturchi'}
        </h2>
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl"
              style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}
            >
              <Code2 size={22} />
            </span>
            <div className="min-w-0">
              <p className="font-bold" style={{ color: 'var(--ink)' }}>{DEVELOPER.name}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {lang === 'ru'
                  ? 'Разработка приложения и технические вопросы'
                  : "Ilova dasturchisi — texnik savollar bo'yicha"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {devContacts.map(({ icon: Icon, value, href }) => (
              <a
                key={value}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition active:scale-[0.98]"
                style={{ background: 'var(--surface-2)', textDecoration: 'none' }}
              >
                <Icon size={17} style={{ color: 'var(--gold)' }} />
                <span className="truncate text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
                  {value}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="px-5 pt-7 pb-32 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.15s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Часто задаваемые вопросы' : "Ko'p so'raladigan savollar"}
        </h2>
        <div className="flex flex-col gap-3">
          {faqs.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>

        {/* Footer note */}
        <div
          className="mt-6 rounded-2xl border p-4 text-center"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {lang === 'ru'
              ? 'Не нашли ответ? Напишите нам — мы ответим в течение нескольких минут.'
              : "Javob topa olmadingizmi? Bizga yozing — bir necha daqiqa ichida javob beramiz."}
          </p>
        </div>
      </section>
    </>
  )
}
