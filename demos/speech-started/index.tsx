// vad_events on Nova-3: a SpeechStarted message the moment speech begins, before any words.
// Checked live 2026-11-16 on /v1/listen streaming in real time, 2 s of silence then "Hey, wait,
// stop talking for a second." (macOS voice Samantha):
//   vad_events=true   SpeechStarted (timestamp 2.09) arrived 2.06 s in; the first Results with a
//                     word ("hey", start 1.84) arrived 2.58 s in, 0.52 s later
//   vad_events=false  no SpeechStarted; the same first Results at 2.59 s
//   Flux              /v2/listen answers vad_events with a 400 (INVALID_QUERY_PARAMETER). Its
//                     StartOfTurn came 2.97 s in, carrying the first words, so it is not earlier.
import { defineFeature, type Json, type Params, type SttEvent } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

interface State {
  on: boolean
}

const transcriptOf = (m?: Json) =>
  String((((m?.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]?.transcript as string | undefined) ?? '')

// The first SpeechStarted and the first Results with a word in it, as they arrived.
export function speechLead(events: readonly SttEvent[]): { started?: SttEvent; words?: SttEvent } {
  return {
    started: events.find((e) => e.name === 'SpeechStarted'),
    words: events.find((e) => e.name.startsWith('Results') && transcriptOf(e.msg).trim() !== ''),
  }
}

const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`

export default defineFeature<State>({
  copy: {
    headline: 'Know they started talking before the first word.',
    lede: 'Start the mic, stay quiet for two seconds, then read the phrase. With vad_events on, a SpeechStarted message arrives as soon as you make a sound, ahead of the first transcript. Run it off, then on, and compare the timelines.',
    ctaTitle: 'Add vad_events=true to your next stream.',
    ctaBody: (
      <>
        <code>vad_events</code> sends <code>SpeechStarted</code> on <code>/v1/listen</code> streaming
        the moment speech begins. Use it for barge-in: a voice agent can stop talking as soon as the
        caller starts, without waiting for words. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/speech-started' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support vad_events yet (/v2/listen answers it with a 400). Flux sends StartOfTurn instead, but it arrives with the first words, not ahead of them.',
    },
  ],
  // Live mic only. Runs stay side by side so the timelines can be compared.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  // Off first, so the second run is the one that gains SpeechStarted.
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],
  promptState: { on: true },

  // Sent either way, so the Request card always says which one ran.
  params: ({ on }): Params => ({ vad_events: String(on) }),
  highlight: ['vad_events'],

  // Every Results shows, empty ones included, so the silence before SpeechStarted is visible.
  timeline: { mark: ['SpeechStarted'], quiet: [] },

  runLabel: ({ on }) => `vad_events=${on}`,
  compareTip: ({ on }) =>
    on ? 'Turn vad_events off and run it again to compare.' : 'Turn vad_events on and run it again to compare.',

  phrases: () => ['Hey, wait, stop talking for a second.'],

  // The last SpeechStarted, verbatim.
  echo: (msg) => (msg.type === 'SpeechStarted' ? msg : undefined),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={state.on}
          disabled={ctx.busy}
          onChange={(e) => setState({ on: e.target.checked })}
        />
        Turn on vad_events
      </label>
    )
  },

  Response({ latest }) {
    const m = latest?.echoed as Json | undefined
    if (!m) {
      return (
        <span className="wire__key">
          {latest && !latest.state.on
            ? 'No SpeechStarted: vad_events was off for this run.'
            : 'The last SpeechStarted message shows up here after a run.'}
        </span>
      )
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"type":</span> <mark>"SpeechStarted"</mark>,{' '}
        <span className="wire__key">"channel":</span> {JSON.stringify(m.channel)},{' '}
        <span className="wire__key">"timestamp":</span> <mark>{String(m.timestamp)}</mark>
      </span>
    )
  },

  // How much sooner speech start was known than the first word, then the transcript. The timeline
  // under it has every message.
  Result({ run, live }) {
    const { started, words } = speechLead(run?.events ?? [])
    return (
      <>
        {run && (
          <p className="lead" aria-live="polite">
            {started ? (
              <>
                <span className="lead__mark">SpeechStarted</span> at {secs(started.ms)}
              </>
            ) : (
              <span className="lead__none">{run.state.on ? 'Waiting for SpeechStarted' : 'No SpeechStarted (vad_events off)'}</span>
            )}
            {words && <> · first words at {secs(words.ms)}</>}
            {started && words && words.ms > started.ms && (
              <strong className="lead__gap"> · {Math.round(words.ms - started.ms)} ms earlier</strong>
            )}
          </p>
        )}
        <PlainTranscript
          committed={run?.committed ?? []}
          pending={run?.pending ?? []}
          live={live}
          emptyText="Start the mic, wait two seconds, then speak. The timeline marks when speech started and when the first words came back."
        />
      </>
    )
  },
})
