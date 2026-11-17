// The chat grouping, fed the message order a live Flux barge-in probe produced on 2026-11-16.
import { describe, expect, it } from 'vitest'
import { buildTranscript } from './index'

const ct = (ms: number, role: string, content: string, extra = {}) => ({ ms, msg: { type: 'ConversationText', role, content, conversational_behavior: 'default', ...extra } })
const ev = (ms: number, type: string) => ({ ms, msg: { type } })

const BARGE = [
  ev(350, 'SettingsApplied'),
  ct(510, 'assistant', 'Hi there. Ask me about any city.'),
  ev(2260, 'AgentAudioDone'),
  ev(5770, 'UserStartedSpeaking'),
  ct(8850, 'user', 'Tell me about the history of the city of Paris.', { words: [] }),
  ev(8850, 'EndOfTurn'),
  ct(9070, 'assistant', 'Paris, known as the City of Light, has a rich and vibrant history that dates back over 2,000 years.'),
  ev(11490, 'UserStartedSpeaking'),
  ev(11490, 'AgentAudioDone'),
  ev(12480, 'UserStartedSpeaking'),
  ev(13690, 'UserStartedSpeaking'),
  ct(13960, 'user', 'Stop. What is two plus two?', { words: [] }),
  ct(14440, 'assistant', 'Two plus two equals four.'),
  ev(15570, 'AgentAudioDone'),
]
const STARTS = [510, 9030, 14440]

describe('buildTranscript', () => {
  it('marks the reply the user talked over before AgentAudioDone', () => {
    const t = buildTranscript(BARGE, STARTS)
    expect(t.map((e) => e.role)).toEqual(['assistant', 'user', 'assistant', 'user', 'assistant'])
    const cut = t[2]
    expect(cut.cutAt).toBe(11490)
    expect(cut.cutAfterDone).toBe(false)
    expect(cut.audioAt).toBe(9030)
    expect(t[0].cutAt).toBeUndefined()
    expect(t[4].cutAt).toBeUndefined()
    expect(t[4].doneAt).toBe(15570)
  })

  it('times user lines from the first UserStartedSpeaking of the turn and lists extra fields', () => {
    const t = buildTranscript(BARGE, STARTS)
    expect(t[1].heardAt).toBe(5770)
    expect(t[3].heardAt).toBe(11490)
    expect(t[3].extra).toEqual(['words'])
  })

  it('joins the sentences of one reply into one entry', () => {
    const t = buildTranscript(
      [ct(8100, 'assistant', 'The capital of France is Paris.'), ct(10110, 'assistant', 'It is known for the Eiffel Tower.'), ev(15900, 'AgentAudioDone'), ev(15950, 'UserStartedSpeaking')],
      [8100],
    )
    expect(t).toHaveLength(1)
    expect(t[0].pieces.map((p) => p.ms)).toEqual([8100, 10110])
    expect(t[0].cutAt).toBeUndefined()
  })

  it('marks a reply cut on the page after AgentAudioDone when its audio was still playing', () => {
    const msgs = [ct(8100, 'assistant', 'One.'), ev(15900, 'AgentAudioDone'), ev(15950, 'UserStartedSpeaking')]
    const t = buildTranscript(msgs, [8100], new Set([2]))
    expect(t[0].cutAt).toBe(15950)
    expect(t[0].cutAfterDone).toBe(true)
  })
})
