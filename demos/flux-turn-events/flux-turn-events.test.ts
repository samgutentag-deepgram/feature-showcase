import { describe, expect, it } from 'vitest'
import feature, { rows, turnState } from '.'
import { describeRequest } from '../../shared/common/config'
import type { SttEvent } from '../../shared/common/feature'

const flux = feature.models[0]
const ctx = { model: flux, mode: feature.modes[0], busy: false }

const ev = (ms: number, event: string, turn_index: number, transcript = '', extra = {}): SttEvent => ({
  ms,
  name: event,
  msg: { type: 'TurnInfo', event, turn_index, transcript, end_of_turn_confidence: 0.1, ...extra },
})

describe('flux-turn-events', () => {
  it('sends the default eot_threshold and no eager_eot_threshold', () => {
    expect(describeRequest(flux, feature.params(feature.initialState, ctx))).toBe('/v2/listen?model=flux-general-en&eot_threshold=0.7')
  })

  it('follows the state machine; Update never changes the state', () => {
    expect(turnState([])).toBe('Initial')
    expect(turnState([ev(0, 'Update', 0), ev(1, 'StartOfTurn', 0, 'My name'), ev(2, 'Update', 0)])).toBe('TurnOngoing')
    expect(turnState([ev(1, 'StartOfTurn', 0), ev(2, 'EagerEndOfTurn', 0)])).toBe('AwaitingEnd')
    expect(turnState([ev(1, 'StartOfTurn', 0), ev(2, 'EndOfTurn', 0), ev(3, 'Update', 1)])).toBe('Initial')
  })

  it('folds a run of Updates in one turn into one row, and keeps turn_index', () => {
    const r = rows([
      ev(100, 'Update', 0),
      ev(200, 'StartOfTurn', 0, 'My name'),
      ev(300, 'Update', 0, 'My name is'),
      ev(400, 'Update', 0, 'My name is Sam.'),
      ev(500, 'EndOfTurn', 0, 'My name is Sam.', { trigger: 'model' }),
      ev(600, 'Update', 1),
    ])
    expect(r.map((x) => [x.name, x.count, x.turnIndex])).toEqual([
      ['Update', 1, 0],
      ['StartOfTurn', 1, 0],
      ['Update', 2, 0],
      ['EndOfTurn', 1, 0],
      ['Update', 1, 1],
    ])
    expect(r[2]).toMatchObject({ ms: 300, transcript: 'My name is Sam.' })
    expect(r[3].trigger).toBe('model')
  })

  it('shows the last state change on the Response card, not Updates', () => {
    expect(feature.echo?.({ type: 'TurnInfo', event: 'Update', turn_index: 0 }, flux)).toBeUndefined()
    expect(feature.echo?.({ type: 'TurnInfo', event: 'EndOfTurn', turn_index: 1, transcript: 'Hi.', trigger: 'model' }, flux)).toEqual({
      event: 'EndOfTurn',
      turn_index: 1,
      transcript: 'Hi.',
      trigger: 'model',
    })
  })
})
