// Speak fallback: agent.speak as an array is an ordered chain of TTS providers. Probed live
// 2026-11-16 on the Agent API (greeting only, no user audio, Flux listening):
//   A voice id that does not exist is the cleanest way to break the first provider. Settings is
//   still applied; then, within 1 to 45 ms of SettingsApplied, three Warning SPEAK_REQUEST_FAILED
//   arrive ("Status code: 400 Bad Request ... No such model/version combination found"), and the
//   next voice in the array speaks the greeting. Both orders work: flux-nil-en then
//   aura-2-thalia-en, and aura-2-nil-en then flux-wes-en.
//   Pointing the first provider at a host that does not resolve is refused up front instead:
//   open_ai with endpoint https://example.invalid/... is Error INVALID_SETTINGS "Failed to resolve
//   endpoint", and a Flux voice with any speak.endpoint is INVALID_SETTINGS ("Flux is built in").
//   Timings, SettingsApplied to the greeting's first audio, three runs each: Flux Wes alone 153 to
//   191 ms, Aura-2 Thalia alone 61 to 72 ms, broken Flux then Thalia 65 to 80 ms, broken Aura-2
//   then Wes 162 to 197 ms. So the three failed attempts cost tens of milliseconds at most; the
//   voice that ends up speaking sets the time.
//   After the first failure the session stays on the fallback: a later InjectAgentMessage line and
//   an LLM reply to InjectUserMessage were spoken by the fallback with no new warnings. The docs
//   say each new utterance starts again from the first provider.
// Verified live 2026-11-16: ONLY=agent-speak-fallback pnpm verify:live passed. All four Settings
// variants (Flux or Aura-2 first, broken or not) came back SettingsApplied on Flux and Nova-3
// listening, each broken one also got Warning SPEAK_REQUEST_FAILED, and the docs link resolved.
import { useEffect, useRef, useState } from 'react'
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

type Family = 'flux' | 'aura'

interface State {
  first: Family
  broken: boolean
}

interface Voice {
  name: string
  family: string
  model: string
}

const VOICES: Record<Family, Voice> = {
  flux: { name: 'Wes', family: 'Flux', model: 'flux-wes-en' },
  aura: { name: 'Thalia', family: 'Aura-2', model: 'aura-2-thalia-en' },
}

// Ids that do not exist. Deepgram answers each attempt with a 400, so the agent moves on to the
// next provider. No secret, no outside endpoint. Kept no longer than the real ids, so prompt.md
// (which shows the longest variant) shows the working chain.
const MISSING: Record<Family, string> = { flux: 'flux-nil-en', aura: 'aura-2-nil-en' }

const other = (f: Family): Family => (f === 'flux' ? 'aura' : 'flux')

// Flux voices need version v2; Aura-2 voices take the default (v1).
const provider = (f: Family, model: string): Json => (f === 'flux' ? { type: 'deepgram', version: 'v2', model } : { type: 'deepgram', model })

export const speakChain = ({ first, broken }: State): Json[] => [
  { provider: provider(first, broken ? MISSING[first] : VOICES[first].model) },
  { provider: provider(other(first), VOICES[other(first)].model) },
]

interface Link {
  label: string
  model: string
}

const chainOf = (s: State): Link[] => [
  { label: s.broken ? `${VOICES[s.first].family} (broken id)` : `${VOICES[s.first].name} (${VOICES[s.first].family})`, model: s.broken ? MISSING[s.first] : VOICES[s.first].model },
  { label: `${VOICES[other(s.first)].name} (${VOICES[other(s.first)].family})`, model: VOICES[other(s.first)].model },
]

export interface Summary {
  chain: Link[]
  applied?: number
  warnings: Array<{ ms: number; model: string; status: string }>
  firstAudio?: number
  // Which link spoke the greeting: 0 or 1, or undefined before any audio.
  spoke?: number
  replies: number
  // Warnings that came after the greeting's first audio.
  laterWarnings: number
  failed?: string
}

// What one run shows: when Settings was applied, the SPEAK_REQUEST_FAILED warnings and the model
// each names, when the greeting's first audio came, and so which voice in the chain spoke.
export function summarize(chain: Link[], messages: Array<{ ms: number; msg: Json }>, audioStarts: number[]): Summary {
  const s: Summary = { chain, warnings: [], replies: 0, laterWarnings: 0 }
  s.firstAudio = audioStarts[0]
  for (const { ms, msg } of messages) {
    if (msg.type === 'SettingsApplied' && s.applied === undefined) s.applied = ms
    if (msg.type === 'Warning' && msg.code === 'SPEAK_REQUEST_FAILED') {
      if (s.firstAudio !== undefined && ms > s.firstAudio) s.laterWarnings++
      else {
        const d = String(msg.description ?? '')
        s.warnings.push({ ms, model: /model: '([^']+)'/.exec(d)?.[1] ?? '?', status: /Status code: (\d+)/.exec(d)?.[1] ?? '' })
      }
    }
    if (msg.type === 'Error') s.failed = String(msg.code ?? 'Error')
    if (msg.type === 'ConversationText' && msg.role === 'assistant') s.replies++
  }
  if (s.firstAudio !== undefined) s.spoke = s.warnings.some((w) => w.model === chain[0].model) ? 1 : 0
  return s
}

const ms = (n?: number) => (n === undefined ? '' : `${Math.round(n)} ms`)
const toAudio = (s: Summary) => (s.firstAudio !== undefined && s.applied !== undefined ? s.firstAudio - s.applied : undefined)

// Added delay for a run that failed over: its time to first audio against runs where the same voice
// spoke with nothing failing first. Blank until there is such a run to compare with.
function addedDelay(run: Summary, all: Summary[]): string {
  if (run.spoke !== 1) return ''
  const model = run.chain[1].model
  const clean = all.filter((r) => r.spoke !== undefined && !r.warnings.length && r.chain[r.spoke].model === model).map(toAudio)
  const base = clean.filter((v): v is number => v !== undefined).sort((a, b) => a - b)
  const t = toAudio(run)
  if (!base.length || t === undefined) return ''
  const median = base[Math.floor(base.length / 2)]
  const d = Math.round(t - median)
  return `${d >= 0 ? '+' : ''}${d} ms`
}

function FallbackPanel({ state, status, messages, audioStarts }: AgentPanelProps<State>) {
  const chain = useRef<Link[]>(chainOf(state))
  const last = useRef<Summary | undefined>(undefined)
  const [past, setPast] = useState<Summary[]>([])
  const wasIdle = useRef(true)

  // A new run: keep the one before it for comparison, and pin this run's chain so editing the
  // controls afterwards does not relabel it.
  useEffect(() => {
    if (status !== 'idle' && wasIdle.current) {
      const prev = last.current
      if (prev?.applied !== undefined) setPast((p) => [prev, ...p].slice(0, 6))
      chain.current = chainOf(state)
      last.current = undefined
    }
    wasIdle.current = status === 'idle'
  }, [status, state])

  const started = status !== 'idle' || messages.length > 0
  // The render that starts a run comes before the effect that pins its chain.
  const links = !started || (status !== 'idle' && wasIdle.current) ? chainOf(state) : chain.current
  const now = summarize(links, messages, audioStarts)
  if (started) last.current = now
  const runs = [...(now.applied !== undefined ? [now] : []), ...past]
  const lastWarn = now.warnings.at(-1)

  return (
    <div className="sf" aria-live="polite">
      <div className="sf__head">
        <span className="sf__title">agent.speak, in order</span>
        <span className="sf__meta">{started ? 'this run' : 'press Start talking; the agent greets you first'}</span>
      </div>
      <ol className="sf__chain">
        {links.map((l, i) => {
          const fails = now.warnings.filter((w) => w.model === l.model)
          const spoke = now.spoke === i
          return (
            <li key={i} className={spoke ? 'is-spoke' : fails.length ? 'is-failed' : ''}>
              <span className="sf__pos">{i + 1}</span>
              <span className="sf__name">{l.label}</span>
              <code className="sf__model">{l.model}</code>
              <span className="sf__state">
                {fails.length ? `failed ${fails.length}x${fails[0].status ? ` (HTTP ${fails[0].status})` : ''}` : ''}
                {spoke ? 'spoke the greeting' : ''}
                {!fails.length && !spoke && now.spoke !== undefined ? 'not needed' : ''}
              </span>
            </li>
          )
        })}
      </ol>
      {now.applied !== undefined && (
        <p className="sf__times">
          SettingsApplied at {ms(now.applied)}
          {lastWarn && (
            <>
              , {now.warnings.length} SPEAK_REQUEST_FAILED by {ms(lastWarn.ms)} ({ms(lastWarn.ms - now.applied)} after it)
            </>
          )}
          {now.firstAudio !== undefined ? (
            <>
              , first audio at {ms(now.firstAudio)} (<mark>{ms(toAudio(now))} after SettingsApplied</mark>)
            </>
          ) : (
            ', waiting for audio'
          )}
          .
          {now.replies > 1 && ` ${now.replies - 1} later ${now.replies === 2 ? 'reply' : 'replies'}, ${now.laterWarnings} new warnings.`}
          {now.failed && ` Error ${now.failed}.`}
        </p>
      )}
      {runs.length > 0 && (
        <div className="sf__scroll">
          <table className="sf__table">
            <thead>
              <tr>
                <th>Run</th>
                <th>First in chain</th>
                <th>Warnings</th>
                <th>Voice that spoke</th>
                <th>To first audio</th>
                <th>Added delay</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}>
                  <td className="sf__num">{i === 0 && r === now ? 'now' : runs.length - i}</td>
                  <td>{r.chain[0].label}</td>
                  <td className="sf__val">{r.warnings.length}</td>
                  <td>{r.spoke === undefined ? '' : r.chain[r.spoke].label}</td>
                  <td className="sf__val">{ms(toAudio(r))}</td>
                  <td className="sf__val">{addedDelay(r, runs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sf__legend">
        To first audio runs from SettingsApplied to the greeting's first audio chunk. Added delay compares a run that fell back
        with your runs where the same voice spoke first time: break Flux, then run once with Aura-2 first and unbroken.
      </p>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Keep talking when a voice fails.',
    lede: 'Give agent.speak a list of voices and the agent falls back down it when one fails. Break the first voice and press Start: Deepgram sends three SPEAK_REQUEST_FAILED warnings and the second voice greets you, with the timing laid out below.',
    ctaTitle: 'A backup voice, one array away.',
    ctaBody: (
      <>
        Send <code>agent.speak</code> as an array of providers, preferred first. The agent tries them in order and
        warns you on each failure. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-tts-models' },
  initialState: { first: 'flux', broken: false },
  variants: [
    { first: 'flux', broken: false },
    { first: 'flux', broken: true },
    { first: 'aura', broken: true },
    { first: 'aura', broken: false },
  ],
  agent: (s) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly assistant. Answer in one short sentence.',
    },
    speak: speakChain(s),
    greeting: 'Hi there. If you can hear me, the voice chain is working. Ask me anything.',
  }),
  highlight: ['speak', MISSING.flux, MISSING.aura],
  events: ['Warning'],
  expects: ({ broken }) => (broken ? { warning: 'SPEAK_REQUEST_FAILED' } : {}),
  flushOnUserSpeech: () => true,
  runLabel: ({ first, broken }) => `${VOICES[first].family} first${broken ? ', broken' : ''}`,
  phrases: () => ['Tell me a one-line joke.'],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.broken} disabled={busy} onChange={(e) => setState({ ...state, broken: e.target.checked })} />
          Break the first voice (swap in a voice id that does not exist)
        </label>
        <div className="sf-order" role="radiogroup" aria-label="First voice in the chain">
          {(['flux', 'aura'] as Family[]).map((f) => (
            <label key={f} className="check">
              <input type="radio" name="sf-first" checked={state.first === f} disabled={busy} onChange={() => setState({ ...state, first: f })} />
              {VOICES[f].family} first ({VOICES[f].name}), then {VOICES[other(f)].family} ({VOICES[other(f)].name})
            </label>
          ))}
        </div>
      </>
    )
  },

  Panel: FallbackPanel,
})
