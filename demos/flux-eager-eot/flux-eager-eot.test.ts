import { describe, expect, it } from 'vitest'
import feature, { summarize } from '.'
import { describeRequest } from '../../shared/common/config'
import type { SttEvent } from '../../shared/common/feature'

const flux = feature.models[0]
const ctx = { model: flux, mode: feature.modes[0], busy: false }

const ev = (ms: number, event: string, transcript = '', turn_index = 0): SttEvent => ({
  ms,
  name: event,
  msg: { type: 'TurnInfo', event, turn_index, transcript },
})

describe('flux-eager-eot', () => {
  it('sends eot_threshold always, and eager_eot_threshold under it when on', () => {
    expect(describeRequest(flux, feature.params({ eager: 'off' }, ctx))).toBe('/v2/listen?model=flux-general-en&eot_threshold=0.7')
    expect(describeRequest(flux, feature.params({ eager: '0.4' }, ctx))).toBe(
      '/v2/listen?model=flux-general-en&eager_eot_threshold=0.4&eot_threshold=0.7',
    )
    for (const v of feature.variants ?? []) {
      const p = feature.params(v, ctx)
      if (typeof p.eager_eot_threshold === 'string') expect(Number(p.eager_eot_threshold)).toBeLessThanOrEqual(Number(p.eot_threshold))
    }
  })

  // The 0.4 run from the live check at the top of index.tsx.
  it('counts drafts, cancels, and the head start of the draft that held', () => {
    const [t] = summarize([
      ev(771, 'StartOfTurn', "I'd like"),
      ev(2131, 'EagerEndOfTurn', "I'd like to book."),
      ev(2731, 'TurnResumed'),
      ev(3371, 'EagerEndOfTurn', "I'd like to book."),
      ev(3930, 'TurnResumed'),
      ev(6130, 'EagerEndOfTurn', "I'd like to book, um, a table for two."),
      ev(6571, 'EndOfTurn', "I'd like to book, um, a table for two."),
    ])
    expect(t.drafts).toHaveLength(3)
    expect(t.drafts.filter((d) => d.resumed !== undefined)).toHaveLength(2)
    expect(t.headStart).toBe(441)
    expect(t.transcript).toBe("I'd like to book, um, a table for two.")
  })

  it('gives no head start with eager off, or when the last draft was cancelled', () => {
    expect(summarize([ev(700, 'StartOfTurn'), ev(6680, 'EndOfTurn', 'x')])[0].headStart).toBeUndefined()
    const [t] = summarize([ev(1, 'StartOfTurn'), ev(2, 'EagerEndOfTurn'), ev(3, 'TurnResumed')])
    expect(t.headStart).toBeUndefined()
    expect(t.end).toBeUndefined()
  })

  it('keeps turns apart by turn_index and skips Update-only turns', () => {
    const turns = summarize([ev(1, 'StartOfTurn', 'a', 0), ev(2, 'EndOfTurn', 'a', 0), { ms: 3, name: 'Update', msg: { type: 'TurnInfo', event: 'Update', turn_index: 1 } }])
    expect(turns.map((t) => t.index)).toEqual([0])
  })
})
