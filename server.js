// Mints short-lived Deepgram tokens and serves the built pages, one per demo at /demos/<id>/.
// Audio never touches this server: the browser streams it straight to Deepgram with the token.
// A demo that needs routes of its own (a webhook, say) adds demos/<id>/server.js; see DEMO ROUTES.
import express from 'express'
import rateLimit from 'express-rate-limit'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
  // https://agent.deepgram.com is /v1/think, for the LLM demos (shared/llm/).
  "connect-src 'self' https://api.deepgram.com wss://api.deepgram.com wss://agent.deepgram.com https://agent.deepgram.com",
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

const demoBusy = (req, res) =>
  res.status(429).type('text/plain').send('This demo is busy right now. Wait a few minutes and try again.')

const envInt = (name, fallback) => {
  const n = Number(process.env[name])
  return Number.isInteger(n) && n > 0 ? n : fallback
}

// Every demo shares one key, so token minting is bounded two ways. Per address, across every demo:
// one visitor (or one script) cannot mint more by hopping between demos. Per demo, across every
// address: a spread-out run at one demo uses up that demo's budget and leaves the others working.
// The per-demo numbers can be raised with env vars if a demo gets a real traffic spike.
export const LIMITS = {
  address: { perMinute: 20, perHour: 120 },
  demo: {
    perMinute: envInt('DEMO_TOKENS_PER_MINUTE', 120),
    perHour: envInt('DEMO_TOKENS_PER_HOUR', 2000),
  },
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// The demos this build serves: every dist/demos/<id>/ with an index.html.
export function builtDemos(dist) {
  const dir = path.join(dist, 'demos')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && ID.test(d.name) && existsSync(path.join(dir, d.name, 'index.html')))
    .map((d) => d.name)
}

// A browser always sends Sec-Fetch-Site, and same-origin is the word that counts: the Vite dev proxy
// rewrites Host, so a POST's Origin would not match it locally. Without the header, fall back.
export const fromPage = (req) => {
  const site = req.get('sec-fetch-site')
  return site ? site === 'same-origin' : sameOrigin(req)
}

// The demos in the source tree: every demos/<id>/ with an index.tsx. In pnpm dev there is no build,
// so the server knows the demos from here. The image has no index.tsx files, only the build.
export function sourceDemos(root = process.cwd()) {
  const dir = path.join(root, 'demos')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && ID.test(d.name) && existsSync(path.join(dir, d.name, 'index.tsx')))
    .map((d) => d.name)
}

// DEMO ROUTES. demos/<id>/server.js may export a default function (router, kit) that adds routes.
// They are mounted at /demos/<id>/api/, only for that demo, behind the same headers. The kit:
//   rateLimit(opts)  express-rate-limit, keyed per address within this demo, 429 with a readable message
//   fromPage(req)    true for a request from this site's own pages
//   publicUrl(req)   the demo's public base, https://<host>/demos/<id> (PUBLIC_URL overrides the host)
//   express          for body parsers (express.json, express.raw)
// Errors thrown there reach the browser as a plain 500, never upstream text.
export async function loadDemoRoutes(ids, root = process.cwd()) {
  const routes = {}
  for (const id of ids) {
    const file = path.join(root, 'demos', id, 'server.js')
    if (existsSync(file)) routes[id] = (await import(pathToFileURL(file).href)).default
  }
  return routes
}

function demoKit(id) {
  return {
    express,
    fromPage,
    rateLimit: (opts) => rateLimit({ handler: tooMany, ...opts }),
    publicUrl: (req) => `${(process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/demos/${id}`,
  }
}

export function createApp({ dist = path.resolve('dist'), demos = builtDemos(dist), routes = {} } = {}) {
  const app = express()
  app.disable('x-powered-by')
  // Fly's proxy sits in front, so the rate limit keys on the forwarded client address.
  app.set('trust proxy', 1)
  const dg = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY })
  const known = new Set(demos)

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

  // GET /api/token?demo=<id>. The demo is checked first, so an unknown name never gets a bucket.
  const whichDemo = (req, res, next) => {
    const id = typeof req.query.demo === 'string' ? req.query.demo : ''
    if (!known.has(id)) return res.status(404).type('text/plain').send('No such demo. Reload the page and try again.')
    req.demo = id
    next()
  }
  app.use(
    '/api/token',
    whichDemo,
    rateLimit({ windowMs: 60_000, limit: LIMITS.address.perMinute, handler: tooMany }),
    rateLimit({ windowMs: 60 * 60_000, limit: LIMITS.address.perHour, handler: tooMany }),
    rateLimit({ windowMs: 60_000, limit: LIMITS.demo.perMinute, handler: demoBusy, keyGenerator: (req) => `demo:${req.demo}` }),
    rateLimit({ windowMs: 60 * 60_000, limit: LIMITS.demo.perHour, handler: demoBusy, keyGenerator: (req) => `demo:${req.demo}` }),
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

  for (const [id, add] of Object.entries(routes)) {
    if (!known.has(id) || typeof add !== 'function') continue
    const router = express.Router()
    add(router, demoKit(id))
    app.use(`/demos/${id}/api`, router)
    app.all(`/demos/${id}/api/{*splat}`, (_req, res) => res.status(404).type('text/plain').send('Not found'))
  }

  // Never echo upstream errors to the browser. Log them here.
  const apiError = (err, _req, res, _next) => {
    console.error('api request failed:', err?.message ?? err)
    res.status(500).type('text/plain').send('Could not start a session')
  }
  app.use('/api', apiError)
  app.use('/demos/:demo/api', apiError)

  // Only the Vite build is served. Dotfiles are refused, and anything else in the repo
  // (notes, samples, .env) is never under dist/. /demos/<id> redirects to /demos/<id>/.
  app.use(express.static(dist, { dotfiles: 'deny', index: 'index.html', redirect: true }))
  app.use((_req, res) => res.status(404).type('text/plain').send('Not found'))
  return app
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8081)
  if (!process.env.DEEPGRAM_API_KEY) console.warn('DEEPGRAM_API_KEY is not set; /api/token will fail')
  const dist = path.resolve('dist')
  const demos = [...new Set([...builtDemos(dist), ...sourceDemos()])]
  if (!demos.length) console.warn('no demos found in dist/demos/ or demos/')
  const routes = await loadDemoRoutes(demos)
  createApp({ dist, demos, routes }).listen(port, () =>
    console.log(`listening on http://localhost:${port}, ${demos.length} demos${Object.keys(routes).length ? `, routes for ${Object.keys(routes).join(', ')}` : ''}`),
  )
}
