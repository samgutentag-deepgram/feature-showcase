import { describe, expect, it } from 'vitest'
import feature, { DEFAULT_HINTS, MODELS, activeHints, languagesFor } from '.'
import { FLUX_LANGUAGES, NOVA3_LANGUAGES } from './languages'
import { colorOrder, groupByLanguage } from './segments'
import { describeRequest, requestParams } from '../../shared/common/config'
import type { Mode, Model } from '../../shared/common/feature'

const nova = MODELS.find((m) => m.id === 'nova-3') as Model
const flux = MODELS.find((m) => m.id === 'flux') as Model
const mode = (id: string) => feature.modes.find((m) => m.id === id) as Mode
const ctx = (model: Model, modeId: string) => ({ model, mode: mode(modeId), busy: false })
const state = (hints: [string, string], uploadHints = false) => ({ hints, uploadHints })
// The params the page builds for a model, mode, and pair of hints.
const params = (model: Model, modeId: string, hints: [string, string] = DEFAULT_HINTS, uploadHints = false) =>
  feature.params(state(hints, uploadHints), ctx(model, modeId))

describe('groupByLanguage', () => {
  it('starts a new row each time the language changes', () => {
    const rows = groupByLanguage([
      { text: 'bon', lang: 'ca' },
      { text: 'dia,', lang: 'ca' },
      { text: '¿qué', lang: 'es' },
      { text: 'tal?', lang: 'es' },
      { text: 'molt', lang: 'ca' },
    ])
    expect(rows.map((r) => [r.lang, r.words.length])).toEqual([['ca', 2], ['es', 2], ['ca', 1]])
  })

  it('keeps untagged words with the row before them', () => {
    const rows = groupByLanguage([{ text: 'hola', lang: 'es' }, { text: 'amigo', lang: '' }])
    expect(rows).toHaveLength(1)
    expect(rows[0].words[1].lang).toBe('es')
  })
})

describe('colorOrder', () => {
  it('uses the hints first when there are some', () => {
    expect(colorOrder(['es', 'ca'], [{ text: 'hi', lang: 'en' }])).toEqual(['es', 'ca', 'en'])
  })

  it('falls back to the order languages are heard in auto-detect', () => {
    const words = [{ text: 'hola', lang: 'es' }, { text: 'hi', lang: 'en-US' }, { text: 'hola', lang: 'es' }]
    expect(colorOrder([], words)).toEqual(['es', 'en'])
  })
})

describe('echo', () => {
  const results = {
    type: 'Results',
    is_final: true,
    channel: {
      alternatives: [{
        transcript: 'bon dia hola',
        languages: ['ca', 'es'],
        languages_hinted: ['es', 'ca'],
        words: [
          { word: 'bon', punctuated_word: 'Bon', language: 'ca' },
          { word: 'dia', punctuated_word: 'dia,', language: 'ca' },
          { word: 'hola', language: 'es' },
        ],
      }],
    },
  }

  it('pulls the echoed hints from Nova-3 and Flux messages', () => {
    expect(feature.echo?.(results, nova)).toEqual(['es', 'ca'])
    expect(feature.echo?.({ type: 'TurnInfo', languages_hinted: ['en'] }, flux)).toEqual(['en'])
    expect(feature.echo?.({ type: 'Metadata' }, nova)).toBeUndefined()
  })
})

describe('language hint requests', () => {
  it('only offers hints each model accepts', () => {
    for (const m of MODELS) for (const h of DEFAULT_HINTS) expect(languagesFor(m)).toContain(h)
    for (const l of FLUX_LANGUAGES) expect(NOVA3_LANGUAGES).toContain(l)
  })

  it('sends no language_hint at all in auto-detect, or on Upload with hints off', () => {
    expect(describeRequest(nova, params(nova, 'auto'))).toBe('/v1/listen?model=nova-3&language=multi&smart_format=true')
    expect(describeRequest(flux, params(flux, 'auto'))).toBe('/v2/listen?model=flux-general-multi')
    expect(requestParams(nova, params(nova, 'upload'))).not.toHaveProperty('language_hint')
    expect(params(nova, 'upload', DEFAULT_HINTS, true)).toEqual({ language_hint: ['en', 'es'] })
  })

  it('sends the plumbing the card leaves out', () => {
    expect(requestParams(flux, params(flux, 'hint'))).toMatchObject({ encoding: 'linear16', sample_rate: '16000' })
    expect(requestParams(flux, params(flux, 'hint'))).not.toHaveProperty('interim_results')
    expect(requestParams(nova, params(nova, 'hint'))).toMatchObject({
      interim_results: 'true',
      smart_format: 'true',
      language_hint: ['en', 'es'],
    })
  })

  it('opens on Flux, and defaults both models to English and Spanish, as repeated params', () => {
    expect(feature.models[0].id).toBe('flux')
    expect(feature.initialState.hints).toEqual(['en', 'es'])
    expect(describeRequest(nova, params(nova, 'hint'))).toBe(
      '/v1/listen?model=nova-3&language=multi&smart_format=true&language_hint=en&language_hint=es',
    )
  })

  it('drops a hint Flux would reject when the model flips', () => {
    expect(feature.onModelChange?.(state(['es', 'ca']), flux).hints).toEqual(DEFAULT_HINTS)
    expect(feature.onModelChange?.(state(['fr', 'de']), flux).hints).toEqual(['fr', 'de'])
  })

  it('labels runs the way the page always has', () => {
    expect(feature.runLabel(state(DEFAULT_HINTS), ctx(nova, 'hint'))).toBe('hints en + es')
    expect(feature.runLabel(state(DEFAULT_HINTS), ctx(nova, 'auto'))).toBe('no hints')
    expect(feature.actionLabel?.(state(DEFAULT_HINTS, true), ctx(nova, 'upload'))).toBe('Run with en + es')
    expect(activeHints(state(DEFAULT_HINTS), 'upload')).toEqual([])
  })
})
