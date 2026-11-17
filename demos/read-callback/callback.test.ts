import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { unreachable } from '../../shared/llm/callback'
import { basicCredentials, checkAuth } from './server.js'

vi.mock('@deepgram/sdk', () => ({ DeepgramClient: class {} }))

const { createApp } = await import('../../server.js')
const routes = (await import('./server.js')).default
const ID = 'read-callback'
const BASE = `/demos/${ID}/api/callback`
const dist = mkdtempSync(path.join(tmpdir(), 'read-callback-dist-'))
const app = () => createApp({ dist, demos: [ID], routes: { [ID]: routes } })

// The shape /v1/read answers with when no callback is set (checked 2026-11-16). The delivery is
// expected to match it; that is not yet seen from a real delivery.
const delivery = (requestId: string, text = 'A customer asks for help with a failed export.') => ({
  metadata: { request_id: requestId, language: 'en' },
  results: { summary: { text } },
})

// Splits the slot URL into the path the receiver serves and the credentials Deepgram would send.
function parse(callback: string) {
  const u = new URL(callback)
  return { path: u.pathname, basic: u.username ? `Basic ${Buffer.from(`${u.username}:${u.password}`).toString('base64')}` : '' }
}

afterEach(() => {
  delete process.env.PUBLIC_URL
})

describe('read-callback webhook (demos/read-callback/server.js)', () => {
  it('puts a one-time Basic Auth password in a public callback URL, none in a local one', async () => {
    const a = app()
    const local = (await request(a).post(BASE)).body
    expect(local.callback).not.toMatch(/@/)
    // The shared page stops before sending when the slot is local.
    expect(unreachable(local.callback)).toBe(true)
    process.env.PUBLIC_URL = 'https://demos.example.com'
    const one = (await request(a).post(BASE)).body
    const two = (await request(a).post(BASE)).body
    expect(one.callback).toMatch(new RegExp(`^https://deepgram:[0-9a-f]{36}@demos\\.example\\.com/demos/${ID}/api/callback/${one.id}$`))
    expect(new URL(one.callback).password).not.toBe(new URL(two.callback).password)
    expect(unreachable(one.callback)).toBe(false)
  })

  it('takes a delivery with the right password, hands it to the page once as {body, method, afterMs}', async () => {
    process.env.PUBLIC_URL = 'https://demos.example.com'
    const a = app()
    const s = (await request(a).post(BASE)).body
    const { path: p, basic } = parse(s.callback)
    expect((await request(a).get(p)).status).toBe(202)
    expect((await request(a).put(p).set('authorization', basic).send(delivery('req-1'))).status).toBe(200)
    // A second delivery is acknowledged and ignored.
    expect((await request(a).post(p).set('authorization', basic).send(delivery('req-1', 'other'))).status).toBe(200)
    const got = await request(a).get(p)
    expect(got.status).toBe(200)
    expect(got.body.method).toBe('PUT')
    expect(got.body.afterMs).toBeGreaterThanOrEqual(0)
    expect(got.body.body.results.summary.text).toBe('A customer asks for help with a failed export.')
    expect((await request(a).get(p)).status).toBe(404)
    const r = (await request(a).get(`/demos/${ID}/api/receipt/req-1`)).body
    expect(r).toMatchObject({ auth: 'passed', method: 'PUT' })
    expect(r.headers).toContain('authorization')
    expect(JSON.stringify(r)).not.toContain(basic.slice(6))
  })

  it('refuses wrong credentials with a 401 and keeps nothing', async () => {
    process.env.PUBLIC_URL = 'https://demos.example.com'
    const a = app()
    const { path: p } = parse((await request(a).post(BASE)).body.callback)
    const forged = `Basic ${Buffer.from('deepgram:guess').toString('base64')}`
    const res = await request(a).post(p).set('authorization', forged).send(delivery('req-2'))
    expect(res.status).toBe(401)
    expect(res.headers['www-authenticate']).toMatch(/^Basic/)
    expect((await request(a).get(p)).status).toBe(202)
    expect((await request(a).get(`/demos/${ID}/api/receipt/req-2`)).status).toBe(404)
  })

  it('keeps a delivery with no credentials but marks the check failed', async () => {
    process.env.PUBLIC_URL = 'https://demos.example.com'
    const a = app()
    const { path: p } = parse((await request(a).post(BASE)).body.callback)
    expect((await request(a).post(p).send(delivery('req-3'))).status).toBe(200)
    expect((await request(a).get(`/demos/${ID}/api/receipt/req-3`)).body.auth).toBe('missing')
  })

  it('refuses unknown ids, non-JSON, other pages, and other demos', async () => {
    const a = app()
    expect((await request(a).post(`${BASE}/not-a-slot`).send(delivery('x'))).status).toBe(404)
    const s = (await request(a).post(BASE)).body
    expect((await request(a).post(`${BASE}/${s.id}`).set('content-type', 'text/plain').send('hi')).status).toBe(400)
    expect((await request(a).post(BASE).set('sec-fetch-site', 'cross-site')).status).toBe(403)
    expect((await request(a).get(`${BASE}/${s.id}`).set('sec-fetch-site', 'cross-site')).status).toBe(403)
    expect((await request(a).get(`/demos/${ID}/api/receipt/x`).set('sec-fetch-site', 'cross-site')).status).toBe(403)
    expect((await request(a).post('/demos/keyterm/api/callback')).status).toBe(404)
  })

  it('reads Basic credentials and compares them', () => {
    expect(basicCredentials(`Basic ${Buffer.from('deepgram:a:b').toString('base64')}`)).toEqual({ user: 'deepgram', pass: 'a:b' })
    expect(basicCredentials('Bearer abc')).toBeNull()
    expect(checkAuth(undefined, 'p')).toBe('missing')
    expect(checkAuth('Bearer abc', 'p')).toBe('wrong')
    expect(checkAuth(`Basic ${Buffer.from('deepgram:p').toString('base64')}`, 'p')).toBe('passed')
    expect(checkAuth(`Basic ${Buffer.from('someone:p').toString('base64')}`, 'p')).toBe('wrong')
  })
})
