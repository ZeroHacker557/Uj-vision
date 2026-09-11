import { useState } from 'react'
import { LogIn } from 'lucide-react'
import mark from '../../images/uj-mark.webp'
import { BRAND } from '../../config/brand'
import { adminPost, AdminApiError } from '../api'
import { Button, Field, Input } from '../ui'

/**
 * Panelga kirish.
 *
 * Parol serverda scrypt hash bilan solishtiriladi, javobda esa faqat
 * HttpOnly cookie qaytadi — bu yerda hech qanday token saqlanmaydi.
 * Ketma-ket besh marta noto'g'ri urinishdan keyin server hisobni
 * chorak soatga bloklaydi.
 */
export function LoginPage({ onSuccess }: { onSuccess: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return

    setError('')
    setLoading(true)
    try {
      const result = await adminPost<{ username: string }>('login', { username, password })
      onSuccess(result.username)
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : 'Kirish amalga oshmadi')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="a-login">
      <form className="a-login__panel" onSubmit={submit}>
        <img className="a-login__mark" src={mark} alt="" />
        <h1 className="a-login__title">{BRAND.name}</h1>
        <p className="a-login__sub">Admin panelga kirish</p>

        <Field label="Login">
          <Input value={username} onChange={setUsername} placeholder="admin" autoFocus />
        </Field>

        <Field label="Parol">
          <Input value={password} onChange={setPassword} type="password" placeholder="••••••••" />
        </Field>

        {error && <p className="a-login__error">{error}</p>}

        <div className="mt-5">
          <Button type="submit" full loading={loading}>
            <LogIn size={16} />
            Kirish
          </Button>
        </div>
      </form>
    </div>
  )
}
