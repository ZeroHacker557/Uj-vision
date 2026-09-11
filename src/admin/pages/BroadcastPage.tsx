import { useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { adminPost } from '../api'
import { Button, Card, Field, Input, Select, Textarea } from '../ui'
import { useUi } from '../ui-context'

/**
 * Ommaviy xabar.
 *
 * Xabar ikki joyga tushadi: Telegram (darhol ko'rinadi) va ilovadagi
 * "Bildirishnomalar" ro'yxati (keyin ham qoladi). Telegram sekundiga
 * cheklangan sonda xabar qabul qiladi, shuning uchun yuborish server
 * tomonda ketma-ket, kichik pauza bilan bajariladi — mijozlar ko'p
 * bo'lsa bir necha soniya kutish kerak.
 */
export function BroadcastPage() {
  const { notify, confirm } = useUi()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('all')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)

  const send = () => {
    if (!message.trim()) {
      notify("Xabar matnini yozing", 'error')
      return
    }

    confirm({
      title: 'Xabarni yuborish',
      text:
        audience === 'all'
          ? "Xabar do'konning BARCHA foydalanuvchilariga yuboriladi. Davom etamizmi?"
          : 'Xabar kamida bitta buyurtma bergan mijozlarga yuboriladi. Davom etamizmi?',
      confirmLabel: 'Yuborish',
      onConfirm: async () => {
        setSending(true)
        setResult(null)
        try {
          const response = await adminPost<{ sent: number; failed: number; total: number }>(
            'broadcast',
            { title: title.trim() || 'UJ VISION', text: message, audience },
          )
          setResult(response)
          notify(`${response.sent} ta mijozga yuborildi`)
          setMessage('')
          setTitle('')
        } catch (caught) {
          notify(caught instanceof Error ? caught.message : 'Yuborilmadi', 'error')
        } finally {
          setSending(false)
        }
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card title="Mijozlarga xabar">
        <Field label="Sarlavha" hint="Xabar boshida qalin harflar bilan ko'rinadi.">
          <Input value={title} onChange={setTitle} placeholder="Yangi kolleksiya" />
        </Field>

        <Field label="Xabar matni">
          <Textarea
            value={message}
            onChange={setMessage}
            rows={7}
            placeholder="Yangi qish kolleksiyasi keldi! Birinchi 50 xaridga 15% chegirma..."
          />
        </Field>

        <Field label="Kimga">
          <Select
            value={audience}
            onChange={setAudience}
            options={[
              { value: 'all', label: "Barcha foydalanuvchilarga" },
              { value: 'buyers', label: 'Faqat xarid qilganlarga' },
            ]}
          />
        </Field>

        <div className="mt-5">
          <Button onClick={send} loading={sending} full>
            <Send size={16} />
            Yuborish
          </Button>
        </div>

        {result && (
          <div
            className="mt-4 rounded-xl p-3 text-sm"
            style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
          >
            <b>{result.sent}</b> ta yetkazildi
            {result.failed > 0 && (
              <>
                , <b>{result.failed}</b> tasiga yetib bormadi (botni bloklagan bo'lishi mumkin)
              </>
            )}
            . Jami {result.total} ta mijoz.
          </div>
        )}
      </Card>

      <Card title="Eslatma">
        <div className="flex gap-3 text-sm" style={{ color: 'var(--muted)' }}>
          <Megaphone size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
          <p>
            Xabarni tez-tez yubormang — Telegram ko'p reklama xabarini spam deb hisoblaydi va
            foydalanuvchilar botni bloklashi mumkin. Haftasiga bir-ikki marta yetarli.
          </p>
        </div>
      </Card>
    </div>
  )
}
