import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Boxes, ImagePlus, Loader2, Pencil, Plus, Trash2, X,
} from 'lucide-react'
import { adminPost, fileToDataUrl, money } from '../api'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Textarea } from '../ui'
import { useUi } from '../ui-context'

/**
 * Mahsulotlar bo'limi.
 *
 * Tartib `sortOrder` maydonida saqlanadi va mini app katalogi aynan shu
 * tartibda ko'rsatadi — ya'ni "yuqoriga ko'tarish" tugmasi do'kondagi
 * ko'rinishni ham o'zgartiradi.
 */

type Product = {
  id: string
  name?: string
  price?: number
  oldPrice?: number | null
  category?: string
  images?: string[]
  sizes?: string[]
  color?: string
  description?: string
  discount?: string
  stock?: number
  sortOrder?: number
}

type Category = { id: string; name?: string }

const EMPTY: Product = {
  id: '',
  name: '',
  price: 0,
  category: '',
  images: [],
  sizes: [],
  color: '',
  description: '',
  discount: '',
  stock: 0,
}

export function ProductsPage() {
  const { notify, confirm } = useUi()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)

  const load = useCallback(
    () =>
      Promise.all([
        adminPost<{ products: Product[] }>('products.list'),
        adminPost<{ categories: Category[] }>('categories.list'),
      ])
        .then(([productsResult, categoriesResult]) => {
          setProducts(productsResult.products)
          setCategories(categoriesResult.categories)
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

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return products.filter((product) => {
      if (categoryFilter && product.category !== categoryFilter) return false
      if (!needle) return true
      return String(product.name || '').toLowerCase().includes(needle)
    })
  }, [products, search, categoryFilter])

  /**
   * Ro'yxatdagi joyni bitta pog'ona yuqori yoki pastga suradi.
   *
   * Tartib butun ro'yxat bo'yicha saqlanadi, filtr bo'yicha emas —
   * shuning uchun ko'chirish har doim to'liq ro'yxatda bajariladi.
   */
  const move = async (product: Product, direction: -1 | 1) => {
    const index = products.findIndex((item) => item.id === product.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= products.length) return

    const next = [...products]
    ;[next[index], next[target]] = [next[target], next[index]]
    setProducts(next)

    try {
      await adminPost('products.reorder', { ids: next.map((item) => item.id) })
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Tartib saqlanmadi', 'error')
      await load()
    }
  }

  const remove = (product: Product) =>
    confirm({
      title: "Mahsulotni o'chirish",
      text: `"${product.name}" katalogdan butunlay o'chiriladi.`,
      confirmLabel: "O'chirish",
      danger: true,
      onConfirm: async () => {
        await adminPost('products.delete', { id: product.id })
        notify("Mahsulot o'chirildi")
        await load()
      },
    })

  return (
    <div>
      <div className="a-toolbar">
        <div className="a-toolbar__search">
          <Input value={search} onChange={setSearch} placeholder="Mahsulot nomi..." />
        </div>
        <div style={{ minWidth: 170 }}>
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: '', label: 'Barcha kategoriyalar' },
              ...categories.map((category) => ({
                value: String(category.name),
                label: String(category.name),
              })),
            ]}
          />
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus size={16} />
          Yangi mahsulot
        </Button>
      </div>

      {loading ? (
        <Spinner label="Yuklanmoqda..." />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes size={22} />}
            title="Mahsulot yo'q"
            text="Birinchi mahsulotni qo'shing — u darhol do'konda ko'rinadi."
            action={
              <Button onClick={() => setEditing({ ...EMPTY })}>
                <Plus size={16} />
                Mahsulot qo'shish
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          {shown.map((product) => {
            const index = products.findIndex((item) => item.id === product.id)
            return (
              <div key={product.id} className="a-row">
                {product.images?.[0] ? (
                  <img className="a-row__thumb" src={product.images[0]} alt="" />
                ) : (
                  <span className="a-row__thumb grid place-items-center" style={{ color: 'var(--faint)' }}>
                    <ImagePlus size={17} />
                  </span>
                )}

                <div className="a-row__main">
                  <p className="a-row__title truncate">{product.name}</p>
                  <p className="a-row__sub">
                    {money(product.price)} so'm · {product.category}
                    {typeof product.stock === 'number' && ` · ${product.stock} dona`}
                  </p>
                </div>

                {typeof product.stock === 'number' && product.stock <= 0 && (
                  <Badge tone="danger">Tugagan</Badge>
                )}

                <div className="a-actions">
                  <button
                    className="a-icon-btn"
                    onClick={() => move(product, -1)}
                    disabled={index === 0}
                    aria-label="Yuqoriga"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="a-icon-btn"
                    onClick={() => move(product, 1)}
                    disabled={index === products.length - 1}
                    aria-label="Pastga"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button className="a-icon-btn" onClick={() => setEditing(product)} aria-label="Tahrirlash">
                    <Pencil size={16} />
                  </button>
                  <button
                    className="a-icon-btn a-icon-btn--danger"
                    onClick={() => remove(product)}
                    aria-label="O'chirish"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {editing && (
        <ProductModal
          product={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

// ─── Qo'shish / tahrirlash oynasi ─────────────────────────────

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const { notify } = useUi()
  const fileInput = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(product.name || '')
  const [price, setPrice] = useState(String(product.price || ''))
  const [oldPrice, setOldPrice] = useState(String(product.oldPrice || ''))
  const [category, setCategory] = useState(product.category || String(categories[0]?.name || ''))
  const [sizes, setSizes] = useState((product.sizes || []).join(', '))
  const [colors, setColors] = useState(product.color || '')
  const [description, setDescription] = useState(product.description || '')
  const [discount, setDiscount] = useState(product.discount || '')
  const [stock, setStock] = useState(String(product.stock ?? 0))
  const [images, setImages] = useState<string[]>(product.images || [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const pickImages = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const dataUrl = await fileToDataUrl(file)
        const result = await adminPost<{ url: string }>('upload', { dataUrl })
        setImages((current) => [...current, result.url].slice(0, 8))
      }
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Rasm yuklanmadi', 'error')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await adminPost('products.save', {
        id: product.id || undefined,
        name,
        price: Number(price),
        oldPrice: Number(oldPrice) || 0,
        category,
        images,
        sizes,
        colors,
        description,
        discount,
        stock: Number(stock) || 0,
        sortOrder: product.sortOrder ?? 0,
      })
      notify(product.id ? 'Mahsulot yangilandi' : "Mahsulot qo'shildi")
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
      wide
      title={product.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
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
      <Field label="Rasmlar" hint="Birinchi rasm asosiy bo'ladi. Ko'pi bilan 8 ta.">
        <div className="a-images">
          {images.map((url) => (
            <span key={url} className="a-images__item">
              <img src={url} alt="" />
              <button
                className="a-images__remove"
                onClick={() => setImages((current) => current.filter((item) => item !== url))}
                aria-label="Rasmni olib tashlash"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <label className="a-images__add">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            <span>{uploading ? 'Yuklanmoqda' : 'Qo‘shish'}</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => pickImages(event.target.files)}
            />
          </label>
        </div>
      </Field>

      <Field label="Nomi">
        <Input value={name} onChange={setName} placeholder="Masalan: Oversize futbolka" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Narxi (so'm)">
          <Input value={price} onChange={setPrice} type="number" placeholder="250000" />
        </Field>
        <Field label="Eski narxi" hint="Chegirmani ko'rsatish uchun. Bo'sh qoldirsa ko'rinmaydi.">
          <Input value={oldPrice} onChange={setOldPrice} type="number" placeholder="320000" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kategoriya">
          <Select
            value={category}
            onChange={setCategory}
            options={categories.map((item) => ({
              value: String(item.name),
              label: String(item.name),
            }))}
          />
        </Field>
        <Field label="Ombordagi qoldiq">
          <Input value={stock} onChange={setStock} type="number" placeholder="10" />
        </Field>
      </div>

      <Field label="O'lchamlar" hint="Vergul bilan ajrating: S, M, L, XL">
        <Input value={sizes} onChange={setSizes} placeholder="S, M, L, XL" />
      </Field>

      <Field label="Ranglar" hint="Vergul bilan ajrating: Qora, Oq, Bej">
        <Input value={colors} onChange={setColors} placeholder="Qora, Oq, Bej" />
      </Field>

      <Field label="Chegirma yorlig'i" hint="Karta ustidagi kichik yozuv, masalan −20%">
        <Input value={discount} onChange={setDiscount} placeholder="−20%" />
      </Field>

      <Field label="Tavsif">
        <Textarea
          value={description}
          onChange={setDescription}
          placeholder="Mato tarkibi, o'lcham jadvali, parvarish..."
        />
      </Field>
    </Modal>
  )
}
