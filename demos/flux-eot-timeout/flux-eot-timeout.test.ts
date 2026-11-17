import { describe, expect, it } from 'vitest'
import feature, { endings, silence } from '.'
import { describeRequest } from '../../shared/common/config'
import type { SttEvent } from '../../shared/common/feature'

const flux = feature.models[0]
const ctx = { model: flux, mode: feature.modes[0], busy: false }

describe('flux-eot-timeout', () => {
  it('sends eot_threshold and eot_timeout_ms on every run', () => {
    expect(describeRequest(flux, feature.params({ timeout: '1000', eot: '1.0' }, ctx))).toBe(
      '/v2/listen?model=flux-general-en&eot_threshold=1.0&eot_timeout_ms=1000',
    )
    for (const v of feature.variants ?? []) {
      const ms = Number(feature.params(v, ctx).eot_timeout_ms)
      expect(ms).toBeGreaterThanOrEqual(500)
      expect(ms).toBeLessThanOrEqual(60000)
    }
  })

  // The eot_timeout_ms=3000, eot_threshold=1.0 run from the live check at the top of index.tsx.
  it('reads the trigger and the silence before EndOfTurn', () => {
    const msg = {
      type: 'TurnInfo',
      event: 'EndOfTurn',
      turn_index: 0,
      transcript: 'So I was thinking that maybe we could.',
      words: [{ word: 'could.', start: 1.68, end: 2 }],
      audio_window_end: 5.28,
      end_of_turn_confidence: 0.994,
      trigger: 'timeout',
    }
    const events: SttEvent[] = [
      { ms: 771, name: 'StartOfTurn', msg: { type: 'TurnInfo', event: 'StartOfTurn', turn_index: 0 } },
      { ms: 5649, name: 'EndOfTurn', msg },
    ]
    const [t] = endings(events)
    expect(t.trigger).toBe('timeout')
    expect(t.silence).toBeCloseTo(3.28, 2)
    expect(t.transcript).toBe('So I was thinking that maybe we could.')
  })

  it('has no silence before any word is heard', () => {
    expect(silence({ type: 'TurnInfo', event: 'Update', words: [], audio_window_end: 0.24 })).toBeUndefined()
  })
})
