import { useCallback, useEffect, useState } from 'react'
import { CreditCard, KeyRound, Phone, Plus, Tag, Trash2, Truck } from 'lucide-react'
import { adminPost } from '../api'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner } from '../ui'
import { useUi } from '../ui-context'

/**
 * Sozlamalar bo'limi.
 *
 * Bu yerdagi qiymatlar Firestore'dagi `settings` hujjatlarida turadi va
 * mini app ularni ish vaqtida o'qiydi — ya'ni karta raqamini yoki
 * yetkazish narxini o'zgartirish uchun qayta deploy qilish shart emas.
 */

type Settings = {
  payment: { cardNumber: string; cardOwner: string }
  delivery: { fee: number; freeFrom: number }
  contact: { phone: string; email: string; telegram: string; city: string; workHours: string }
}

type Promo = {
  id: string
  code?: string
  discountPercent?: number
  active?: boolean
  usageCount?: number
  maxUses?: number
  minOrderTotal?: number
  expiresAt?: string | null
}

export function SettingsPage() {
  const { notify } = useUi()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const load = useCallback(
    () =>
      Promise.all([
        adminPost<Settings>('settings.get'),
        adminPost<{ promocodes: Promo[] }>('promo.list'),
      ])
        .then(([settingsResult, promoResult]) => {
          setSettings(settingsResult)
          setPromos(promoResult.promocodes)
        })
        .catch((caught) =>
          notify(caught instanceof Error ? caught.message : 'Yuklanmadi', 'error'),
        )
        .finally(() => setLoading(false)),
    [notify],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (loading || !settings) return <Spinner label="Yuklanmoqda..." />

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PaymentCard
        value={settings.payment}
        onSaved={(next) => setSettings({ ...settings, payment: next })}
      />
      <DeliveryCard
        value={settings.delivery}
        onSaved={(next) => setSettings({ ...settings, delivery: next })}
      />
      <ContactCard
        value={settings.contact}
        onSaved={(next) => setSettings({ ...settings, contact: next })}
      />

      <Card
        title="Promokodlar"
        action={
          <Button size="sm" onClick={() => setEditingPromo({ id: '', code: '', discountPercent: 10, active: true })}>
            <Plus size={15} />
            Yangi
          </Button>
        }
        padded={false}
      >
        {promos.length === 0 ? (
          <EmptyState icon={<Tag size={20} />} title="Promokod yo'q" text="Chegirma kodi qo'shing." />
        ) : (
          promos.map((promo) => (
            <PromoRow
              key={promo.id}
              promo={promo}
              onEdit={() => setEditingPromo(promo)}
              onDeleted={load}
            />
          ))
        )}
      </Card>

      <Card title="Xavfsizlik">
        <div className="flex flex-wrap items-center gap-3">
          <KeyRound size={18} style={{ color: 'var(--brand)' }} />
          <p className="flex-1 text-sm" style={{ color: 'var(--muted)' }}>
            Panelga kirish logini va parolini o'zgartirish
          </p>
          <Button variant="ghost" onClick={() => setPasswordOpen(true)}>
            O'zgartirish
          </Button>
        </div>
      </Card>

      {editingPromo && (
        <PromoModal
          promo={editingPromo}
          onClose={() => setEditingPromo(null)}
          onSaved={async () => {
            setEditingPromo(null)
            await load()
          }}
        />
      )}

      {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  )
}

// ─── To'lov kartasi ───────────────────────────────────────────

function PaymentCard({
  value,
  onSaved,
}: {
  value: Settings['payment']
  onSaved: (next: Settings['payment']) => void
}) {
  const { notify } = useUi()
  const [cardNumber, setCardNumber] = useState(value.cardNumber)
  const [cardOwner, setCardOwner] = useState(value.cardOwner)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await adminPost('settings.save', { section: 'payment', value: { cardNumber, cardOwner } })
      onSaved({ cardNumber, cardOwner })
      notify('Karta ma’lumotlari saqlandi')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Saqlanmadi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="To'lov kartasi" action={<CreditCard size={17} style={{ color: 'var(--brand)' }} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Karta raqami">
          <Input value={cardNumber} onChange={setCardNumber} placeholder="8600 0000 0000 0000" />
        </Field>
        <Field label="Karta egasi">
          <Input value={cardOwner} onChange={setCardOwner} placeholder="ISM FAMILIYA" />
        </Field>
      </div>
      <div className="mt-4">
        <Button onClick={save} loading={saving}>
          Saqlash
        </Button>
      </div>
    </Card>
  )
}

// ─── Yetkazib berish ──────────────────────────────────────────

function DeliveryCard({
  value,
  onSaved,
}: {
  value: Settings['delivery']
  onSaved: (next: Settings['delivery']) => void
}) {
  const { notify } = useUi()
  const [fee, setFee] = useState(String(value.fee))
  const [freeFrom, setFreeFrom] = useState(String(value.freeFrom))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const next = { fee: Number(fee) || 0, freeFrom: Number(freeFrom) || 0 }
      await adminPost('settings.save', { section: 'delivery', value: next })
      onSaved(next)
      notify('Yetkazib berish sozlamalari saqlandi')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Saqlanmadi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Yetkazib berish" action={<Truck size={17} style={{ color: 'var(--brand)' }} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Narxi (so'm)" hint="0 — har doim bepul">
          <Input value={fee} onChange={setFee} type="number" placeholder="20000" />
        </Field>
        <Field label="Bepul yetkazish chegarasi" hint="Shu summadan yuqori buyurtmalar bepul. 0 — chegara yo'q.">
          <Input value={freeFrom} onChange={setFreeFrom} type="number" placeholder="500000" />
        </Field>
      </div>
      <div className="mt-4">
        <Button onClick={save} loading={saving}>
          Saqlash
        </Button>
      </div>
    </Card>
  )
}

// ─── Aloqa ma'lumotlari ───────────────────────────────────────

function ContactCard({
  value,
  onSaved,
}: {
  value: Settings['contact']
  onSaved: (next: Settings['contact']) => void
}) {
  const { notify } = useUi()
  const [form, setForm] = useState(value)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof Settings['contact']) => (next: string) =>
    setForm((current) => ({ ...current, [key]: next }))

  const save = async () => {
    setSaving(true)
    try {
      await adminPost('settings.save', { section: 'contact', value: form })
      onSaved(form)
      notify("Aloqa ma’lumotlari saqlandi")
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Saqlanmadi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="Aloqa ma'lumotlari"
      action={<Phone size={17} style={{ color: 'var(--brand)' }} />}
    >
      <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
        Bu qiymatlar do'konning "Yordam" sahifasida va bot javoblarida ko'rinadi.
        Bo'sh qoldirilsa, kodga yozilgan qiymat ishlatiladi.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Telefon">
          <Input value={form.phone} onChange={set('phone')} placeholder="+998 90 123 45 67" />
        </Field>
        <Field label="Telegram">
          <Input value={form.telegram} onChange={set('telegram')} placeholder="@ujvision" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={set('email')} placeholder="info@ujvision.uz" />
        </Field>
        <Field label="Ish vaqti">
          <Input value={form.workHours} onChange={set('workHours')} placeholder="10:00 — 21:00" />
        </Field>
      </div>

      <Field label="Shahar / manzil">
        <Input value={form.city} onChange={set('city')} placeholder="Toshkent, O'zbekiston" />
      </Field>

      <div className="mt-4">
        <Button onClick={save} loading={saving}>
          Saqlash
        </Button>
      </div>
    </Card>
  )
}

// ─── Promokodlar ──────────────────────────────────────────────

function PromoRow({
  promo,
  onEdit,
  onDeleted,
}: {
  promo: Promo
  onEdit: () => void
  onDeleted: () => Promise<void>
}) {
  const { notify, confirm } = useUi()

  const remove = () =>
    confirm({
      title: "Promokodni o'chirish",
      text: `"${promo.code}" o'chiriladi.`,
      confirmLabel: "O'chirish",
      danger: true,
      onConfirm: async () => {
        await adminPost('promo.delete', { id: promo.id })
        notify("Promokod o'chirildi")
        await onDeleted()
      },
    })

  return (
    <div className="a-row">
      <div className="a-row__main">
        <p className="a-row__title">
          {promo.code}{' '}
          <Badge tone={promo.active === false ? 'neutral' : 'success'}>
            {promo.active === false ? 'Faol emas' : 'Faol'}
          </Badge>
        </p>
        <p className="a-row__sub">
          −{promo.discountPercent}% · {promo.usageCount || 0} marta ishlatilgan
          {Number(promo.maxUses) > 0 && ` / ${promo.maxUses}`}
        </p>
      </div>
      <div className="a-actions">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Tahrirlash
        </Button>
        <button className="a-icon-btn a-icon-btn--danger" onClick={remove} aria-label="O'chirish">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

function PromoModal({
  promo,
  onClose,
  onSaved,
}: {
  promo: Promo
  onClose: () => void
  onSaved: () => void
}) {
  const { notify } = useUi()
  const [code, setCode] = useState(promo.code || '')
  const [discount, setDiscount] = useState(String(promo.discountPercent || 10))
  const [maxUses, setMaxUses] = useState(String(promo.maxUses || 0))
  const [minOrderTotal, setMinOrderTotal] = useState(String(promo.minOrderTotal || 0))
  const [active, setActive] = useState(promo.active !== false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await adminPost('promo.save', {
        id: promo.id || undefined,
        code,
        discountPercent: Number(discount),
        maxUses: Number(maxUses) || 0,
        minOrderTotal: Number(minOrderTotal) || 0,
        active,
      })
      notify(promo.id ? 'Promokod yangilandi' : "Promokod qo'shildi")
      onSaved()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Saqlanmadi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={promo.id ? 'Promokodni tahrirlash' : 'Yangi promokod'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={save} loading={saving}>
            Saqlash
          </Button>
        </>
      }
    >
      <Field label="Kod" hint="Katta harflarda saqlanadi.">
        <Input value={code} onChange={setCode} placeholder="QISH25" autoFocus />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chegirma (%)">
          <Input value={discount} onChange={setDiscount} type="number" placeholder="15" />
        </Field>
        <Field label="Foydalanish chegarasi" hint="0 — cheksiz">
          <Input value={maxUses} onChange={setMaxUses} type="number" placeholder="100" />
        </Field>
      </div>

      <Field label="Eng kam buyurtma summasi" hint="0 — cheklov yo'q">
        <Input value={minOrderTotal} onChange={setMinOrderTotal} type="number" placeholder="200000" />
      </Field>

      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        Faol
      </label>
    </Modal>
  )
}

// ─── Parolni o'zgartirish ─────────────────────────────────────

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { notify } = useUi()
  const [username, setUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (newPassword !== repeat) {
      notify('Yangi parollar mos kelmadi', 'error')
      return
    }
    setSaving(true)
    try {
      await adminPost('changePassword', {
        username: username.trim() || undefined,
        currentPassword,
        newPassword,
      })
      notify("Parol o'zgartirildi")
      onClose()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Bajarilmadi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title="Login va parolni o'zgartirish"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={save} loading={saving}>
            Saqlash
          </Button>
        </>
      }
    >
      <Field label="Yangi login" hint="Bo'sh qoldirsangiz, amaldagi login o'zgarmaydi.">
        <Input value={username} onChange={setUsername} placeholder="admin" />
      </Field>
      <Field label="Amaldagi parol">
        <Input value={currentPassword} onChange={setCurrentPassword} type="password" />
      </Field>
      <Field label="Yangi parol" hint="Kamida 8 ta belgi.">
        <Input value={newPassword} onChange={setNewPassword} type="password" />
      </Field>
      <Field label="Yangi parolni takrorlang">
        <Input value={repeat} onChange={setRepeat} type="password" />
      </Field>
    </Modal>
  )
}
