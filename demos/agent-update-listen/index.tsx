// UpdateListen: change the agent's speech-to-text mid-call, without reconnecting. Checked live
// 2026-11-16 on the Agent API with a macOS voice reading "Hi, I want to order the Kallistrum Pro.
// Can you check if Kallistrum ships to Ohio?" twice in one session:
//   flux-general-en: "Kolistrum" both times, then UpdateListen with keyterms ["Kallistrum"] came back
//   ListenUpdated in 0.07 s and the next user ConversationText read "Kallistrum" both times.
//   nova-3: "Colistrum", then the same UpdateListen on nova-3, ListenUpdated, then "Kallistrum".
//   (The docs say Nova-3 keyterms are fixed for the session; live, the mid-call update took effect.)
//   keyterms [] clears them ("Callistrum" next turn). Flux to nova-3 and back each came back
//   ListenUpdated and the next lines were transcribed by the new model, but keyterms did not carry
//   across a model switch, so every message here sends the model and the keyterms together.
//   eot_threshold 0.9 on Flux also came back ListenUpdated (not offered: hard to see on a page).
//   A provider without model (keyterms only, or type and keyterms) is UNPARSABLE_CLIENT_MESSAGE.
// Verified live 2026-11-16: ONLY=agent-update-listen pnpm verify:live passed. Settings came back SettingsApplied on flux-general-en and nova-3, each of the four UpdateListen actions came back ListenUpdated on both listen models, the docs link resolved, and the prompt.md Settings applied with a granted token.
import type { FC } from 'react'
import type { AgentAction, AgentPanelProps } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import type { Json } from '../../shared/common/feature'
import './styles.css'

type State = Record<string, never>

export const TERM = 'Kallistrum'

const MODELS = [
  { model: 'flux-general-en', label: 'Flux', version: 'v2' },
  { model: 'nova-3', label: 'Nova-3', version: 'v1' },
]

// The whole listen provider every time: the model is required, and keyterms are dropped on a switch.
const update = (m: (typeof MODELS)[number], keyterms: string[]): Json => ({
  type: 'UpdateListen',
  listen: { provider: { type: 'deepgram', version: m.version, model: m.model, keyterms } },
})

const ACTIONS: AgentAction[] = [
  ...MODELS.map((m, i) => ({ label: `Add keyterm ${TERM} (${m.label})`, message: update(m, [TERM]), ack: ['ListenUpdated'], primary: i === 0 })),
  ...MODELS.map((m) => ({ label: `Clear keyterms (${m.label})`, message: update(m, []), ack: ['ListenUpdated'] })),
]

// Splits a line into plain and matched pieces, so the term is marked when the agent heard it right.
export function markTerm(text: string, term: string): Array<{ text: string; hit: boolean }> {
  const out: Array<{ text: string; hit: boolean }> = []
  let last = 0
  for (const m of text.matchAll(new RegExp(`\\b${term}\\b`, 'gi'))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false })
    out.push({ text: m[0], hit: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false })
  return out
}

// What the agent's speech-to-text wrote down for the caller, with a rule wherever ListenUpdated came
// back, so the line before and the line after the update sit one above the other.
const Heard: FC<AgentPanelProps<State>> = ({ messages }) => {
  const rows = messages.filter(({ msg }) => msg.type === 'ListenUpdated' || (msg.type === 'ConversationText' && msg.role === 'user'))
  return (
    <div className="ul-heard" aria-live="polite">
      <span className="wire__label">What the agent heard you say</span>
      {rows.length === 0 ? (
        <p className="note">Your words show up here as the agent's speech-to-text wrote them, with {TERM} marked when it got it right.</p>
      ) : (
        rows.map(({ ms, msg }, i) =>
          msg.type === 'ListenUpdated' ? (
            <p key={i} className="ul-heard__rule">
              ListenUpdated at {(ms / 1000).toFixed(1)} s
            </p>
          ) : (
            <p key={i} className="ul-heard__line">
              {markTerm(String(msg.content), TERM).map((p, j) => (p.hit ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>))}
            </p>
          ),
        )
      )}
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Teach it a word mid-call.',
    lede: `Say the line once and the agent mishears ${TERM}, a made-up product name. Press Add keyterm and say it again: UpdateListen gives the agent's speech-to-text the word without reconnecting, and it hears it right.`,
    ctaTitle: 'Change how your agent listens, live.',
    ctaBody: (
      <>
        Send <code>UpdateListen</code> with a new <code>listen.provider</code> and wait for <code>ListenUpdated</code>. It
        swaps keyterms and the speech-to-text model. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-update-listen' },
  initialState: {},
  variants: [{}],
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt:
        'You take orders for a small electronics shop. When the caller names a product, first repeat back the product name exactly as it appears in their message, spelled the same way, then ask one short follow-up question. Keep every answer to one or two short sentences.',
    },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: 'Hi, thanks for calling. Which product would you like to order?',
  }),
  highlight: ['listen'],
  events: ['ListenUpdated'],
  flushOnUserSpeech: () => true,
  actions: () => ACTIONS,
  runLabel: () => 'keyterm update',
  phrases: () => [`Hi, I want to order the ${TERM} Pro. Can you check if ${TERM} ships to Ohio?`, `(Press Add keyterm ${TERM}, then say the same line again.)`],

  Controls() {
    return (
      <p className="note">
        Each button sends <code>UpdateListen</code> with the model it names and its keyterms. Press the one for the model
        you started on; the other model switches the agent's speech-to-text mid-call. They work once the agent is
        connected.
      </p>
    )
  },
  Panel: Heard,
})
