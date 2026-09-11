import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vercel'dagi `api/*.ts` funksiyalarini mahalliy dev-serverga ulaydi.
 *
 * Ishlab chiqarishda bu fayllarni Vercel o'zi serverless funksiya qilib
 * ishga tushiradi, `vite dev` esa faqat statik fayllarni beradi — ya'ni
 * bu ko'prik bo'lmasa admin panelni mahalliy sinab ko'rib bo'lmaydi.
 *
 * Faqat `serve` rejimida ishlaydi va production build'ga tushmaydi.
 * Sirlar `.env.local` faylidan o'qiladi (u .gitignore'da).
 */
function localApi(): Plugin {
  return {
    name: 'uj-local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/')) return next()

        const route = url.split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '')
        const file = resolve(process.cwd(), 'api', `${route}.ts`)
        if (!route || route.includes('..') || !existsSync(file)) return next()

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          void (async () => {
            const raw = Buffer.concat(chunks).toString('utf8')

            // @vercel/node handler'i kutadigan shakl: req.body va
            // res.status().json() — Node'ning o'zida bular yo'q.
            const request = req as typeof req & { body?: unknown; query?: unknown }
            try {
              request.body = raw ? JSON.parse(raw) : {}
            } catch {
              request.body = {}
            }
            request.query = Object.fromEntries(new URL(url, 'http://localhost').searchParams)

            const response = res as typeof res & {
              status: (code: number) => typeof response
              json: (data: unknown) => void
            }
            response.status = (code: number) => {
              res.statusCode = code
              return response
            }
            response.json = (data: unknown) => {
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(data))
            }

            try {
              const module = await server.ssrLoadModule(file)
              await module.default(request, response)
            } catch (error) {
              server.config.logger.error(`[local-api] ${route}: ${String(error)}`)
              response.status(500).json({ error: String(error) })
            }
          })()
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Serverless funksiyalar process.env dan o'qiydi, Vite esa .env
  // fayllarini o'z ichiga yuklaydi — ikkalasini bog'lab qo'yamiz.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return { plugins: [react(), tailwindcss(), localApi()] }
})
