// Speculative replies: with a Flux listen model the agent sends your words to the LLM before the turn
// is confirmed, holds the reply, and releases it on EndOfTurn. eager_eot_threshold on
// agent.listen.provider sets how early that starts. Checked live 2026-11-16 on the Agent API with
// flux-general-en (version v2), gpt-4o-mini and flux-wes-en, streaming two macOS `say` clips at real
// time: "What is the capital of France?" and "I would like a table for (0.9 s) um (0.8 s) four people,
// tomorrow night." Reply start = the agent's first audio minus the end of the last word, in ms:
//   plain line:  not set 1077, 1028, 1017 | 0.3: 1066, 974 | 0.4: 1180 | 0.5: 1382, 1323 | 0.8: 1421, 1618
//   hesitation:  not set 1283, 1299, 1323 | 0.3: 1279, 1288, 1543 | 0.5: 1358, 1349 | 0.7: 1808, 1773 | 0.8: 1906
// What the socket shows of it: no EagerEndOfTurn or TurnResumed is forwarded, and nothing marks a
// discarded reply. Three things are visible. A LatencyReport with ttt_token_latency arrives before
// EndOfTurn (the LLM already answered). UserStartedSpeaking arrives again in the middle of one turn
// (the docs: that is how a resumed turn shows, and the speculative reply is dropped). And the first
// agent audio lands within about 0.15 s of EndOfTurn instead of about 0.5 s after it.
// With it not set, the hesitation clip got 3 LLM answers before EndOfTurn and 4 UserStartedSpeaking
// in one turn; at 0.7 and 0.8 it got none and 1, and the LLM started only after EndOfTurn.
// So leaving it unset already speculates, about like 0.3, and raising it narrows the window. The docs
// say eager_eot_threshold "enables" eager end of turn; in these runs it only moved it later.
// Limits: 0.2 and 0.95 fail INVALID_SETTINGS; 0.8 alone is accepted but 0.9 alone fails "cannot be
// greater than eot_threshold", so the agent's eot default looks like 0.8, not the documented 0.7.
// eager_eot_threshold on nova-3 fails UNPARSABLE_CLIENT_MESSAGE: Flux only.
// Verified live 2026-11-16: ONLY=agent-speculative-replies pnpm verify:live passed. All four Settings variants (eager_eot_threshold 0.3, not set, 0.5, 0.8, on flux-general-en v2) came back SettingsApplied, the prompt.md Settings applied with a granted token, and the docs link resolved. The reply-start timings above come from separate live probes the same day.
import { useEffect, useRef, useState } from 'react'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

interface State {
  // null: the field is left out of Settings.
  eager: number | null
}

export const OPTIONS: Array<number | null> = [null, 0.3, 0.5, 0.8]

const optLabel = (v: number | null) => (v === null ? 'Not set' : String(v))
const runName = (v: number | null) => (v === null ? 'eager not set' : `eager ${v}`)

// Mic RMS above this counts as you talking. noiseSuppression is on, so room noise sits well below it.
const VOICE_RMS = 0.015
const FRAME_MS = 50

// Times (ms since Start) when the mic was loud, as [start, end] spans. Frames while the agent's
// audio plays are skipped, so its voice through your speakers is not counted as yours.
function useVoiceSpans(status: AgentPanelProps<State>['status'], playing: boolean): { spans: Array<[number, number]>; ok: boolean } {
  const [spans, setSpans] = useState<Array<[number, number]>>([])
  const [ok, setOk] = useState(false)
  const t0 = useRef(0)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const listening = status === 'connecting' || status === 'live'

  useEffect(() => {
    if (status === 'mic') {
      t0.current = performance.now()
      setSpans([])
      setOk(false)
    }
  }, [status])

  useEffect(() => {
    if (!listening) return
    let stopped = false
    let cleanup = () => {}
    ;(async () => {
      try {
        // The shell already holds the mic by now, so this does not prompt again.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)
        await ctx.resume()
        const buf = new Float32Array(analyser.fftSize)
        let open: [number, number] | null = null
        const id = window.setInterval(() => {
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += v * v
          const loud = Math.sqrt(sum / buf.length) > VOICE_RMS && !playingRef.current
          const at = performance.now() - t0.current
          if (!loud) return
          if (open && at - open[1] <= FRAME_MS * 3) {
            open[1] = at
            const span: [number, number] = [open[0], open[1]]
            setSpans((all) => [...all.slice(0, -1), span])
          } else {
            open = [at, at]
            const span = open
            setSpans((all) => [...all, span])
          }
        }, FRAME_MS)
        setOk(true)
        cleanup = () => {
          window.clearInterval(id)
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
        }
      } catch {
        // No level meter: the panel falls back to timing from EndOfTurn.
        setOk(false)
      }
    })()
    return () => {
      stopped = true
      cleanup()
    }
  }, [listening])

  return { spans, ok }
}

export interface Turn {
  user: string
  // ms since Start.
  eot: number
  voice?: number
  // LatencyReport ttt_token_latency messages that came before this EndOfTurn: LLM answers made
  // while the turn was still open.
  early: number
  // UserStartedSpeaking messages in this turn. More than one means the turn resumed.
  starts: number
  lastWord?: number
}

// One turn per EndOfTurn. A turn's window runs from the previous EndOfTurn (or Start) to this one.
export function turnsOf(messages: AgentPanelProps<State>['messages'], audioStarts: number[], spans: Array<[number, number]> = []): Turn[] {
  const turns: Turn[] = []
  let lines: string[] = []
  let early = 0
  let starts = 0
  let from = -Infinity
  for (const { ms, msg } of messages) {
    if (msg.type === 'ConversationText' && msg.role === 'user') lines.push(String(msg.content))
    if (msg.type === 'UserStartedSpeaking') starts++
    // Only once you have started talking: a reply's own report after EndOfTurn is not early.
    if (msg.type === 'LatencyReport' && typeof msg.ttt_token_latency === 'number' && starts > 0) early++
    if (msg.type !== 'EndOfTurn') continue
    const ends = spans.filter(([s, e]) => s > from && e <= ms).map(([, e]) => e)
    turns.push({
      user: lines.join(' '),
      eot: ms,
      voice: audioStarts.find((a) => a >= ms - 50),
      early,
      starts,
      lastWord: ends.length ? Math.max(...ends) : undefined,
    })
    lines = []
    early = 0
    starts = 0
    from = ms
  }
  return turns
}

export const median = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const msText = (ms: number) => `${Math.round(ms)} ms`

interface RunSummary {
  label: string
  turns: Turn[]
}

function TurnList({ run, ok }: { run: RunSummary; ok: boolean }) {
  const waits = run.turns.flatMap((t) => (t.voice !== undefined && t.lastWord !== undefined ? [t.voice - t.lastWord] : []))
  const m = median(waits)
  return (
    <div className="spr__run">
      <span className="spr__runlabel">
        {run.label}
        {m !== undefined && <mark> median reply start {msText(m)} after your last word</mark>}
      </span>
      {run.turns.length === 0 ? (
        <p className="hint">No turns yet.</p>
      ) : (
        <ol>
          {run.turns.map((t, i) => {
            const fromWord = t.voice !== undefined && t.lastWord !== undefined ? t.voice - t.lastWord : undefined
            const afterEot = t.voice !== undefined ? t.voice - t.eot : undefined
            return (
              <li key={i}>
                <span className="spr__line">{t.user || '(no transcript)'}</span>
                <span className="spr__facts">
                  {fromWord !== undefined ? <b>{msText(fromWord)} after your last word</b> : <b>{ok ? 'no reply yet' : 'no mic level'}</b>}
                  {afterEot !== undefined && <> · audio {msText(afterEot)} after EndOfTurn</>}
                  {' · '}LLM answered {t.early}x before EndOfTurn
                  {' · '}UserStartedSpeaking {t.starts}x{t.starts > 1 ? ` (resumed ${t.starts - 1}x)` : ''}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function SpeculativePanel({ state, status, messages, playing, audioStarts }: AgentPanelProps<State>) {
  const { spans, ok } = useVoiceSpans(status, playing)
  const turns = turnsOf(messages, audioStarts, ok ? spans : [])
  // The run before this one, kept so the two settings sit side by side.
  const [previous, setPrevious] = useState<RunSummary | null>(null)
  const current = useRef<RunSummary>({ label: runName(state.eager), turns: [] })
  const label = useRef(runName(state.eager))
  useEffect(() => {
    if (status !== 'mic') return
    if (current.current.turns.length) setPrevious(current.current)
    label.current = runName(state.eager)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps
  current.current = { label: label.current, turns }

  if (!turns.length && !previous)
    return (
      <div className="spr">
        <span className="spr__label">Each turn: when the reply started, and what the agent did before EndOfTurn</span>
        <p className="hint">{status === 'idle' ? 'Start talking. Each turn lands here once the agent answers.' : 'Say the line with the pauses, then wait for the reply.'}</p>
      </div>
    )
  return (
    <div className="spr" aria-live="polite">
      <span className="spr__label">Each turn: when the reply started, and what the agent did before EndOfTurn</span>
      <div className={previous ? 'spr__cols spr__cols--two' : 'spr__cols'}>
        {previous && <TurnList run={previous} ok />}
        <TurnList run={current.current} ok={ok} />
      </div>
      <p className="hint">
        {ok ? 'Your last word is timed from the mic level on this page, with agent audio ignored.' : 'No mic level here, so only the time after EndOfTurn shows.'} Audio
        right at EndOfTurn means the reply was built before the turn was confirmed.
      </p>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Does the agent think before you finish?',
    lede: 'On Flux, the voice agent sends your words to the LLM while the turn is still open, holds the reply, and plays it once the turn is confirmed. eager_eot_threshold sets how early that starts. Say a line with a hesitation, switch the setting, say it again, and compare when the reply starts.',
    ctaTitle: 'Reply sooner, without talking over people.',
    ctaBody: (
      <>
        Put <code>eager_eot_threshold</code> (0.3 to 0.9, no higher than <code>eot_threshold</code>) on{' '}
        <code>agent.listen.provider</code> with a Flux model to move the start of the speculative window. New accounts start with $200 in
        free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-speculative-replies' },
  initialState: { eager: 0.3 },
  // 0.3 first: the prompt builder shows the first variant, and it should carry the field.
  variants: [0.3, null, 0.5, 0.8].map((eager) => ({ eager })),
  listenModels: [{ id: 'flux-general-en', label: 'Flux' }],
  listen: ({ eager }) => ({ version: 'v2', ...(eager === null ? {} : { eager_eot_threshold: eager }) }),
  agent: () => ({
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You take bookings for Acme Bistro. Keep answers to one short sentence.',
    },
    speak: { provider: { type: 'deepgram', model: 'flux-wes-en' } },
    greeting: 'Acme Bistro, how can I help?',
  }),
  highlight: ['eager_eot_threshold'],
  events: ['UserStartedSpeaking', 'EndOfTurn'],
  flushOnUserSpeech: () => true,
  runLabel: ({ eager }) => runName(eager),
  phrases: () => [
    'After the greeting, say this with short pauses, about a second, at the dots:',
    'I would like a table for ... um ... four people, tomorrow night.',
    'Then switch the setting and say it again.',
  ],

  Controls({ state, setState, busy }) {
    return (
      <div className="spr-controls">
        <span className="spr__label">eager_eot_threshold</span>
        <div className="segmented" role="radiogroup" aria-label="eager_eot_threshold">
          {OPTIONS.map((v) => (
            <button
              key={String(v)}
              role="radio"
              aria-checked={state.eager === v}
              className={state.eager === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ eager: v })}
            >
              {optLabel(v)}
            </button>
          ))}
        </div>
        <p className="hint">
          Lower starts the LLM earlier and throws more answers away. In our runs, not set behaved like 0.3 and was the fastest; 0.8
          started the LLM only after EndOfTurn and replied about 0.4 to 0.6 s later. Flux listen models only.
        </p>
      </div>
    )
  },

  Panel: SpeculativePanel,
})
