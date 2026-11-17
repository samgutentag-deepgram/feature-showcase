import { describe, expect, it } from 'vitest'
import feature, { collect, labelAt, type Found } from '.'
import { describeRequest } from '../../shared/common/config'

const model = feature.models[0]
const ctx = { model, mode: feature.modes[0], busy: false }

// Final results as Nova-3 sent them on the socket, 2026-11-16 (trimmed): entities at the top level.
const final = (id: string, transcript: string, entities: unknown[]) => ({
  type: 'Results',
  is_final: true,
  channel: { alternatives: [{ transcript }] },
  metadata: { request_id: id },
  entities,
})
const NAME = { label: 'NAME', value: 'Maria Lopez.', raw_value: 'Maria Lopez.', confidence: 0.954834, start_word: 2, end_word: 4 }
const PHONE = { label: 'PHONE_NUMBER', value: '(415) 555-0134.', raw_value: 'four one five five five five zero one three four.', confidence: 0.98475283, start_word: 5, end_word: 7 }

describe('detect-entities', () => {
  it('always sends detect_entities, and says which smart_format ran', () => {
    expect(describeRequest(model, feature.params({ smart: true }, ctx))).toBe('/v1/listen?model=nova-3&detect_entities=true&smart_format=true')
    expect(describeRequest(model, feature.params({ smart: false }, ctx))).toBe('/v1/listen?model=nova-3&detect_entities=true&smart_format=false')
  })

  it('collects the entities of every final in one session, and keeps sessions apart', () => {
    expect(collect({ type: 'Results', is_final: false, channel: { alternatives: [{ transcript: 'This is' }] } })).toBeUndefined()
    collect(final('a', 'This is Maria Lopez.', [NAME]))
    const a = collect(final('a', 'You can call me at (415) 555-0134.', [PHONE])) as Found
    expect(a.segments.flatMap((s) => s.entities).map((e) => e.label)).toEqual(['NAME', 'PHONE_NUMBER'])
    const b = collect(final('b', 'Hi.', [])) as Found
    expect(b.segments).toHaveLength(1)
  })

  it('maps start_word and end_word (exclusive) onto the transcript words', () => {
    const seg = (collect(final('c', 'You can call me at (415) 555-0134.', [PHONE])) as Found).segments[0]
    expect(seg.words.filter((_, i) => labelAt(seg, i)).join(' ')).toBe('(415) 555-0134.')
  })
})
