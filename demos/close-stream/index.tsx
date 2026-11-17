// CloseStream: end a stream by asking Deepgram to finish, or just drop the socket, and compare what
// comes back. Checked live 2026-11-16 (macOS voice, "Please ship the blue order to the warehouse in
// Portland on Tuesday morning", 3.5 s, streamed in real time, then the end with no silence after):
//   Nova-3 /v1/listen, {"type":"CloseStream"}: Results is_final + speech_final with the whole line
//     (no final had come before it) 47 ms later, then Metadata (request_id, duration 3.547), then
//     close 1000. Cut at 2.6 s: final "please ship the blue order to the warehouse in portland",
//     Metadata duration 2.6, close 1000.
//   Nova-3, client close() instead: nothing more arrives, close 1000. Every word was interim only.
//     Waiting 5 s with no audio before the close (what this page does) brings nothing either.
//   Flux /v2/listen, CloseStream: one more Update with the tail ("...Tuesday morning."), then close
//     1005 (no status code). No EndOfTurn, no Metadata, as the Flux docs say. The extra Update only
//     comes when audio is still undecoded: in verify:live's run it did not.
//   Flux, ForceEndTurn then CloseStream: EndOfTurn with the whole line 68 ms after ForceEndTurn,
//     then close 1005. Flux, client close(): no further Update, close 1000.
// Hang up is an action with no message: the shared page stops the mic and closes the socket itself
// 5 s later, without CloseStream. Checked live that nothing arrives in those 5 s on either model.
// Verified live 2026-11-16: ONLY=close-stream pnpm verify:live passed. /v2/listen?model=flux-general-en and /v1/listen?model=nova-3 opened; ForceEndTurn came back EndOfTurn on Flux; CloseStream came back Metadata then a clean close on Nova-3, and closed cleanly with no Error on Flux (the run before, which waited for an Update after it, got none, so that Update is not guaranteed); prompt.md URLs accepted.
import { defineFeature, type Json, type SttAction, type SttEvent, type Word } from '../../shared/common/feature'
import { EmptyTranscript, PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

type State = Record<string, never>

export const CLOSE: Json = { type: 'CloseStream' }
export const FORCE: Json = { type: 'ForceEndTurn' }
const HANG_UP = 'Hang up (close socket)'

export type How = 'close' | 'hangup' | 'stop'

export interface Summary {
  how: How
  // When the button was pressed, ms into the run.
  at?: number
  // Server messages that arrived after the press.
  after: SttEvent[]
  // Words that came back final (Nova is_final Results, Flux EndOfTurn), and the rest: words that
  // were only ever interim (Nova) or sat in an open turn (Flux) when the socket closed.
  kept: Word[]
  rest: Word[]
  metadata?: Json
}

const wordsIn = (m: Json, v2: boolean): number => {
  if (v2) return m.type === 'TurnInfo' && m.event === 'EndOfTurn' ? String(m.transcript ?? '').split(/\s+/).filter(Boolean).length : 0
  if (m.type !== 'Results' || m.is_final !== true) return 0
  const alt = ((m.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
  return ((alt?.words as Json[] | undefined) ?? []).length
}

// How a finished run ended and what that cost, from its timeline and its words.
export function summarize(events: readonly SttEvent[], committed: readonly Word[], v2: boolean): Summary {
  const press = events.find((e) => e.sent && (e.name === 'CloseStream' || e.name === 'audio paused'))
  const how: How = !press ? 'stop' : press.name === 'CloseStream' ? 'close' : 'hangup'
  const server = events.filter((e) => !e.sent)
  const keptCount = server.reduce((n, e) => n + wordsIn(e.msg ?? {}, v2), 0)
  return {
    how,
    at: press?.ms,
    after: press ? server.filter((e) => e.ms >= press.ms) : [],
    kept: committed.slice(0, keptCount),
    rest: committed.slice(keptCount),
    metadata: server.find((e) => e.name === 'Metadata')?.msg,
  }
}

const seconds = (ms?: number) => (ms === undefined ? '' : `${(ms / 1000).toFixed(1)} s`)

export default defineFeature<State>({
  copy: {
    headline: 'Say goodbye, or just hang up?',
    lede: 'Read the line, and while you are still saying the last words, press CloseStream or Hang up. CloseStream asks Deepgram to finish what it has before it closes. Hang up drops the socket, and whatever was still in flight never comes back. Do it once each way and compare.',
    ctaTitle: 'Send CloseStream before you close the socket.',
    ctaBody: (
      <>
        <code>{'{"type":"CloseStream"}'}</code> on <code>/v1/listen</code> flushes the last words as a final
        result, then sends <code>Metadata</code> with the <code>request_id</code> and <code>duration</code>, then
        closes with 1000. On Flux, send <code>ForceEndTurn</code> first so the last turn ends. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/close-stream' },
  models: [
    {
      id: 'flux',
      label: 'Flux',
      endpoint: 'v2',
      params: { model: 'flux-general-en' },
      note: 'On Flux, CloseStream decodes the audio already sent (an Update, if any was left) and closes with no status code. It does not end the turn and sends no Metadata, so press ForceEndTurn first, then CloseStream.',
    },
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'On Nova-3, CloseStream flushes: the last words come back final, then Metadata, then a 1000 close.',
    },
  ],
  // Live mic only. Runs stay side by side so the same line can end both ways.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: {},
  variants: [{}],

  // CloseStream is a message, not a param: the query is just the model.
  params: () => ({}),
  highlight: [],

  runLabel: () => 'ended with a button',
  compareTip: () => 'Read the line again and end it the other way, to compare.',

  actions: (_state, { model }): SttAction[] => [
    ...(model.endpoint === 'v2' ? [{ label: 'ForceEndTurn', message: FORCE, ack: ['EndOfTurn'] }] : []),
    // Flux sends no Metadata, and its last Update only comes when audio is still undecoded (not
    // always, live), so its CloseStream has no ack: verify:live checks for a clean close instead.
    { label: 'CloseStream', message: CLOSE, ...(model.endpoint === 'v1' ? { ack: ['Metadata'] } : {}), ends: true, primary: true },
    { label: HANG_UP, audio: 'pause', ends: true },
  ],
  // Updates stay in, so Flux's last Update after CloseStream shows. Nova interims stay out.
  timeline: { mark: ['CloseStream', 'audio paused', 'ForceEndTurn', 'EndOfTurn', 'Metadata', 'Results speech_final'], quiet: ['Results interim'] },

  phrases: (_state, { model }) => [
    'Please ship the blue order to the warehouse in Portland on Tuesday morning.',
    model.endpoint === 'v2'
      ? '(press CloseStream or Hang up while you say "Tuesday morning", or ForceEndTurn and then CloseStream)'
      : '(press CloseStream or Hang up while you say "Tuesday morning", before you pause)',
  ],

  // With a timeline, echo sees every message. Only the Metadata summary goes on the Response card.
  echo: (msg) => (msg.type === 'Metadata' ? msg : undefined),

  Controls({ ctx }) {
    return (
      <p className="note">
        {ctx.model.endpoint === 'v2'
          ? 'Use the buttons under the mic, not Stop: Stop sends ForceEndTurn and CloseStream for you.'
          : 'Use the buttons under the mic, not Stop: Stop sends CloseStream for you.'}
      </p>
    )
  },

  Response({ latest, ctx }) {
    const m = latest?.echoed as Json | undefined
    if (!latest) return <span className="wire__key">The Metadata summary shows up here after CloseStream.</span>
    if (!m) {
      const live = ctx.busy
      return (
        <span className="wire__key">
          {live
            ? 'Waiting for the run to end…'
            : latest.model.endpoint === 'v2'
              ? 'No Metadata: Flux does not send one, whichever way the stream ends.'
              : 'No Metadata: the socket closed without one.'}
        </span>
      )
    }
    return (
      <span className="wire__part wire__part--text cs-echo">
        <mark>"type": "Metadata"</mark>, <span className="wire__key">"request_id":</span> <mark>{JSON.stringify(m.request_id)}</mark>,{' '}
        <span className="wire__key">"duration":</span> <mark>{JSON.stringify(m.duration)}</mark>,{' '}
        <span className="wire__key">"channels":</span> {JSON.stringify(m.channels)}
      </span>
    )
  },

  Result({ run, live }) {
    if (!run) return <EmptyTranscript live={live} text="Read the line, then end it with CloseStream or Hang up." />
    if (live || run.events.length === 0) {
      return <PlainTranscript committed={run.committed} pending={run.pending} live={live} emptyText="Listening…" />
    }
    const v2 = run.model.endpoint === 'v2'
    const s = summarize(run.events, run.committed, v2)
    const arrived = s.after.map((e) => e.name)
    const verdict =
      s.how === 'close'
        ? `CloseStream sent at ${seconds(s.at)}.`
        : s.how === 'hangup'
          ? `Hung up at ${seconds(s.at)}: the mic stopped and the page closed the socket without CloseStream.`
          : 'Stopped with the mic button, which ends the stream for you.'
    return (
      <div className="transcript cs-result" aria-live="polite">
        <div className={`cs-verdict is-${s.how}`}>
          <span className="cs-verdict__tag">{s.how === 'close' ? 'CloseStream' : s.how === 'hangup' ? 'Hang up' : 'Stop'}</span>
          <p className="cs-verdict__text">{verdict}</p>
          {s.how !== 'stop' && (
            <span className="cs-verdict__meta">
              After the press: {arrived.length ? [...new Set(arrived)].join(', ') : 'nothing. No final result, no Metadata.'}
            </span>
          )}
          {s.metadata && (
            <span className="cs-verdict__meta">
              Metadata: duration {String(s.metadata.duration)} s, request_id {String(s.metadata.request_id)}
            </span>
          )}
        </div>
        {s.kept.length + s.rest.length === 0 ? (
          <p className="note">No words came back. Try reading the line a little louder.</p>
        ) : (
          <p className="transcript__text">
            {s.kept.map((w, i) => (
              <span key={`k${i}`} className="word">
                {w.text}{' '}
              </span>
            ))}
            {s.rest.map((w, i) => (
              <span key={`r${i}`} className={v2 ? 'word cs-open' : 'word cs-lost'}>
                {w.text}{' '}
              </span>
            ))}
          </p>
        )}
        {s.rest.length > 0 && (
          <p className="note cs-legend">
            {v2
              ? 'Dashed: the open turn, from the last Update. No EndOfTurn came for it.'
              : 'Struck through: only ever in an interim result. These words never came back final.'}
          </p>
        )}
      </div>
    )
  },
})
