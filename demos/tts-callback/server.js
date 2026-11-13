// The webhook receiver for tts-callback: Deepgram delivers the audio to a webhook, so this one demo
// needs a public receiver. server.js mounts these routes at /demos/tts-callback/api/, for this demo
// only. Every limit is here. A slot is made by the page (same-origin, rate limited), takes one
// delivery, lives 10 minutes, and is dropped once the page has read it. Unknown ids are refused.
import { randomUUID } from 'node:crypto'

export const CALLBACK = {
  ttlMs: 10 * 60_000,
  maxSlots: 20,
  maxAudioBytes: 2 * 1024 * 1024,
  maxChars: 400,
}

export default (router, kit) => {
  const { express, fromPage, rateLimit, publicUrl } = kit
  const slots = new Map()
  const sweep = () => {
    const now = Date.now()
    for (const [id, s] of slots) if (now - s.created > CALLBACK.ttlMs) slots.delete(id)
  }
  const live = (id) => {
    sweep()
    return slots.get(id)
  }

  // The page asks for a slot before it calls Deepgram, and gets back the URLs to pass along.
  router.post(
    '/callback',
    rateLimit({ windowMs: 60_000, limit: 10 }),
    rateLimit({ windowMs: 60 * 60_000, limit: 60 }),
    express.json({ limit: '4kb' }),
    (req, res) => {
      if (!fromPage(req)) return res.status(403).type('text/plain').send('Callbacks are only issued to this page.')
      const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, CALLBACK.maxChars) : ''
      if (!text) return res.status(400).type('text/plain').send('Type a line to speak first.')
      sweep()
      if (slots.size >= CALLBACK.maxSlots) return res.status(503).type('text/plain').send('Too many lines are waiting on a callback. Try again in a minute.')
      const id = randomUUID()
      slots.set(id, { text, created: Date.now() })
      const base = `${publicUrl(req)}/api/callback/${id}`
      res.set('cache-control', 'no-store').json({ id, callback: base, textUrl: `${base}/text` })
    },
  )

  // priority=low reads the text from a URL instead of the body. Deepgram fetches it from here.
  router.get('/callback/:id/text', (req, res) => {
    const s = live(req.params.id)
    if (!s) return res.status(404).type('text/plain').send('Not found')
    s.textFetched ??= Date.now()
    res.type('text/plain').set('cache-control', 'no-store').send(s.text)
  })

  // Deepgram's delivery: the audio as the body, POST or PUT. One per slot, size-capped.
  const receive = [
    express.raw({ type: () => true, limit: CALLBACK.maxAudioBytes }),
    (req, res) => {
      const s = live(req.params.id)
      if (!s) return res.status(404).type('text/plain').send('Not found')
      // Already have it: say ok so Deepgram does not retry, and keep the first delivery.
      if (s.audio) return res.status(200).end()
      const type = req.get('content-type') ?? ''
      if (!type.startsWith('audio/') || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(415).type('text/plain').send('Expected audio')
      Object.assign(s, { audio: req.body, type, method: req.method, received: Date.now() })
      res.status(200).end()
    },
    (err, _req, res, next) => (err?.type === 'entity.too.large' ? res.status(413).type('text/plain').send('Too large') : next(err)),
  ]
  router.post('/callback/:id', ...receive)
  router.put('/callback/:id', ...receive)

  // The page polls until the audio is in, then takes it once.
  router.get('/callback/:id', rateLimit({ windowMs: 60_000, limit: 240 }), (req, res) => {
    if (!fromPage(req)) return res.status(403).type('text/plain').send('Only this page can read its callbacks.')
    const s = live(req.params.id)
    if (!s) return res.status(404).type('text/plain').send('Nothing is waiting under that id. It may have expired.')
    res.set('cache-control', 'no-store')
    const textFetchedMs = s.textFetched ? s.textFetched - s.created : null
    if (!s.audio) return res.status(202).json({ waiting: true, textFetchedMs })
    slots.delete(req.params.id)
    res.set({
      'content-type': s.type,
      'x-callback-method': s.method,
      'x-callback-after-ms': String(s.received - s.created),
      ...(textFetchedMs !== null && { 'x-text-fetched-ms': String(textFetchedMs) }),
    })
    res.send(s.audio)
  })
}
