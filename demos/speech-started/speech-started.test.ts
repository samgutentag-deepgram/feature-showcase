import { describe, expect, it } from 'vitest'
import { speechLead } from './index'

const results = (ms: number, transcript: string) => ({
  ms,
  name: 'Results interim',
  msg: { type: 'Results', channel: { alternatives: [{ transcript }] } },
})

describe('speechLead', () => {
  it('finds the first SpeechStarted and the first Results with words, skipping empty ones', () => {
    const events = [results(950, ''), { ms: 2060, name: 'SpeechStarted', detail: 'timestamp 2.09' }, results(2580, 'hey'), { ms: 2670, name: 'SpeechStarted' }]
    const { started, words } = speechLead(events)
    expect(started?.ms).toBe(2060)
    expect(words?.ms).toBe(2580)
  })

  it('has no SpeechStarted when vad_events is off', () => {
    expect(speechLead([results(2590, 'hey')]).started).toBeUndefined()
  })
})
