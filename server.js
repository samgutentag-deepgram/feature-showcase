// Mints short-lived Deepgram tokens and serves the built page. Nothing else.
// Audio never touches this server: the browser streams it straight to Deepgram with the token.
import express from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DeepgramClient } from '@deepgram/sdk'

// 30 seconds is enough to open a socket. An open socket outlives its token.
export const TOKEN_TTL_SECONDS = 30

// The page talks to Deepgram's sockets and its own server, nothing else. blob: is for uploaded
// clips played back while they stream; data: images are inline SVG in CSS.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.deepgram.com wss://api.deepgram.com wss://agent.deepgram.com",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

// Only this page may ask for a token. A browser on another site sends its own Origin or a
// Sec-Fetch-Site other than same-origin; either one is refused. Clients that send neither (curl)
// are left to the rate limits, since a header check cannot stop them anyway.
export function sameOrigin(req) {
  const site = req.get('sec-fetch-site')
  if (site && site !== 'same-origin') return false
  const origin = req.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === req.get('host')
  } catch {
    return false
  }
}

const tooMany = (req, res) =>
  res.status(429).type('text/plain').send('Too many sessions from this address. Wait a minute and try again.')

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // Fly's proxy sits in front, so the rate limit keys on the forwarded client address.
  app.set('trust proxy', 1)
  const dg = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY })

  app.use((_req, res, next) => {
    res.set({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'DENY',
      // Mic only for this page, never for anything it might embed.
      'permissions-policy': 'microphone=(self), camera=(), geolocation=()',
      'content-security-policy': CSP,
    })
    next()
  })

  // A public demo exposes a mint endpoint. Bound it twice: a burst per minute and a ceiling per
  // hour, both per address.
  app.use(
    '/api/token',
    rateLimit({ windowMs: 60_000, limit: 20, handler: tooMany }),
    rateLimit({ windowMs: 60 * 60_000, limit: 120, handler: tooMany }),
  )
  app.get('/api/token', async (req, res, next) => {
    if (!sameOrigin(req)) {
      res.status(403).type('text/plain').send('Tokens are only issued to this page.')
      return
    }
    try {
      const { access_token } = await dg.auth.v1.tokens.grant({ ttl_seconds: TOKEN_TTL_SECONDS })
      res.type('text/plain').set('cache-control', 'no-store').send(access_token)
    } catch (err) {
      next(err)
    }
  })
  app.all('/api/{*splat}', (_req, res) => res.status(404).type('text/plain').send('Not found'))

  // Never echo upstream errors to the browser. Log them here.
  app.use('/api', (err, _req, res, _next) => {
    console.error('token grant failed:', err?.message ?? err)
    res.status(500).type('text/plain').send('Could not start a session')
  })

  // Only the Vite build is served. Dotfiles are refused, and anything else in the repo
  // (notes, samples, .env) is never under dist/.
  const dist = path.resolve('dist')
  app.use(express.static(dist, { dotfiles: 'deny', index: 'index.html' }))
  // root keeps send's dotfile check on the URL part only, so a checkout under a dot-directory
  // (a .claude/worktrees/ copy, say) still serves the page.
  app.get('/{*splat}', (_req, res) => res.sendFile('index.html', { root: dist }))
  return app
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8081)
  if (!process.env.DEEPGRAM_API_KEY) console.warn('DEEPGRAM_API_KEY is not set; /api/token will fail')
  createApp().listen(port, () => console.log(`listening on http://localhost:${port}`))
}
