import { describe, expect, it } from 'vitest'
import feature, { PARAGRAPH, paragraphs } from '.'
import { describeRequest } from '../../shared/common/config'

const nova = feature.models.find((m) => m.id === 'nova-3')!
const ctx = (model = nova) => ({ model, mode: feature.modes[0], busy: false })

describe('dictation', () => {
  it('offers Nova-3 only, since Flux does not support it', () => {
    expect(feature.models.map((m) => m.id)).toEqual(['nova-3'])
  })

  it('sends dictation with punctuate on Nova-3, the forms verified live', () => {
    expect(describeRequest(nova, feature.params({ on: true }, ctx()))).toBe('/v1/listen?model=nova-3&punctuate=true&dictation=true')
    expect(describeRequest(nova, feature.params({ on: false }, ctx()))).toBe('/v1/listen?model=nova-3&punctuate=true&dictation=false')
  })


  it('breaks paragraphs at the token Deepgram sends for "new paragraph"', () => {
    const w = (text: string) => ({ text, lang: '' })
    const rows = paragraphs([w('live.'), w(PARAGRAPH), w('Does'), w('it?')])
    expect(rows.map((p) => p.map((x) => x.text).join(' '))).toEqual(['live.', 'Does it?'])
    expect(PARAGRAPH).toBe('<\\n\\n>')
  })
})
