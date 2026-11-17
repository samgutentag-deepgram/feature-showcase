import { describe, expect, it } from 'vitest'
import feature, { FORMATS, ORDER } from '.'
import { describeRequest, requestParams } from '../../shared/common/config'

const ctxFor = (id: string) => ({ model: feature.models.find((m) => m.id === id)!, mode: feature.modes[0], busy: false })

describe('raw-audio-format', () => {
  it('declares the format it streams, except for the mismatch', () => {
    for (const format of ORDER) {
      const ctx = ctxFor('flux')
      const p = feature.params({ format }, ctx)
      const sent = feature.audio!({ format }, ctx)
      const declared = { encoding: p.encoding, sample_rate: Number(p.sample_rate) }
      if (format === 'mismatch') expect(declared).not.toEqual(sent)
      else expect(declared).toEqual(sent)
    }
  })

  it('shows the encoding and rate on the card, sent exactly as shown', () => {
    const ctx = ctxFor('flux')
    expect(describeRequest(ctx.model, feature.params({ format: 'mulaw-8k' }, ctx))).toBe(
      '/v2/listen?model=flux-general-en&encoding=mulaw&sample_rate=8000',
    )
    const nova = ctxFor('nova-3')
    expect(requestParams(nova.model, feature.params({ format: 'alaw-8k' }, nova))).toMatchObject({ encoding: 'alaw', sample_rate: '8000' })
  })

  it('mismatch streams linear16 at 16 kHz and declares mulaw at 8 kHz', () => {
    expect(FORMATS.mismatch.sent).toEqual({ encoding: 'linear16', sample_rate: 16000 })
    expect(FORMATS.mismatch.declared).toEqual({ encoding: 'mulaw', sample_rate: 8000 })
  })

  it('covers every format in its variants', () => {
    expect(feature.variants?.map((v) => v.format)).toEqual(ORDER)
  })
})
