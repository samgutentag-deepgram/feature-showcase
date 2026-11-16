import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in for the SDK's token grant. `next` decides what the next call does.
const calls: unknown[] = []
let next: () => Promise<{ access_token: string }>
vi.mock('@deepgram/sdk', () => ({
  DeepgramClient: class {
    auth = {
      v1: {
        tokens: {
          grant: (args: unknown) => {
            calls.push(args)
            return next()
          },
        },
      },
    }
  },
}))

const { LIMITS, builtDemos, createApp: create } = await import('../server.js')

// A tiny build with two demo pages, so the server has real files and a real demo list.
const dist = mkdtempSync(path.join(tmpdir(), 'showcase-dist-'))
for (const id of ['keyterm', 'smart-format']) {
  mkdirSync(path.join(dist, 'demos', id), { recursive: true })
  writeFileSync(path.join(dist, 'demos', id, 'index.html'), `<!doctype html><title>${id}</title>`)
}
writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>list</title>')
const createApp = (opts: Parameters<typeof create>[0] = {}) => create({ dist, ...opts })
const TOKEN = '/api/token?demo=keyterm'

describe('GET /api/token?demo=<id>', () => {
  beforeEach(() => {
    calls.length = 0
    next = async () => ({ access_token: 'tok_123' })
  })

  it('returns a short-lived token as uncached plain text', async () => {
    const res = await request(createApp()).get(TOKEN)
    expect(res.status).toBe(200)
    expect(res.text).toBe('tok_123')
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(calls).toEqual([{ ttl_seconds: 30 }])
  })

  it('fails closed when Deepgram refuses the grant', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    next = () => Promise.reject(new Error('403 Insufficient permissions'))
    const res = await request(createApp()).get(TOKEN)
    expect(res.status).toBe(500)
    expect(res.text).toBe('Could not start a session')
    err.mockRestore()
  })

  it('rate limits the mint endpoint, with a message a visitor can read', async () => {
    const app = createApp()
    for (let i = 0; i < 20; i++) await request(app).get(TOKEN)
    const res = await request(app).get(TOKEN)
    expect(res.status).toBe(429)
    expect(res.text).toMatch(/try again/i)
  })

  it('serves this page, same-origin', async () => {
    const res = await request(createApp())
      .get(TOKEN)
      .set('host', 'demo.example')
      .set('origin', 'https://demo.example')
      .set('sec-fetch-site', 'same-origin')
    expect(res.status).toBe(200)
  })

  it('refuses a page on another site', async () => {
    const app = createApp()
    const cross = await request(app).get(TOKEN).set('sec-fetch-site', 'cross-site')
    expect(cross.status).toBe(403)
    const sibling = await request(app).get(TOKEN).set('sec-fetch-site', 'same-site')
    expect(sibling.status).toBe(403)
    const origin = await request(app).get(TOKEN).set('host', 'demo.example').set('origin', 'https://evil.example')
    expect(origin.status).toBe(403)
    const junk = await request(app).get(TOKEN).set('origin', 'null')
    expect(junk.status).toBe(403)
    expect(calls).toEqual([])
  })

  it('sends basic hardening headers', async () => {
    const res = await request(createApp()).get(TOKEN)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    const csp = res.headers['content-security-policy']
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain('wss://api.deepgram.com')
    expect(csp).not.toContain('unsafe-')
  })
})

describe('static files', () => {
  it('serves nothing from /api but the token', async () => {
    expect((await request(createApp()).get('/api/other')).status).toBe(404)
  })

  it('never serves files from outside the build', async () => {
    const app = createApp()
    for (const p of ['/.env', '/package.json', '/server.js', '/samples/es-ca-switch.mp3', '/.hub/ledger.md']) {
      const res = await request(app).get(p)
      expect(res.text).not.toMatch(/DEEPGRAM_API_KEY|"dependencies"|createApp/)
      expect(res.headers['content-type'] ?? '').not.toMatch(/audio|markdown|javascript/)
    }
  })
})

describe('one site, many demos', () => {
  beforeEach(() => {
    calls.length = 0
    next = async () => ({ access_token: 'tok_123' })
  })

  it('finds the demos in the build', () => {
    expect(builtDemos(dist).sort()).toEqual(['keyterm', 'smart-format'])
  })

  it('mints only for a demo this build serves', async () => {
    const app = createApp()
    expect((await request(app).get('/api/token')).status).toBe(404)
    expect((await request(app).get('/api/token?demo=nope')).status).toBe(404)
    expect((await request(app).get('/api/token?demo=../keyterm')).status).toBe(404)
    expect(calls).toEqual([])
    expect((await request(app).get('/api/token?demo=smart-format')).status).toBe(200)
  })

  it('caps each demo on its own, so a run at one leaves the others working', async () => {
    const saved = { ...LIMITS.demo }
    LIMITS.demo.perMinute = 5
    try {
      const app = createApp()
      // Five addresses, one token each: under every per-address limit, but the demo is spent.
      for (let i = 1; i <= 5; i++) {
        expect((await request(app).get(TOKEN).set('x-forwarded-for', `10.0.0.${i}`)).status).toBe(200)
      }
      const busy = await request(app).get(TOKEN).set('x-forwarded-for', '10.0.0.99')
      expect(busy.status).toBe(429)
      expect(busy.text).toMatch(/demo is busy/)
      expect((await request(app).get('/api/token?demo=smart-format').set('x-forwarded-for', '10.0.0.99')).status).toBe(200)
    } finally {
      Object.assign(LIMITS.demo, saved)
    }
  })

  it('counts one address across every demo, so hopping demos does not raise its limit', async () => {
    const app = createApp()
    for (let i = 0; i < 10; i++) await request(app).get(TOKEN)
    for (let i = 0; i < 10; i++) await request(app).get('/api/token?demo=smart-format')
    expect((await request(app).get('/api/token?demo=smart-format')).status).toBe(429)
  })

  it('serves each demo page at /demos/<id>/, and redirects the bare path', async () => {
    const app = createApp()
    const page = await request(app).get('/demos/keyterm/')
    expect(page.status).toBe(200)
    expect(page.text).toContain('<title>keyterm</title>')
    const bare = await request(app).get('/demos/keyterm')
    expect(bare.status).toBe(301)
    expect(bare.headers.location).toBe('/demos/keyterm/')
    expect((await request(app).get('/')).text).toContain('<title>list</title>')
    expect((await request(app).get('/demos/nope/')).status).toBe(404)
  })

  it('mounts a demo\'s own routes under /demos/<id>/api/, for that demo only', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = createApp({
      routes: {
        keyterm: (router: import('express').Router, kit: { publicUrl: (req: import('express').Request) => string }) => {
          router.get('/where', (req, res) => res.send(kit.publicUrl(req)))
          router.get('/boom', () => {
            throw new Error('upstream secret text')
          })
        },
        // Not in the build: never mounted.
        ghost: (router: import('express').Router) => router.get('/where', (_req, res) => res.send('ghost')),
      },
    })
    const where = await request(app).get('/demos/keyterm/api/where').set('host', 'demo.example')
    expect(where.text).toBe('http://demo.example/demos/keyterm')
    expect((await request(app).get('/demos/smart-format/api/where')).status).toBe(404)
    expect((await request(app).get('/demos/ghost/api/where')).status).toBe(404)
    expect((await request(app).get('/demos/keyterm/api/nothing')).status).toBe(404)
    const boom = await request(app).get('/demos/keyterm/api/boom')
    expect(boom.status).toBe(500)
    expect(boom.text).not.toMatch(/secret/)
    err.mockRestore()
  })
})
