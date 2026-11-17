// Speak controls: speed and expressivity on the agent's speak provider. Checked live 2026-11-16 on
// the Agent API with node probes (Settings, then the greeting or UpdateSpeak plus InjectAgentMessage
// of one fixed line, audio counted as linear16 at 24 kHz):
//   speed on Flux (flux-wes-en, version v2): 0.5, 0.8, 1.0, 1.2, 1.5 accepted. The greeting
//     "Thanks for calling. Your order ships on Tuesday, the twelfth of March." ran 9.36 s at 0.5,
//     5.76 s at 0.8, 5.20 s at 1.0, 3.52 s at 1.2, 2.96 s at 1.5. 1.07 and 1.6 come back
//     SettingsApplied, then three Warnings SPEAK_REQUEST_FAILED ("'speed' must be one of the
//     supported increments" / "within documented range") and Error FAILED_TO_SPEAK when it speaks.
//   speed on Aura-2 (aura-2-thalia-en): 0.8, 1.0, 1.2 accepted (5.68, 4.40, 3.68 s on the same
//     greeting). 0.5 fails the same way as above ("within documented range").
//   expressivity on Flux: -2, -1, 0, 1, 2 accepted; 0.5 is UNPARSABLE_CLIENT_MESSAGE. It barely
//     moves the length (4.00, 4.16, 3.84 s at -2, 0, 2) but moves the pitch: median 83 Hz, range
//     2.5 semitones at -2; 110 Hz, 12.9 st at 0; 188 Hz, 16.8 st at +2 (second run; the first gave
//     87, 120, 211 Hz). On Aura-2 it is INVALID_SETTINGS ("only supported when the first
//     agent.speak provider is a Deepgram Flux TTS voice").
//   Both work mid-call in UpdateSpeak: SpeakUpdated, then the injected line at the new setting
//     (Flux 4.48 s at 0.8, 2.40 s at 1.2; Aura-2 4.28 s and 2.32 s).
//   normalize_volume (a /v2/speak query param) and any unknown provider field are
//     UNPARSABLE_CLIENT_MESSAGE in agent.speak.provider, so they are not offered.
//   Inline pronunciation (\{"word": ..., "pronounce": ...\}) in the spoken text is accepted on both
//     families with no error, but whether it changed the sound needs a listener, and on Flux with
//     speed 1.2 the line was never spoken and no message came back in 20 s. A Flux \{pause:1s\}
//     marker: nothing spoken, no error (as the docs say). Both belong in the LLM prompt per the
//     docs, not on the speak provider, so this page leaves them out.
// The panel times each reply's playback on the page, so the speed change shows as seconds.
// Verified live 2026-11-16: ONLY=agent-speak-controls pnpm verify:live passed. Both Settings variants (Flux wes with speed 1 and expressivity 0, Aura-2 thalia with speed 1) came back SettingsApplied on Flux and Nova-3 listening, every UpdateSpeak button (Flux: speed 0.8, 1.0, 1.2, expressivity -2 and +2; Aura-2: speed 0.8, 1.0, 1.2) came back SpeakUpdated, and the docs link resolved. Durations and pitch above come from separate live probes the same day.
import { useEffect, useRef, useState } from 'react'
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentAction, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

type Family = 'flux' | 'aura'

interface State {
  voice: Family
}

// The greeting and the line every button has the agent say again, so the replies compare.
export const LINE = 'Thanks for calling. Your order ships on Tuesday, the twelfth of March.'

const VOICE: Record<Family, { model: string; name: string }> = {
  flux: { model: 'flux-wes-en', name: 'Wes, Flux' },
  aura: { model: 'aura-2-thalia-en', name: 'Thalia, Aura-2' },
}

// The whole speak provider, as Settings and UpdateSpeak send it. Flux carries expressivity too, so
// every Flux message says which register it is in.
export const provider = (voice: Family, speed: number, expressivity = 0): Json =>
  voice === 'flux'
    ? { type: 'deepgram', version: 'v2', model: VOICE.flux.model, speed, expressivity }
    : { type: 'deepgram', model: VOICE.aura.model, speed }

interface Step {
  label: string
  speed: number
  expressivity?: number
}

const SPEEDS: Step[] = [
  { label: 'Speed 0.8', speed: 0.8 },
  { label: 'Speed 1.0', speed: 1 },
  { label: 'Speed 1.2', speed: 1.2 },
]
// Flux only. Beta: 0 is the only value validated for production (docs/tts-expressivity).
const REGISTERS: Step[] = [
  { label: 'Calm (-2)', speed: 1, expressivity: -2 },
  { label: 'Animated (+2)', speed: 1, expressivity: 2 },
]

export const stepsOf = (voice: Family) => (voice === 'flux' ? [...SPEEDS, ...REGISTERS] : SPEEDS)

const update = (voice: Family, s: Step): AgentAction => ({
  label: s.label,
  message: { type: 'UpdateSpeak', speak: { provider: provider(voice, s.speed, s.expressivity) } },
  ack: ['SpeakUpdated'],
  // The new setting only applies to what the agent says next, so the page has it repeat the line.
  then: { type: 'InjectAgentMessage', behavior: 'interrupt', message: LINE },
  // The panel draws these, so each reply can be tagged with the setting that spoke it.
  hidden: true,
})

export interface Reply {
  setting: string
  line: string
  // Seconds of playback on the page, or undefined while it is still playing.
  secs?: number
  cut: boolean
}

// One row per agent reply: when its first audio arrived, until playback stopped or the next reply
// took over. ends are the moments playback went quiet, in ms since Start, like audioStarts.
export function replies(messages: AgentPanelProps<State>['messages'], audioStarts: number[], ends: number[], fired: Array<{ label: string; ms: number }>, first: string): Reply[] {
  const said = messages.filter((m) => m.msg.type === 'ConversationText' && m.msg.role === 'assistant')
  return audioStarts.map((start, i) => {
    const next = audioStarts[i + 1]
    const quiet = ends.find((e) => e > start)
    const end = next !== undefined && (quiet === undefined || next < quiet) ? next : quiet
    const line = said.filter((m) => m.ms <= start + 300).at(-1)
    const setting = fired.filter((f) => f.ms < start).at(-1)?.label ?? first
    return {
      setting,
      line: line ? String(line.msg.content) : '',
      secs: end === undefined ? undefined : (end - start) / 1000,
      cut: end !== undefined && end === next && end !== quiet,
    }
  })
}

function ControlsPanel({ state, status, messages, playing, audioStarts, fire }: AgentPanelProps<State>) {
  // The page reports times since Start; the panel only sees them, so it works out when Start was
  // from the earliest arrival it can see, then times the moments playback goes quiet the same way.
  const t0 = useRef<number | null>(null)
  const wasPlaying = useRef(false)
  const [ends, setEnds] = useState<number[]>([])
  const [fired, setFired] = useState<Array<{ label: string; ms: number }>>([])
  const fresh = messages.length === 0 && audioStarts.length === 0

  useEffect(() => {
    if (!fresh) return
    t0.current = null
    wasPlaying.current = false
    setEnds([])
    setFired([])
  }, [fresh])

  useEffect(() => {
    const last = Math.max(messages.at(-1)?.ms ?? -1, audioStarts.at(-1) ?? -1)
    if (last < 0) return
    const guess = performance.now() - last
    if (t0.current === null || guess < t0.current) t0.current = guess
  }, [messages.length, audioStarts.length])

  useEffect(() => {
    if (wasPlaying.current && !playing && t0.current !== null) setEnds((all) => [...all, performance.now() - t0.current!])
    wasPlaying.current = playing
  }, [playing])

  const press = (label: string) => {
    if (t0.current !== null) setFired((all) => [...all, { label, ms: performance.now() - t0.current! }])
    fire(label)
  }

  const first = state.voice === 'flux' ? 'Start (1.0, 0)' : 'Start (1.0)'
  const rows = replies(messages, audioStarts, ends, fired, first)
  const base = rows.find((r) => r.line === LINE && !r.cut && r.secs !== undefined && /1\.0|Start/.test(r.setting))?.secs
  const scale = Math.max(1, ...rows.map((r) => r.secs ?? 0))
  const live = status === 'live'
  const steps = stepsOf(state.voice)

  return (
    <div className="asc">
      <div className="asc__buttons" role="group" aria-label="Speak settings">
        {steps.map((s) => (
          <button key={s.label} className="btn btn--ghost agent-action" disabled={!live} onClick={() => press(s.label)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="asc__head">
        <span className="asc__title">Each reply, timed on this page</span>
        <span className="asc__meta">from first audio to quiet, about ±0.25 s</span>
      </div>
      {rows.length === 0 ? (
        <p className="asc__empty">{live || status === 'mic' || status === 'connecting' ? 'Waiting for the greeting.' : 'Press Start. The greeting is the first row.'}</p>
      ) : (
        <table className="asc__table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Played</th>
              <th className="asc__wide">Line</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.line === LINE ? '' : 'is-other'}>
                <td className="asc__setting">{r.setting}</td>
                <td className="asc__secs">
                  {r.secs === undefined ? 'playing…' : `${r.secs.toFixed(1)} s`}
                  {r.cut && <span className="asc__of">cut off by the next one</span>}
                  {base && r.secs !== undefined && !r.cut && r.line === LINE && <span className="asc__of">{Math.round((r.secs / base) * 100)}% of 1.0</span>}
                  {r.secs !== undefined && <span className="asc__bar" style={{ width: `${(r.secs / scale) * 100}%` }} aria-hidden="true" />}
                </td>
                <td className="asc__line">{r.line === LINE ? 'the test line' : r.line || '…'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Set how fast it talks, and how lively.',
    lede: 'The agent reads one line. Press a speed and it reads the same line again at that rate, mid-call; the panel times each one. On a Flux voice, Calm and Animated change the delivery instead: lower and flatter, or higher and livelier.',
    ctaTitle: 'Tune the voice, not the text.',
    ctaBody: (
      <>
        Put <code>speed</code> and, on Flux, <code>expressivity</code> on <code>agent.speak.provider</code> in Settings, or
        change them mid-call with <code>UpdateSpeak</code>. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-tts-controls' },
  initialState: { voice: 'flux' },
  variants: [{ voice: 'flux' }, { voice: 'aura' }],
  agent: ({ voice }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a shipping desk agent. Answer in one short sentence.',
    },
    speak: { provider: provider(voice, 1) },
    greeting: LINE,
  }),
  highlight: ['speak'],
  events: ['SpeakUpdated'],
  flushOnUserSpeech: () => true,
  actions: ({ voice }) => stepsOf(voice).map((s) => update(voice, s)),
  runLabel: ({ voice }) => VOICE[voice].name,
  phrases: ({ voice }) => [
    '(No need to talk. Press Start and let it greet you.)',
    voice === 'flux' ? '(Then press Speed 0.8, Speed 1.2, Calm and Animated, and compare.)' : '(Then press Speed 0.8 and Speed 1.2, and compare.)',
  ],
  Panel: ControlsPanel,

  Controls({ state, setState, busy }) {
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="Voice">
          {(['flux', 'aura'] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={state.voice === v}
              className={state.voice === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ voice: v })}
            >
              {VOICE[v].name}
            </button>
          ))}
        </div>
        <p className="note">
          {state.voice === 'flux' ? (
            <>
              Flux takes <code>speed</code> from 0.5 to 1.5 in steps of 0.05, and <code>expressivity</code> from -2 to 2 (beta; 0 is
              the only value validated for production).
            </>
          ) : (
            <>
              Aura-2 takes <code>speed</code> from 0.7 to 1.5. <code>expressivity</code> is Flux only: on Aura-2 the Settings
              message fails with <code>INVALID_SETTINGS</code>.
            </>
          )}{' '}
          A value off those steps is still applied, then the first reply fails with <code>FAILED_TO_SPEAK</code>.
        </p>
      </>
    )
  },
})
