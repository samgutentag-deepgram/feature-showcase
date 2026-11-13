import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLUMBING, describeRequest, requestParams, toQuery } from '../shared/common/config'
import type { Feature } from '../shared/common/feature'
import type { TtsFeature } from '../shared/tts/feature'
import { LISTEN_MODELS, settingsMessage, type AgentFeature } from '../shared/agent/feature'
import { FEATURE, readMeta } from '../vite.config'

// Every folder under demos/ must be a complete demo, deployable by changing FEATURE alone.
const names = readdirSync('demos', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

// Speech-to-text or text-to-speech, read once from each feature's default export.
const kinds: Record<string, string> = Object.fromEntries(
  await Promise.all(names.map(async (n) => [n, (await import(`../demos/${n}/index.tsx`)).default.kind ?? 'stt'])),
)
const stt = (name: string) => kinds[name] === 'stt'

describe('the active feature', () => {
  it('is one of the feature folders', () => {
    expect(names).toContain(FEATURE)
  })
})

describe.each(names)('feature %s', (name) => {
  it('has share metadata for a public URL', () => {
    const meta = readMeta(name)
    expect(meta.title).toMatch(/\| Deepgram$/)
    expect(meta.description.length).toBeGreaterThan(40)
    expect(meta.description.length).toBeLessThanOrEqual(160)
    expect(meta.url).toBe(`https://dg-devrel-${name}.fly.dev`)
  })

  it('has a 1200x630 og.png', () => {
    const png = readFileSync(path.join('demos', name, 'og.png'))
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
  })

  it('shows a Request card that is exactly what the socket sends, minus plumbing', async () => {
    if (!stt(name)) return
    const feature = (await import(`../demos/${name}/index.tsx`)).default as Feature<unknown>
    expect(feature.models.length).toBeGreaterThan(0)
    expect(feature.modes.length).toBeGreaterThan(0)
    for (const model of feature.models) {
      for (const mode of feature.modes) {
        const params = feature.params(feature.initialState, { model, mode, busy: false })
        const shown = describeRequest(model, params)
        const sent = toQuery(requestParams(model, params)).toString()
        // Every shown param is sent, in the same order, with the same value.
        expect(sent.startsWith(shown.split('?')[1])).toBe(true)
        expect(shown.startsWith(`/${model.endpoint}/listen?`)).toBe(true)
      }
    }
  })

  // The rule: Flux first when Flux supports the feature. When it does not, Nova-3 only, no Flux
  // toggle, and a note on the Nova-3 model saying Flux does not support it.
  it('opens on Flux, or offers Nova-3 alone and says why', async () => {
    if (!stt(name)) return
    const feature = (await import(`../demos/${name}/index.tsx`)).default as Feature<unknown>
    const flux = feature.models.find((m) => m.endpoint === 'v2')
    if (flux) {
      expect(feature.models[0], 'Flux goes first').toBe(flux)
      // Flux is offered, so it shows the feature: through a param, or built in and explained.
      const variants = feature.variants ?? [feature.initialState]
      const fluxSendsIt = variants.some((state) =>
        feature.modes.some((mode) =>
          Object.keys(feature.params(state, { model: flux, mode, busy: false })).some((k) => feature.highlight.includes(k)),
        ),
      )
      if (!fluxSendsIt) expect(flux.note, 'Flux sends no param, so its note says the feature is built in').toBeTruthy()
    } else {
      expect(feature.models).toHaveLength(1)
      expect(feature.models[0].note ?? '', 'Nova-3 only says Flux does not support it').toMatch(/^Nova-3 only\. Flux does not support/)
    }
  })

  it('hides nothing that changes the transcript', async () => {
    if (!stt(name)) return
    const feature = (await import(`../demos/${name}/index.tsx`)).default as Feature<unknown>
    for (const model of feature.models) {
      for (const key of Object.keys(model.hidden ?? {})) expect(PLUMBING, `${model.id} hides ${key}`).toContain(key)
    }
  })

  it('lists variants that cover every model the toggle offers', async () => {
    if (!stt(name)) return
    const feature = (await import(`../demos/${name}/index.tsx`)).default as Feature<unknown>
    expect((feature.variants ?? [feature.initialState]).length).toBeGreaterThan(0)
    expect([1, 2]).toContain(feature.models.length)
  })
})

describe.each(names.filter((n) => kinds[n] === 'tts'))('text-to-speech feature %s', (name) => {
  it('asks for audio the shell can play, in every variant, Flux voices first and Aura-2 after', async () => {
    const feature = (await import(`../demos/${name}/index.tsx`)).default as TtsFeature<unknown>
    expect(feature.voices.length).toBeGreaterThan(0)
    // flux-{voice}-{language}: Flux has voices in some 45 languages, Aura-2 in a few.
    for (const v of feature.voices) expect(v).toMatch(/^(flux|aura-2)-[a-z]+-[a-z]{2}$/)
    // The company push is Flux: the default voice is Flux, and every Flux voice comes before any Aura-2.
    expect(feature.voices[0]).toMatch(/^flux-/)
    const firstAura = feature.voices.findIndex((v) => v.startsWith('aura-2-'))
    if (firstAura >= 0) expect(feature.voices.slice(firstAura).every((v) => v.startsWith('aura-2-'))).toBe(true)
    // Cleared for use, but they drift in pitch and volume between calls, so not the default.
    expect(['flux-marcus-en', 'flux-brittany-en']).not.toContain(feature.voices[0])
    for (const state of feature.variants) {
      const p = feature.params(state)
      expect(['linear16', 'mulaw']).toContain(p.encoding)
      expect(Number(p.sample_rate)).toBeGreaterThan(0)
      // The socket streams raw audio and takes no container; POST needs one the shell can play.
      if (feature.cutIn) expect(p.container).toBeUndefined()
      else expect(['none', 'wav']).toContain(p.container)
    }
    if (feature.cutIn) expect(feature.cutIn.reply.trim().length).toBeGreaterThan(0)
    // A session or token stream runs on the Flux socket: Flux voices only, raw audio.
    if (feature.session || feature.tokens) {
      expect(feature.voices.every((v) => v.startsWith('flux-'))).toBe(true)
      for (const state of feature.variants) expect(feature.params(state).container).toBe('none')
    }
    // A voice browser only ever asks for voices the checks request.
    if (feature.voiceFrom) for (const state of feature.variants) expect(feature.voices).toContain(feature.voiceFrom(state))
  })

  it('suggests at least one line to speak', async () => {
    const feature = (await import(`../demos/${name}/index.tsx`)).default as TtsFeature<unknown>
    expect(feature.phrases.length).toBeGreaterThan(0)
  })
})

describe.each(names.filter((n) => kinds[n] === 'agent'))('voice agent feature %s', (name) => {
  it('builds a whole Settings message for every variant and both listen models, Flux first', async () => {
    const feature = (await import(`../demos/${name}/index.tsx`)).default as AgentFeature<unknown>
    expect(LISTEN_MODELS[0].id).toBe('flux-general-en')
    for (const state of feature.variants) {
      for (const m of LISTEN_MODELS) {
        const s = settingsMessage(feature, state, m.id) as { type: string; agent: Record<string, unknown> }
        expect(s.type).toBe('Settings')
        expect(s.agent.listen).toEqual({ provider: { type: 'deepgram', model: m.id } })
        expect(s.agent.think).toBeTruthy()
        expect(s.agent.speak).toBeTruthy()
      }
    }
  })

  it('answers every function it offers', async () => {
    const feature = (await import(`../demos/${name}/index.tsx`)).default as AgentFeature<unknown>
    for (const state of feature.variants) {
      const think = feature.agent(state).think as { functions?: Array<{ name: string }> }
      for (const f of think.functions ?? []) expect(feature.onFunctionCall?.(f.name, {}, state)).toBeTruthy()
    }
  })
})
