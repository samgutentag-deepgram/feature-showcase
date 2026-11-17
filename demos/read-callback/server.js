// The webhook receiver for read-callback, mounted at /demos/read-callback/api/ for this demo only.
// Deepgram answers the page's POST /v1/read with a request_id and later delivers the analysis here.
// The routes follow the protocol in shared/llm/callback.ts.
//
// Authentication, as https://developers.deepgram.com/docs/text-intelligence-callback recommends:
// each slot gets its own random password, and the callback URL handed to Deepgram carries it as
// Basic Auth, https://deepgram:<password>@<host>/demos/read-callback/api/callback/<id>. Deepgram
// sends the credentials back with the delivery, and this receiver checks them.
//   - right credentials: 200, the result is kept for the page
//   - wrong credentials: 401, nothing kept (Deepgram retries, then gives up)
//   - no Authorization header: kept, but the receipt says the check failed. Until a real delivery
//     has been seen to carry the header, a missing one is reported rather than refused, so the page
//     still shows what arrived. A production receiver should refuse it.
// Every delivery leaves a receipt under its request_id (check result, method, header names, never
// header values) that the page reads once the result is in.
//
// Slots are made by the page (same-origin, rate limited), take one delivery, live 10 minutes, and are
// dropped once the page has read them. Unknown ids are refused.
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

export const CALLBACK = {
  ttlMs: 10 * 60_000,
  maxSlots: 20,
  maxBodyBytes: 256 * 1024,
  user: 'deepgram',
}

// Deepgram cannot reach these (400 "Invalid callback URL."). Without credentials in the URL, the
// shared page sees a local slot and explains it instead of sending a request that will fail.
const LOCAL = /^https?:\/\/(localhost|127\.|\[::1\]|0\.0\.0\.0|[^/]*\.localhost)/

// Splits "Basic base64(user:pass)". Null when the header is missing or not Basic.
export function basicCredentials(header) {
  const m = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header ?? '')
  if (!m) return null
  const text = Buffer.from(m[1], 'base64').toString('utf8')
  const at = text.indexOf(':')
  return at < 0 ? null : { user: text.slice(0, at), pass: text.slice(at + 1) }
}

const same = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

// 'passed', 'wrong', or 'missing'.
export function checkAuth(header, pass) {
  const got = basicCredentials(header)
  if (!got) return header ? 'wrong' : 'missing'
  return got.user === CALLBACK.user && same(got.pass, pass) ? 'passed' : 'wrong'
}

export default (router, kit) => {
  const { express, fromPage, rateLimit, publicUrl } = kit
  const slots = new Map()
  const receipts = new Map()
  const sweep = () => {
    const now = Date.now()
    for (const [id, s] of slots) if (now - s.created > CALLBACK.ttlMs) slots.delete(id)
    for (const [id, r] of receipts) if (now - r.at > CALLBACK.ttlMs) receipts.delete(id)
  }
  const live = (id) => {
    sweep()
    return slots.get(id)
  }

  // The page asks for a slot before it calls Deepgram, and gets back the URL to pass as `callback`.
  router.post('/callback', rateLimit({ windowMs: 60_000, limit: 10 }), rateLimit({ windowMs: 60 * 60_000, limit: 60 }), (req, res) => {
    if (!fromPage(req)) return res.status(403).type('text/plain').send('Callbacks are only issued to this page.')
    sweep()
    if (slots.size >= CALLBACK.maxSlots) return res.status(503).type('text/plain').send('Too many runs are waiting on a callback. Try again in a minute.')
    const id = randomUUID()
    const pass = randomBytes(18).toString('hex')
    slots.set(id, { pass, created: Date.now() })
    const base = publicUrl(req)
    const callback = LOCAL.test(base) ? `${base}/api/callback/${id}` : `${base.replace('://', `://${CALLBACK.user}:${pass}@`)}/api/callback/${id}`
    res.set('cache-control', 'no-store').json({ id, callback })
  })

  // Deepgram's delivery: the analysis as JSON, POST (default) or PUT (callback_method=put).
  const receive = [
    express.raw({ type: () => true, limit: CALLBACK.maxBodyBytes }),
    (req, res) => {
      const s = live(req.params.id)
      if (!s) return res.status(404).type('text/plain').send('Not found')
      // Already have it: say ok so Deepgram does not retry, and keep the first delivery.
      if (s.json) return res.status(200).end()
      const auth = checkAuth(req.get('authorization'), s.pass)
      if (auth === 'wrong') return res.status(401).set('www-authenticate', 'Basic realm="callback"').type('text/plain').send('Unauthorized')
      let json
      try {
        json = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '')
      } catch {
        return res.status(400).type('text/plain').send('Expected JSON')
      }
      if (!json || typeof json !== 'object') return res.status(400).type('text/plain').send('Expected JSON')
      Object.assign(s, { json, method: req.method, received: Date.now() })
      const requestId = String(json.metadata?.request_id ?? json.request_id ?? '')
      if (requestId) {
        receipts.set(requestId, {
          at: Date.now(),
          auth,
          method: req.method,
          contentType: req.get('content-type') ?? '',
          userAgent: req.get('user-agent') ?? '',
          headers: Object.keys(req.headers).sort(),
        })
      }
      res.status(200).end()
    },
    (err, _req, res, next) => (err?.type === 'entity.too.large' ? res.status(413).type('text/plain').send('Too large') : next(err)),
  ]
  router.post('/callback/:id', ...receive)
  router.put('/callback/:id', ...receive)

  // The page polls until the result is in, then takes it once: {body, method, afterMs}.
  router.get('/callback/:id', rateLimit({ windowMs: 60_000, limit: 240 }), (req, res) => {
    if (!fromPage(req)) return res.status(403).type('text/plain').send('Only this page can read its callbacks.')
    const s = live(req.params.id)
    if (!s) return res.status(404).type('text/plain').send('Nothing is waiting under that id. It may have expired.')
    res.set('cache-control', 'no-store')
    if (!s.json) return res.status(202).json({ waiting: true })
    slots.delete(req.params.id)
    res.json({ body: s.json, method: s.method, afterMs: s.received - s.created })
  })

  // What the receiver saw on the delivery for one request_id: the Basic Auth check and header names.
  router.get('/receipt/:requestId', rateLimit({ windowMs: 60_000, limit: 60 }), (req, res) => {
    if (!fromPage(req)) return res.status(403).type('text/plain').send('Only this page can read its receipts.')
    sweep()
    const r = receipts.get(req.params.requestId)
    if (!r) return res.status(404).type('text/plain').send('No delivery under that request_id.')
    res.set('cache-control', 'no-store').json(r)
  })
}
