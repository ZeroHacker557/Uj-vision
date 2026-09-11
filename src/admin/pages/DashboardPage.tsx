import { useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Boxes, Clock, PackageCheck, ShoppingBag, TrendingUp, Users, Wallet,
} from 'lucide-react'
import { adminPost, money, shortDate } from '../api'
import { Badge, Button, Card, EmptyState, Spinner } from '../ui'
import type { AdminPage } from '../AdminApp'

type Overview = {
  totals: {
    orders: number
    newOrders: number
    acceptedOrders: number
    deliveredOrders: number
    customers: number
    products: number
    revenue: number
    pendingRevenue: number
  }
  periods: Record<'today' | 'week' | 'month', { orders: number; revenue: number }>
  chart: { date: string; orders: number; revenue: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  lowStock: { id: string; name: string; stock: number }[]
  recentOrders: Record<string, unknown>[]
}

const STATUS_TONE = {
  Yangi: 'brand',
  'Qabul qilindi': 'info',
  Yetkazildi: 'success',
} as const

export function DashboardPage({ onNavigate }: { onNavigate: (page: AdminPage) => void }) {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminPost<Overview>('overview')
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Xatolik'))
  }, [])

  if (error) {
    return <EmptyState icon={<AlertTriangle size={24} />} title="Ma'lumot yuklanmadi" text={error} />
  }

  if (!data) return <Spinner label="Yuklanmoqda..." />

  const { totals, periods, chart, topProducts, lowStock, recentOrders } = data
  const maxBar = Math.max(...chart.map((point) => point.orders), 1)

  return (
    <div className="space-y-4">
      <div className="a-stats">
        <Stat icon={<ShoppingBag size={17} />} value={String(totals.newOrders)} label="Yangi buyurtma" />
        <Stat icon={<Clock size={17} />} value={String(totals.acceptedOrders)} label="Qabul qilingan" />
        <Stat icon={<PackageCheck size={17} />} value={String(totals.deliveredOrders)} label="Yetkazilgan" />
        <Stat icon={<Wallet size={17} />} value={money(totals.revenue)} label="Jami tushum (so'm)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="So'nggi 14 kun"
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('orders')}>
                Buyurtmalar <ArrowRight size={14} />
              </Button>
            }
          >
            <div className="a-chart">
              {chart.map((point) => (
                <div
                  key={point.date}
                  className="a-chart__bar"
                  style={{ height: `${Math.max((point.orders / maxBar) * 100, 3)}%` }}
                  title={`${point.date}: ${point.orders} ta, ${money(point.revenue)} so'm`}
                />
              ))}
            </div>
            <div className="a-chart__labels">
              {chart.map((point) => (
                <span key={point.date} className="a-chart__label">
                  {point.date.slice(8)}
                </span>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Period label="Bugun" data={periods.today} />
              <Period label="7 kun" data={periods.week} />
              <Period label="30 kun" data={periods.month} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Do'kon">
            <div className="space-y-3">
              <Line icon={<Users size={16} />} label="Mijozlar" value={String(totals.customers)} />
              <Line icon={<Boxes size={16} />} label="Mahsulotlar" value={String(totals.products)} />
              <Line
                icon={<TrendingUp size={16} />}
                label="Kutilayotgan summa"
                value={`${money(totals.pendingRevenue)} so'm`}
              />
            </div>
          </Card>

          {lowStock.length > 0 && (
            <Card title="Qoldiq tugayapti">
              <div className="space-y-2">
                {lowStock.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <Badge tone={item.stock <= 0 ? 'danger' : 'warning'}>{item.stock} dona</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Eng ko'p sotilganlar" padded={false}>
          {topProducts.length === 0 ? (
            <EmptyState title="Hali sotuv yo'q" text="Buyurtma yetkazilgach shu yerda ko'rinadi." />
          ) : (
            topProducts.map((product) => (
              <div key={product.name} className="a-row">
                <div className="a-row__main">
                  <p className="a-row__title truncate">{product.name}</p>
                  <p className="a-row__sub">{money(product.revenue)} so'm</p>
                </div>
                <Badge tone="brand">{product.quantity} dona</Badge>
              </div>
            ))
          )}
        </Card>

        <Card
          title="So'nggi buyurtmalar"
          action={
            <Button size="sm" variant="ghost" onClick={() => onNavigate('orders')}>
              Hammasi
            </Button>
          }
          padded={false}
        >
          {recentOrders.length === 0 ? (
            <EmptyState title="Buyurtma yo'q" />
          ) : (
            recentOrders.map((order) => {
              const customer = (order.customer || {}) as Record<string, unknown>
              const status = String(order.status || 'Yangi') as keyof typeof STATUS_TONE
              return (
                <div key={String(order.id)} className="a-row">
                  <div className="a-row__main">
                    <p className="a-row__title">
                      {String(order.orderNumber)} · {String(customer.name || '')}
                    </p>
                    <p className="a-row__sub">
                      {shortDate(order.createdAt)} · {money(order.total)} so'm
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[status] || 'neutral'}>{status}</Badge>
                </div>
              )
            })
          )}
        </Card>
      </div>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="a-stat">
      <span className="a-stat__icon">{icon}</span>
      <p className="a-stat__value">{value}</p>
      <p className="a-stat__label">{label}</p>
    </div>
  )
}

function Period({ label, data }: { label: string; data: { orders: number; revenue: number } }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="mt-1 text-base font-extrabold">{data.orders} ta</p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {money(data.revenue)} so'm
      </p>
    </div>
  )
}

function Line({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span style={{ color: 'var(--brand)' }}>{icon}</span>
      <span className="flex-1" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <b>{value}</b>
    </div>
  )
}
