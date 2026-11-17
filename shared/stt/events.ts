// Names for the server messages of a speech-to-text session, so a feature can mark them in the
// timeline and an action can say which one answers it. Checked live 2026-11-16:
//   Nova-3 (/v1/listen): Results, SpeechStarted (vad_events), UtteranceEnd (utterance_end_ms),
//     Metadata (after CloseStream, or a 1011 timeout), ConfigureSuccess, ConfigureFailure, Error.
//   Flux (/v2/listen): Connected, TurnInfo (StartOfTurn, Update, EagerEndOfTurn, TurnResumed,
//     EndOfTurn), ConfigureSuccess, ConfigureFailure, Error. No Metadata on close.
import type { Json } from '../common/feature'

// A TurnInfo is named by its event ("EndOfTurn"). A Results message is "Results" plus what kind:
// "Results interim", "Results is_final", "Results speech_final", or "Results from_finalize" (the
// answer to Finalize). Anything else is its type.
export function eventName(m: Json): string {
  if (m.type === 'TurnInfo') return String(m.event ?? 'TurnInfo')
  if (m.type === 'Results') {
    if (m.from_finalize === true) return 'Results from_finalize'
    if (m.speech_final === true) return 'Results speech_final'
    return m.is_final === true ? 'Results is_final' : 'Results interim'
  }
  return String(m.type ?? 'unknown')
}

// "Results" matches every kind of Results; "Results from_finalize" matches only that one.
export const matches = (name: string, wanted: readonly string[]) => wanted.some((w) => name === w || name.startsWith(`${w} `))

// Too chatty for the timeline unless a feature asks for them.
export const DEFAULT_QUIET = ['Results interim', 'Update']

const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// One line of detail for the timeline.
export function eventDetail(m: Json): string | undefined {
  const alt = ((m.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
  switch (m.type) {
    case 'TurnInfo':
      return short(`${m.transcript ? `"${m.transcript}" ` : ''}end_of_turn_confidence ${Number(m.end_of_turn_confidence ?? 0).toFixed(2)}`)
    case 'Results':
      return alt?.transcript ? short(`"${alt.transcript}"`) : undefined
    case 'SpeechStarted':
      return `timestamp ${m.timestamp}`
    case 'UtteranceEnd':
      return `last_word_end ${m.last_word_end}`
    case 'Metadata': {
      const { duration, channels, extra, tags } = m
      return short(JSON.stringify({ duration, channels, ...(extra ? { extra } : {}), ...(tags ? { tags } : {}) }))
    }
    default: {
      const { type: _type, request_id: _id, sequence_id: _seq, ...rest } = m
      return Object.keys(rest).length ? short(JSON.stringify(rest)) : undefined
    }
  }
}
