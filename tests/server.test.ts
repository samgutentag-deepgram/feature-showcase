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

const { createApp } = await import('../server.js')

describe('GET /api/token', () => {
  beforeEach(() => {
    calls.length = 0
    next = async () => ({ access_token: 'tok_123' })
  })

  it('returns a short-lived token as uncached plain text', async () => {
    const res = await request(createApp()).get('/api/token')
    expect(res.status).toBe(200)
    expect(res.text).toBe('tok_123')
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(calls).toEqual([{ ttl_seconds: 30 }])
  })

  it('fails closed when Deepgram refuses the grant', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    next = () => Promise.reject(new Error('403 Insufficient permissions'))
    const res = await request(createApp()).get('/api/token')
    expect(res.status).toBe(500)
    expect(res.text).toBe('Could not start a session')
    err.mockRestore()
  })

  it('rate limits the mint endpoint, with a message a visitor can read', async () => {
    const app = createApp()
    for (let i = 0; i < 20; i++) await request(app).get('/api/token')
    const res = await request(app).get('/api/token')
    expect(res.status).toBe(429)
    expect(res.text).toMatch(/try again/i)
  })

  it('serves this page, same-origin', async () => {
    const res = await request(createApp())
      .get('/api/token')
      .set('host', 'demo.example')
      .set('origin', 'https://demo.example')
      .set('sec-fetch-site', 'same-origin')
    expect(res.status).toBe(200)
  })

  it('refuses a page on another site', async () => {
    const app = createApp()
    const cross = await request(app).get('/api/token').set('sec-fetch-site', 'cross-site')
    expect(cross.status).toBe(403)
    const sibling = await request(app).get('/api/token').set('sec-fetch-site', 'same-site')
    expect(sibling.status).toBe(403)
    const origin = await request(app).get('/api/token').set('host', 'demo.example').set('origin', 'https://evil.example')
    expect(origin.status).toBe(403)
    const junk = await request(app).get('/api/token').set('origin', 'null')
    expect(junk.status).toBe(403)
    expect(calls).toEqual([])
  })

  it('sends basic hardening headers', async () => {
    const res = await request(createApp()).get('/api/token')
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
