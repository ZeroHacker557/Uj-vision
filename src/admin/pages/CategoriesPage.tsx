import { useCallback, useEffect, useState } from 'react'
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react'
import { adminPost } from '../api'
import { ICON_CHOICES, iconFor } from '../icons'
import { Button, Card, EmptyState, Field, Input, Modal, Spinner } from '../ui'
import { useUi } from '../ui-context'

/**
 * Kategoriyalar bo'limi.
 *
 * Ikonkalar oldindan tayyor: admin ro'yxatdan tanlaydi, mini app esa
 * o'sha kalit bo'yicha aynan shu ikonkani chizadi (src/admin/icons.ts).
 * Shu tufayli kategoriya hech qachon "quti" ikonkasi bilan qolmaydi.
 */

type Category = { id: string; name?: string; icon?: string }

export function CategoriesPage() {
  const { notify, confirm } = useUi()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Category | null>(null)

  const load = useCallback(
    () =>
      adminPost<{ categories: Category[] }>('categories.list')
        .then((result) => setCategories(result.categories))
        .catch((caught) =>
          notify(caught instanceof Error ? caught.message : 'Yuklanmadi', 'error'),
        )
        .finally(() => setLoading(false)),
    [notify],
  )

  useEffect(() => {
    void load()
  }, [load])

  const remove = (category: Category) =>
    confirm({
      title: "Kategoriyani o'chirish",
      text: `"${category.name}" o'chiriladi. Ichida mahsulot bo'lsa, avval ularni boshqa kategoriyaga ko'chirish kerak.`,
      confirmLabel: "O'chirish",
      danger: true,
      onConfirm: async () => {
        try {
          await adminPost('categories.delete', { id: category.id })
          notify("Kategoriya o'chirildi")
          await load()
        } catch (caught) {
          notify(caught instanceof Error ? caught.message : "O'chirilmadi", 'error')
        }
      },
    })

  return (
    <div>
      <div className="a-toolbar">
        <p className="flex-1 text-sm" style={{ color: 'var(--muted)' }}>
          Kategoriya nomi mahsulotdagi nom bilan bir xil bo'lishi kerak — nomni
          o'zgartirsangiz, mahsulotlar avtomatik ko'chiriladi.
        </p>
        <Button onClick={() => setEditing({ id: '', name: '', icon: 'tepa' })}>
          <Plus size={16} />
          Yangi kategoriya
        </Button>
      </div>

      {loading ? (
        <Spinner label="Yuklanmoqda..." />
      ) : categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutGrid size={22} />}
            title="Kategoriya yo'q"
            text="Mahsulot qo'shishdan oldin kamida bitta kategoriya kerak."
            action={
              <Button onClick={() => setEditing({ id: '', name: '', icon: 'tepa' })}>
                <Plus size={16} />
                Kategoriya qo'shish
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          {categories.map((category) => {
            const Icon = iconFor(category.icon, category.name)
            return (
              <div key={category.id} className="a-row">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                >
                  <Icon size={19} />
                </span>
                <div className="a-row__main">
                  <p className="a-row__title">{category.name}</p>
                  <p className="a-row__sub">{category.icon}</p>
                </div>
                <div className="a-actions">
                  <button className="a-icon-btn" onClick={() => setEditing(category)} aria-label="Tahrirlash">
                    <Pencil size={16} />
                  </button>
                  <button
                    className="a-icon-btn a-icon-btn--danger"
                    onClick={() => remove(category)}
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
        <CategoryModal
          category={editing}
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

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: Category
  onClose: () => void
  onSaved: () => void
}) {
  const { notify } = useUi()
  const [name, setName] = useState(category.name || '')
  const [icon, setIcon] = useState(category.icon || 'tepa')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await adminPost('categories.save', { id: category.id || undefined, name, icon })
      notify(category.id ? 'Kategoriya yangilandi' : "Kategoriya qo'shildi")
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
      title={category.id ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
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
      <Field label="Nomi">
        <Input value={name} onChange={setName} placeholder="Masalan: Kurtkalar" autoFocus />
      </Field>

      <Field label="Ikonka" hint="Do'konda kategoriya yonida shu belgi ko'rinadi.">
        <div className="a-icons">
          {ICON_CHOICES.map((choice) => {
            const Icon = iconFor(choice.key)
            return (
              <button
                key={choice.key}
                onClick={() => setIcon(choice.key)}
                className={'a-icons__item' + (icon === choice.key ? ' a-icons__item--active' : '')}
                title={choice.label}
              >
                <Icon size={19} />
                <span className="a-icons__label">{choice.label}</span>
              </button>
            )
          })}
        </div>
      </Field>
    </Modal>
  )
}
