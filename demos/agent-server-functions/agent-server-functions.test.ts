import { readFileSync } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../server.js'
import feature, { callsOf, ENDPOINT, STORE_HOURS_URL } from './index.tsx'
import routes, { argsOf, HOURS, storeHours } from './server.js'

const ID = 'agent-server-functions'
const URL_PATH = `/demos/${ID}/api/store-hours`
const app = () => createApp({ dist: path.resolve('no-dist'), demos: [ID], routes: { [ID]: routes } })

describe('store-hours route (what Deepgram calls)', () => {
  it('answers a POST from anywhere: Deepgram is not the page', async () => {
    const r = await request(app()).post(URL_PATH).set('sec-fetch-site', 'cross-site').set('content-type', 'application/json').send('{"day":"saturday"}')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ day: 'saturday', hours: HOURS.saturday, note: 'demo data' })
  })

  it('reads the day from an arguments field, as an object or a JSON string', async () => {
    const a = app()
    const obj = await request(a).post(URL_PATH).set('content-type', 'application/json').send({ name: 'get_store_hours', arguments: { day: 'Sunday' } })
    expect(obj.body).toMatchObject({ day: 'sunday', hours: 'closed' })
    const str = await request(a).post(URL_PATH).set('content-type', 'application/json').send({ arguments: '{"day":"thu"}' })
    expect(str.body).toMatchObject({ day: 'thursday' })
    const get = await request(a).get(`${URL_PATH}?day=friday`)
    expect(get.body).toMatchObject({ day: 'friday' })
  })

  it('gives the whole week for a body it cannot read, never an error', async () => {
    const a = app()
    for (const body of ['not json', '[1,2]', '{"day":"someday"}', '']) {
      const r = await request(a).post(URL_PATH).set('content-type', 'text/plain').send(body)
      expect(r.status, body).toBe(200)
      expect(r.body.hours).toEqual(HOURS)
    }
  })

  it('refuses oversized bodies and is mounted for this demo only', async () => {
    const a = app()
    expect((await request(a).post(URL_PATH).set('content-type', 'application/json').send(JSON.stringify({ day: 'x'.repeat(5000) }))).status).toBe(413)
    expect((await request(a).post('/api/store-hours').send({})).status).toBe(404)
    expect((await request(createApp({ dist: path.resolve('no-dist'), demos: [ID] })).post(URL_PATH).send({})).status).toBe(404)
  })

  it('parses arguments the same way on the page and the server', () => {
    expect(argsOf('{"day":"saturday"}')).toEqual({ day: 'saturday' })
    expect(argsOf(undefined, { day: 'monday' })).toEqual({ day: 'monday' })
    expect(storeHours({ day: 'SAT' })).toEqual(feature.onFunctionCall!('get_store_hours', { day: 'saturday' }, { where: 'page' }))
  })
})

describe('Settings', () => {
  it('points the endpoint at the public URL in meta.json, over https, with no headers', () => {
    const meta = JSON.parse(readFileSync(path.join('demos', ID, 'meta.json'), 'utf8'))
    expect(STORE_HOURS_URL).toBe(`${meta.url.replace(/\/$/, '')}/api/store-hours`)
    expect(STORE_HOURS_URL.startsWith('https://')).toBe(true)
    expect(ENDPOINT.headers).toEqual({})
  })

  it('adds the endpoint only in server mode', () => {
    const fn = (where: 'server' | 'page') => (feature.agent({ where }) as { think: { functions: Array<{ endpoint?: unknown }> } }).think.functions[0]
    expect(fn('server').endpoint).toEqual(ENDPOINT)
    expect(fn('page').endpoint).toBeUndefined()
  })
})

describe('callsOf', () => {
  const msg = (ms: number, m: Record<string, unknown>) => ({ ms, msg: m })
  it('marks a server-side call failed on FUNCTION_CALL_FAILED, without the body', () => {
    const calls = callsOf([
      msg(1000, { type: 'FunctionCallRequest', functions: [{ name: 'get_store_hours', arguments: '{"day":"saturday"}', client_side: false }] }),
      msg(4000, { type: 'Warning', code: 'FUNCTION_CALL_FAILED', description: 'Failed to call function get_store_hours. HTTP error code: 404 Not Found. Body: Not found' }),
    ])
    expect(calls).toEqual([{ ms: 1000, name: 'get_store_hours', args: '{"day":"saturday"}', clientSide: false, failed: 'Failed to call function get_store_hours. HTTP error code: 404 Not Found.' }])
  })
  it('marks a call answered at the next assistant line', () => {
    const calls = callsOf([
      msg(1000, { type: 'FunctionCallRequest', functions: [{ name: 'get_store_hours', arguments: '{}', client_side: true }] }),
      msg(1800, { type: 'ConversationText', role: 'assistant', content: 'We open at 9:15.' }),
    ])
    expect(calls[0]).toMatchObject({ clientSide: true, answered: 1800 })
  })
})
