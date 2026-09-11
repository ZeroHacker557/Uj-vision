import { useCallback, useEffect, useState } from 'react'
import { MapPin, Phone, Users } from 'lucide-react'
import { adminPost, money, shortDate } from '../api'
import { Badge, Card, EmptyState, Input, Modal, Spinner } from '../ui'
import { useUi } from '../ui-context'

/**
 * Mijozlar bo'limi.
 *
 * Foydalanuvchi hujjatlari Telegram orqali kirganda yaratiladi, xarid
 * statistikasi esa buyurtmalardan hisoblanadi — shuning uchun bu yerda
 * tahrirlash yo'q, faqat ko'rish.
 */

type Address = { id?: string; name?: string; address?: string }

type Customer = {
  id: number
  firstName: string
  lastName: string
  username: string
  phone: string
  photoUrl: string
  language: string
  addresses: Address[]
  lastActive: string
  ordersCount: number
  totalSpent: number
  lastOrderAt: string
}

export function CustomersPage() {
  const { notify } = useUi()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const load = useCallback(
    () =>
      adminPost<{ customers: Customer[] }>('customers.list', { search })
        .then((result) => setCustomers(result.customers))
        .catch((caught) =>
          notify(caught instanceof Error ? caught.message : 'Yuklanmadi', 'error'),
        )
        .finally(() => setLoading(false)),
    [search, notify],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <div className="a-toolbar">
        <div className="a-toolbar__search">
          <Input value={search} onChange={setSearch} placeholder="Ism, username yoki telefon..." />
        </div>
        <Badge tone="brand">{customers.length} ta mijoz</Badge>
      </div>

      {loading ? (
        <Spinner label="Yuklanmoqda..." />
      ) : customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={22} />}
            title="Mijoz topilmadi"
            text="Botga /start yuborgan foydalanuvchilar shu yerda ko'rinadi."
          />
        </Card>
      ) : (
        <Card padded={false}>
          {customers.map((customer) => (
            <button
              key={customer.id}
              className="a-row w-full text-left"
              onClick={() => setSelected(customer)}
            >
              {customer.photoUrl ? (
                <img className="a-row__thumb rounded-full" src={customer.photoUrl} alt="" />
              ) : (
                <span
                  className="a-row__thumb grid place-items-center rounded-full font-bold"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                >
                  {(customer.firstName || '?').slice(0, 1).toUpperCase()}
                </span>
              )}

              <div className="a-row__main">
                <p className="a-row__title truncate">
                  {customer.firstName} {customer.lastName}
                  {customer.username && (
                    <span className="ml-1 font-normal" style={{ color: 'var(--muted)' }}>
                      @{customer.username}
                    </span>
                  )}
                </p>
                <p className="a-row__sub">
                  {customer.phone || 'Raqam yo‘q'}
                  {customer.ordersCount > 0 && ` · ${customer.ordersCount} ta buyurtma`}
                </p>
              </div>

              {customer.totalSpent > 0 && (
                <Badge tone="success">{money(customer.totalSpent)} so'm</Badge>
              )}
            </button>
          ))}
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.firstName} ${selected.lastName}`.trim() : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <Line label="Telegram ID" value={String(selected.id)} />
              {selected.username && <Line label="Username" value={`@${selected.username}`} />}
              <Line label="Til" value={selected.language === 'ru' ? 'Ruscha' : "O'zbekcha"} />
              <Line label="Oxirgi faollik" value={shortDate(selected.lastActive)} />
            </div>

            {selected.phone && (
              <a
                href={`tel:${selected.phone}`}
                className="a-btn a-btn--soft a-btn--md a-btn--full"
              >
                <Phone size={15} />
                {selected.phone}
              </a>
            )}

            <div
              className="grid grid-cols-2 gap-3 rounded-xl p-3"
              style={{ background: 'var(--surface-2)' }}
            >
              <div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Buyurtmalar
                </p>
                <p className="text-lg font-extrabold">{selected.ordersCount}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Sarflagan
                </p>
                <p className="text-lg font-extrabold">{money(selected.totalSpent)}</p>
              </div>
            </div>

            {selected.addresses.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  SAQLANGAN MANZILLAR
                </p>
                <div className="space-y-2">
                  {selected.addresses.map((address, index) => (
                    <div key={address.id || index} className="flex gap-2">
                      <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
                      <div>
                        <p className="font-semibold">{address.name}</p>
                        <p style={{ color: 'var(--muted)' }}>{address.address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <b className="truncate">{value}</b>
    </div>
  )
}
