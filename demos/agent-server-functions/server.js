// The function Deepgram calls for agent-server-functions. server.js mounts it at
// /demos/agent-server-functions/api/, so the deployed URL is STORE_HOURS_URL. Deepgram's servers call
// it, not the page, so there is no same-origin check and no secret: it returns made-up store hours.
// The page imports storeHours() too, for its "this page answers" mode, so both modes say the same.
// This file has no imports: the Dockerfile copies only demos/<id>/server.js into the image, and the
// browser bundle pulls storeHours() from it.

// Under the demo's base URL. The router below is already mounted at /demos/<id>/api.
export const STORE_HOURS_PATH = '/api/store-hours'
const ROUTE = '/store-hours'

// Demo data. Odd minutes on purpose: the agent can only say these if the function answered.
export const HOURS = {
  monday: '7:30 am to 6:15 pm',
  tuesday: '7:30 am to 6:15 pm',
  wednesday: '7:30 am to 6:15 pm',
  thursday: '7:30 am to 8:45 pm',
  friday: '7:30 am to 8:45 pm',
  saturday: '9:15 am to 4:30 pm',
  sunday: 'closed',
}

const DAYS = Object.keys(HOURS)

// One day when the arguments name one, otherwise the whole week.
export function storeHours(args) {
  const raw = typeof args?.day === 'string' ? args.day.trim().toLowerCase() : ''
  const day = DAYS.find((d) => raw.startsWith(d.slice(0, 3)))
  const base = { store: 'Acme Hardware, Main Street', note: 'demo data' }
  return day ? { ...base, day, hours: HOURS[day] } : { ...base, hours: HOURS }
}

// Deepgram's docs do not say what body it sends to a function endpoint, so read the day wherever it
// may be: the top level of a JSON body, an `arguments` field (an object or a JSON string), or the
// query string. Anything unreadable gets the whole week rather than an error.
export function argsOf(body, query = {}) {
  let parsed = {}
  if (typeof body === 'string' && body.trim()) {
    try {
      parsed = JSON.parse(body)
    } catch {
      parsed = {}
    }
  } else if (body && typeof body === 'object') parsed = body
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {}
  let inner = parsed.arguments
  if (typeof inner === 'string') {
    try {
      inner = JSON.parse(inner)
    } catch {
      inner = undefined
    }
  }
  const day = [parsed.day, inner?.day, query.day].find((d) => typeof d === 'string')
  return day ? { day } : {}
}

export default (router, kit) => {
  const { express, rateLimit } = kit
  // Every call comes from Deepgram's servers, so a handful of addresses carry every visitor's calls.
  const limits = [rateLimit({ windowMs: 60_000, limit: 120 }), rateLimit({ windowMs: 60 * 60_000, limit: 2000 })]
  const answer = (req, res) => {
    // The body Deepgram sends is undocumented: log its shape (fake arguments only) to learn it.
    if (process.env.NODE_ENV !== 'test') console.log(`store-hours ${req.method} ${req.get('content-type') ?? '-'} ${String(req.body ?? '').slice(0, 300)}`)
    res.set('cache-control', 'no-store').json(storeHours(argsOf(req.body, req.query)))
  }
  const tooLarge = (err, _req, res, next) => (err?.type === 'entity.too.large' ? res.status(413).type('text/plain').send('Too large') : next(err))
  router.post(ROUTE, ...limits, express.text({ type: () => true, limit: '4kb' }), answer, tooLarge)
  router.get(ROUTE, ...limits, answer)
}
