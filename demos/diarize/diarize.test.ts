import { describe, expect, it } from 'vitest'
import feature, { SCRIPT, groupBySpeaker } from '.'
import { describeRequest } from '../../shared/common/config'

const model = feature.models.find((m) => m.id === 'nova-3')!
const ctx = { model, mode: feature.modes[0], busy: false }

describe('diarize', () => {
  it('sends diarize_model=latest when on and leaves it out when off, the forms verified live', () => {
    expect(describeRequest(model, feature.params({ on: true }, ctx))).toBe('/v1/listen?model=nova-3&smart_format=true&diarize_model=latest')
    expect(describeRequest(model, feature.params({ on: false }, ctx))).toBe('/v1/listen?model=nova-3&smart_format=true')
  })

  it('starts a new row each time the speaker changes', () => {
    const rows = groupBySpeaker([
      { text: 'Thanks', lang: '', speaker: 0 },
      { text: 'Dana.', lang: '', speaker: 0 },
      { text: 'Hi', lang: '', speaker: 1 },
      { text: 'there', lang: '' },
      { text: 'Sorry', lang: '', speaker: 0 },
    ])
    expect(rows.map((r) => [r.speaker, r.words.length])).toEqual([[0, 2], [1, 2], [0, 1]])
  })

  it('pulls word and speaker from the last final result', () => {
    const msg = {
      type: 'Results',
      is_final: true,
      channel: { alternatives: [{ words: [{ word: 'hi', punctuated_word: 'Hi,', speaker: 1 }, { word: 'dana', speaker: 1 }] }] },
    }
    expect(feature.echo?.(msg, model)).toEqual([{ word: 'Hi,', speaker: 1 }, { word: 'dana', speaker: 1 }])
    expect(feature.echo?.({ ...msg, is_final: false }, model)).toBeUndefined()
  })

  it('suggests a two-person script that alternates speakers', () => {
    const lines = feature.phrases?.({ on: true }, ctx) ?? []
    expect(lines).toEqual(SCRIPT)
    expect(lines.map((l) => l.split(':')[0])).toEqual(['Person 1', 'Person 2', 'Person 1', 'Person 2', 'Person 1'])
  })
})
