import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3, Boxes, LayoutGrid, LogOut, Megaphone, Menu, Settings, ShoppingBag, Users, X,
} from 'lucide-react'
import mark from '../images/uj-mark.webp'
import { BRAND } from '../config/brand'
import { adminPost, setUnauthorizedHandler } from './api'
import { Button, Spinner, UiProvider } from './ui'
import { useUi } from './ui-context'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CustomersPage } from './pages/CustomersPage'
import { BroadcastPage } from './pages/BroadcastPage'
import { SettingsPage } from './pages/SettingsPage'
import './admin.css'

/**
 * Admin panel — `/admin` manzilida ochiladi.
 *
 * Mini app'dan butunlay ajratilgan: o'z tuzilishi, o'z navigatsiyasi va
 * o'z autentifikatsiyasi bor. Telegram ichida emas, oddiy brauzerda
 * ishlaydi, shuning uchun kirish login/parol orqali.
 *
 * Navigatsiya uchun alohida kutubxona olinmadi — yetti sahifa uchun
 * `history.pushState` va `popstate` kifoya, bu esa mini app bundle'iga
 * ortiqcha kilobayt qo'shmaydi.
 */

export type AdminPage =
  | 'dashboard' | 'orders' | 'products' | 'categories'
  | 'customers' | 'broadcast' | 'settings'

const NAV: { id: AdminPage; label: string; icon: typeof BarChart3; path: string }[] = [
  { id: 'dashboard', label: 'Boshqaruv paneli', icon: BarChart3, path: '/admin' },
  { id: 'orders', label: 'Buyurtmalar', icon: ShoppingBag, path: '/admin/orders' },
  { id: 'products', label: 'Mahsulotlar', icon: Boxes, path: '/admin/products' },
  { id: 'categories', label: 'Kategoriyalar', icon: LayoutGrid, path: '/admin/categories' },
  { id: 'customers', label: 'Mijozlar', icon: Users, path: '/admin/customers' },
  { id: 'broadcast', label: 'Xabar yuborish', icon: Megaphone, path: '/admin/broadcast' },
  { id: 'settings', label: 'Sozlamalar', icon: Settings, path: '/admin/settings' },
]

function pageFromPath(pathname: string): AdminPage {
  const rest = pathname.replace(/^\/admin\/?/, '').replace(/\/+$/, '')
  const found = NAV.find((item) => item.id === rest)
  return found ? found.id : 'dashboard'
}

export default function AdminApp() {
  return (
    <UiProvider>
      <AdminShell />
    </UiProvider>
  )
}

function AdminShell() {
  const { notify } = useUi()
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState<string | null>(null)
  const [page, setPage] = useState<AdminPage>(() => pageFromPath(window.location.pathname))
  const [menuOpen, setMenuOpen] = useState(false)
  const [newOrders, setNewOrders] = useState(0)

  // Sessiya tugasa — kirish ekraniga qaytamiz (har qanday so'rovdan keyin)
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUsername(null)
      notify('Sessiya tugadi, qaytadan kiring', 'error')
    })
    return () => setUnauthorizedHandler(null)
  }, [notify])

  // Sahifa ochilganda sessiya bor-yo'qligini tekshiramiz
  useEffect(() => {
    let cancelled = false
    adminPost<{ username: string }>('me')
      .then((result) => {
        if (!cancelled) setUsername(result.username)
      })
      .catch(() => {
        if (!cancelled) setUsername(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Brauzerning "orqaga" tugmasi ham ishlasin
  useEffect(() => {
    const onPop = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((next: AdminPage) => {
    const target = NAV.find((item) => item.id === next)
    if (target) window.history.pushState({}, '', target.path)
    setPage(next)
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
  }, [])

  // Yon menyudagi "Yangi" hisoblagichi — buyurtmalar sahifasi yangilaganda.
  // Holat va'da (promise) ichida o'rnatiladi: effekt tanasida to'g'ridan-
  // to'g'ri setState chaqirish qayta-qayta render'ga olib keladi.
  const refreshBadge = useCallback(
    () =>
      adminPost<{ counts: Record<string, number> }>('orders.list', { limit: 300 })
        .then((result) => setNewOrders(result.counts?.Yangi || 0))
        .catch(() => {
          /* hisoblagich ko'rinmasa ham panel ishlayveradi */
        }),
    [],
  )

  useEffect(() => {
    if (username) void refreshBadge()
  }, [username, page, refreshBadge])

  const logout = async () => {
    try {
      await adminPost('logout')
    } finally {
      setUsername(null)
      notify('Tizimdan chiqdingiz')
    }
  }

  if (checking) {
    return (
      <div className="a-login">
        <Spinner label="Tekshirilmoqda..." />
      </div>
    )
  }

  if (!username) {
    return <LoginPage onSuccess={(name) => setUsername(name)} />
  }

  const current = NAV.find((item) => item.id === page) || NAV[0]

  return (
    <div className="a-shell">
      {menuOpen && <button className="a-scrim" onClick={() => setMenuOpen(false)} aria-label="Yopish" />}

      <aside className={'a-sidebar' + (menuOpen ? ' a-sidebar--open' : '')}>
        <div className="a-sidebar__brand">
          <img className="a-sidebar__mark" src={mark} alt="" />
          <span className="min-w-0">
            <span className="a-sidebar__name">{BRAND.name}</span>
            <span className="a-sidebar__role">Admin panel</span>
          </span>
          <button
            className="a-icon-btn a-sidebar__close"
            onClick={() => setMenuOpen(false)}
            aria-label="Menyuni yopish"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="a-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={'a-nav__item' + (page === id ? ' a-nav__item--active' : '')}
            >
              <Icon size={18} />
              <span className="truncate">{label}</span>
              {id === 'orders' && newOrders > 0 && <span className="a-nav__count">{newOrders}</span>}
            </button>
          ))}
        </nav>

        <div className="a-sidebar__foot">
          <Button variant="ghost" full onClick={logout}>
            <LogOut size={16} />
            Chiqish ({username})
          </Button>
        </div>
      </aside>

      <main className="a-main">
        <header className="a-topbar">
          <button
            className="a-icon-btn a-burger"
            onClick={() => setMenuOpen(true)}
            aria-label="Menyu"
          >
            <Menu size={20} />
          </button>
          <h1 className="a-topbar__title">{current.label}</h1>
        </header>

        <div className="a-content">
          {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
          {page === 'orders' && <OrdersPage onChanged={refreshBadge} />}
          {page === 'products' && <ProductsPage />}
          {page === 'categories' && <CategoriesPage />}
          {page === 'customers' && <CustomersPage />}
          {page === 'broadcast' && <BroadcastPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}
