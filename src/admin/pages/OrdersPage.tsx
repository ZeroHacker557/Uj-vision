import { useCallback, useEffect, useState } from 'react'
import {
  Check, ChevronDown, MapPin, PackageCheck, Phone, Receipt, RefreshCw, Search, ShoppingBag, Trash2,
} from 'lucide-react'
import { adminPost, money, shortDate } from '../api'
import { Badge, Button, Card, EmptyState, Input, Modal, Spinner } from '../ui'
import { useUi } from '../ui-context'

/**
 * Buyurtmalar bo'limi.
 *
 * Uchta holat bor va ularning ikkitasini admin qo'yadi:
 *   Yangi  →  [Qabul qilish]  →  Qabul qilindi  →  [Yetkazildi]
 *
 * Har bir o'zgarishda mijozga Telegram orqali xabar ketadi — buni
 * server bajaradi, panel faqat buyruq beradi.
 */

type OrderItem = {
  product?: { name?: string; price?: number; images?: string[] }
  quantity?: number
  size?: string | null
  color?: string | null
}

type Order = {
  id: string
  orderNumber?: string
  createdAt?: string
  status?: string
  total?: number
  subtotal?: number
  discount?: number
  deliveryFee?: number
  promoCode?: string | null
  paymentMethod?: string
  paymentStatus?: string
  receiptUrl?: string
  products?: OrderItem[]
  customer?: {
    name?: string
    phone?: string
    address?: string
    comment?: string
    location?: { lat: number; lng: number } | null
  }
}

type Counts = { all: number; Yangi: number; 'Qabul qilindi': number; Yetkazildi: number }

const TABS: { id: string; label: string; key: keyof Counts }[] = [
  { id: 'all', label: 'Barchasi', key: 'all' },
  { id: 'Yangi', label: 'Yangi', key: 'Yangi' },
  { id: 'Qabul qilindi', label: 'Qabul qilindi', key: 'Qabul qilindi' },
  { id: 'Yetkazildi', label: 'Yetkazildi', key: 'Yetkazildi' },
]

const STATUS_TONE = {
  Yangi: 'brand',
  'Qabul qilindi': 'info',
  Yetkazildi: 'success',
} as const

export function OrdersPage({ onChanged }: { onChanged: () => void }) {
  const { notify, confirm } = useUi()
  const [orders, setOrders] = useState<Order[]>([])
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    Yangi: 0,
    'Qabul qilindi': 0,
    Yetkazildi: 0,
  })
  const [tab, setTab] = useState('Yangi')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)

  const load = useCallback(
    () =>
      adminPost<{ orders: Order[]; counts: Counts }>('orders.list', { status: tab, search })
        .then((result) => {
          setOrders(result.orders)
          setCounts(result.counts)
        })
        .catch((caught) =>
          notify(caught instanceof Error ? caught.message : 'Yuklanmadi', 'error'),
        )
        .finally(() => setLoading(false)),
    [tab, search, notify],
  )

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = async (order: Order, status: string) => {
    setBusyId(order.id)
    try {
      await adminPost('orders.setStatus', { id: order.id, status })
      notify(`${order.orderNumber} → ${status}. Mijozga xabar yuborildi.`)
      await load()
      onChanged()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Bajarilmadi', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const setPayment = async (order: Order, paymentStatus: string) => {
    setBusyId(order.id)
    try {
      await adminPost('orders.setPayment', { id: order.id, paymentStatus })
      notify(paymentStatus === 'Tolangan' ? "To'lov tasdiqlandi" : "To'lov rad etildi")
      await load()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Bajarilmadi', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const remove = (order: Order) =>
    confirm({
      title: "Buyurtmani o'chirish",
      text: `${order.orderNumber} butunlay o'chiriladi. Buni ortga qaytarib bo'lmaydi.`,
      confirmLabel: "O'chirish",
      danger: true,
      onConfirm: async () => {
        await adminPost('orders.delete', { id: order.id })
        notify("Buyurtma o'chirildi")
        await load()
        onChanged()
      },
    })

  return (
    <div>
      <div className="a-toolbar">
        <div className="a-toolbar__search">
          <Input value={search} onChange={setSearch} placeholder="Raqam, ism yoki telefon..." />
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setLoading(true)
            void load()
          }}
        >
          <RefreshCw size={15} />
          Yangilash
        </Button>
      </div>

      <div className="a-tabs mb-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={'a-tab' + (tab === item.id ? ' a-tab--active' : '')}
          >
            {item.label}
            <span className="a-tab__count">{counts[item.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Buyurtmalar yuklanmoqda..." />
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search size={22} />}
            title="Buyurtma topilmadi"
            text={search ? 'Qidiruv bo‘yicha hech narsa yo‘q.' : 'Bu bo‘limda hozircha bo‘sh.'}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const customer = order.customer || {}
            const status = String(order.status || 'Yangi') as keyof typeof STATUS_TONE
            const isOpen = expanded === order.id
            const isCard = order.paymentMethod === 'Karta'

            return (
              <Card key={order.id} padded={false}>
                <div className="p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-base">{order.orderNumber}</b>
                        <Badge tone={STATUS_TONE[status] || 'neutral'}>{status}</Badge>
                        {isCard && (
                          <Badge
                            tone={
                              order.paymentStatus === 'Tolangan'
                                ? 'success'
                                : order.paymentStatus === 'Rad etildi'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            Karta · {order.paymentStatus || 'Kutilmoqda'}
                          </Badge>
                        )}
                        {!isCard && <Badge tone="neutral">Naqd</Badge>}
                      </div>
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        {shortDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold">{money(order.total)}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        so'm
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="font-bold">{customer.name}</p>
                    <p className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                      <Phone size={13} />
                      <a href={`tel:${customer.phone}`} className="underline-offset-2 hover:underline">
                        {customer.phone}
                      </a>
                    </p>
                    <p className="flex items-start gap-1.5" style={{ color: 'var(--muted)' }}>
                      <MapPin size={13} className="mt-0.5 shrink-0" />
                      <span>{customer.address}</span>
                    </p>
                    {customer.comment && (
                      <p className="text-xs italic" style={{ color: 'var(--faint)' }}>
                        “{customer.comment}”
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {status === 'Yangi' && (
                      <Button
                        size="sm"
                        loading={busyId === order.id}
                        onClick={() => setStatus(order, 'Qabul qilindi')}
                      >
                        <Check size={15} />
                        Qabul qilish
                      </Button>
                    )}
                    {status === 'Qabul qilindi' && (
                      <Button
                        size="sm"
                        loading={busyId === order.id}
                        onClick={() => setStatus(order, 'Yetkazildi')}
                      >
                        <PackageCheck size={15} />
                        Yetkazildi
                      </Button>
                    )}

                    {isCard && order.receiptUrl && (
                      <Button size="sm" variant="soft" onClick={() => setReceipt(order.receiptUrl!)}>
                        <Receipt size={15} />
                        Chekni ko'rish
                      </Button>
                    )}
                    {isCard && order.paymentStatus !== 'Tolangan' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === order.id}
                        onClick={() => setPayment(order, 'Tolangan')}
                      >
                        To'landi
                      </Button>
                    )}
                    {isCard && order.paymentStatus !== 'Rad etildi' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === order.id}
                        onClick={() => setPayment(order, 'Rad etildi')}
                      >
                        Chekni rad etish
                      </Button>
                    )}

                    {customer.location && (
                      <a
                        className="a-btn a-btn--ghost a-btn--sm"
                        href={`https://maps.google.com/?q=${customer.location.lat},${customer.location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin size={15} />
                        Xaritada
                      </a>
                    )}

                    <button
                      className="a-btn a-btn--ghost a-btn--sm"
                      onClick={() => setExpanded(isOpen ? null : order.id)}
                    >
                      <ShoppingBag size={15} />
                      {order.products?.length || 0} ta mahsulot
                      <ChevronDown
                        size={14}
                        style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
                      />
                    </button>

                    <button
                      className="a-icon-btn a-icon-btn--danger ml-auto"
                      onClick={() => remove(order)}
                      aria-label="O'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div
                    className="border-t p-4"
                    style={{ borderColor: 'var(--line-soft)', background: 'var(--surface-2)' }}
                  >
                    <div className="space-y-2">
                      {(order.products || []).map((item, index) => {
                        const variant = [
                          item.size && `O'lcham: ${item.size}`,
                          item.color && `Rang: ${item.color}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                        return (
                          <div key={index} className="flex items-center gap-3 text-sm">
                            {item.product?.images?.[0] && (
                              <img className="a-row__thumb" src={item.product.images[0]} alt="" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{item.product?.name}</p>
                              {variant && (
                                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                                  {variant}
                                </p>
                              )}
                            </div>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>
                              {item.quantity} × {money(item.product?.price)}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    <div
                      className="mt-3 space-y-1 border-t pt-3 text-sm"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <Row label="Mahsulotlar" value={`${money(order.subtotal)} so'm`} />
                      {Number(order.discount) > 0 && (
                        <Row
                          label={`Chegirma${order.promoCode ? ` (${order.promoCode})` : ''}`}
                          value={`−${money(order.discount)} so'm`}
                        />
                      )}
                      <Row
                        label="Yetkazib berish"
                        value={
                          Number(order.deliveryFee) > 0 ? `${money(order.deliveryFee)} so'm` : 'Bepul'
                        }
                      />
                      <Row label="Jami" value={`${money(order.total)} so'm`} bold />
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={Boolean(receipt)} title="To'lov cheki" onClose={() => setReceipt(null)}>
        {receipt && <img src={receipt} alt="To'lov cheki" className="w-full rounded-xl" />}
      </Modal>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600 }}>{value}</span>
    </div>
  )
}
