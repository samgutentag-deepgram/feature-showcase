// Listen model: pick the speech-to-text model a voice agent hears you with, and see what changes.
// Checked live 2026-11-16 on the Agent API, one Settings message per model:
//   flux-general-en and flux-general-multi (version v2), nova-3 and nova-2 (version v1) all come back
//   SettingsApplied. Each family takes its own agent.listen.provider fields and rejects the other's:
//   smart_format, language or endpointing on Flux, and eot_threshold or utterance_end_ms on Nova, are
//   UNPARSABLE_CLIENT_MESSAGE. nova-3 with version v2, or Flux with v1, is INVALID_SETTINGS.
//   language_hints on flux-general-en is INVALID_SETTINGS (flux-general-multi only).
// Spoken test, synthetic speech (Aura-2), "So I would like to order", a 1.5 s pause, then "two large
// pizzas for pickup.":
//   Flux kept it as one user line and sent EndOfTurn {"trigger":"model"} with it.
//   Nova-3 split it into two user lines at the pause and sent no EndOfTurn.
//   Flux sent an stt_latency LatencyReport about every 250 ms; Nova-3 sent one per call.
// Verified live 2026-11-16: verify:live sent the Settings message with all four listen models (flux-general-en, flux-general-multi, nova-3, nova-2), each with its own provider fields, and all four came back SettingsApplied; the prompt.md Settings applied with a granted token.
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

type State = Record<string, never>

export const MODELS = [
  { id: 'flux-general-en', label: 'Flux' },
  { id: 'flux-general-multi', label: 'Flux multilingual' },
  { id: 'nova-3', label: 'Nova-3' },
  { id: 'nova-2', label: 'Nova-2' },
]

const isFlux = (model: string) => model.startsWith('flux-')

// The provider fields each family takes. Flux needs version v2 and owns end of turn (eot_threshold
// 0.7 is its default, sent so the card shows the knob); Nova is v1 and can smart format.
export const providerFields = (model: string): Json =>
  isFlux(model)
    ? { version: 'v2', eot_threshold: 0.7, ...(model === 'flux-general-multi' ? { language_hints: ['en', 'es'] } : {}) }
    : { version: 'v1', smart_format: true }

const FIELDS: Array<[string, string, string]> = [
  ['version', 'v2 (required)', 'v1 (the default)'],
  ['End of turn', 'eot_threshold, eager_eot_threshold, eot_timeout_ms', 'Ends on silence; no eot fields'],
  ['Formatting, language', 'language_hints (multilingual only)', 'smart_format, language'],
]

const ms = (n: number) => `${(n / 1000).toFixed(1)} s`

// One row per thing you said: when its transcript came back, whether the listen model ended the turn
// itself (EndOfTurn), and how long until the agent's voice started.
function Turns({ messages, audioStarts, status }: AgentPanelProps<State>) {
  const users = messages.filter((m) => m.msg.type === 'ConversationText' && m.msg.role === 'user')
  if (!users.length) return status === 'idle' ? null : <p className="hint">Your turns show up here as the agent hears them.</p>
  const ends = messages.filter((m) => m.msg.type === 'EndOfTurn')
  const stt = messages.filter((m) => m.msg.type === 'LatencyReport' && typeof m.msg.stt_latency === 'number').length
  return (
    <div className="listen-turns">
      <span className="listen-turns__label">Your turns, as the listen model ended them</span>
      <ol>
        {users.map((u, i) => {
          const until = users[i + 1]?.ms ?? Infinity
          const within = (t: number) => t >= u.ms && t < until
          const eot = ends.find((e) => within(e.ms))
          const voice = audioStarts.find(within)
          const total = messages.find((m) => within(m.ms) && m.msg.type === 'LatencyReport' && typeof m.msg.total_latency === 'number')
          return (
            <li key={i}>
              <span className="listen-turns__at">{ms(u.ms)}</span>
              <span className="listen-turns__line">{String(u.msg.content)}</span>
              <span className="listen-turns__facts">
                {eot ? `EndOfTurn (${String(eot.msg.trigger ?? '')})` : 'no EndOfTurn'}
                {' · '}
                {voice !== undefined ? `agent voice ${ms(voice - u.ms)} later` : users[i + 1] ? 'you went on before it replied' : 'no reply yet'}
                {total ? ` · total_latency ${Number(total.msg.total_latency).toFixed(2)} s` : ''}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="hint">
        {users.length} user {users.length === 1 ? 'line' : 'lines'}, {ends.length} EndOfTurn, {stt} stt_latency {stt === 1 ? 'report' : 'reports'}.
      </p>
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Pick what your agent listens with.',
    lede: 'The listen model decides when you have finished talking. Flux ends the turn itself and says so with EndOfTurn. Nova-3 and Nova-2 transcribe, and the turn ends on a pause. Say the same line on each, pause in the middle, and compare the turns.',
    ctaTitle: 'Give your agent the right ears.',
    ctaBody: (
      <>
        Set <code>agent.listen.provider</code> in the <code>Settings</code> message: Flux with <code>version: "v2"</code> for
        turn-taking, or Nova with smart formatting. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-stt-models' },
  initialState: {},
  variants: [{}],
  listenModels: MODELS,
  listen: (_s, model) => providerFields(model),
  // No agent.language: flux-general-multi refuses it (INVALID_SETTINGS), and the rest do not need it.
  agent: () => ({
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You take phone orders for Acme Pizza. The shop opens at 11 on Saturday. Keep answers to one short sentence.',
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Acme Pizza, what can I get you?',
  }),
  highlight: ['listen', 'version', 'eot_threshold', 'language_hints', 'smart_format'],
  events: ['EndOfTurn', 'UserStartedSpeaking'],
  flushOnUserSpeech: () => true,
  runLabel: () => 'same line',
  phrases: () => ['What time do you open on Saturday?', 'Then, with a second or two of silence in the middle:', 'So I would like to order ... two large pizzas for pickup.'],
  Controls() {
    return (
      <div className="listen-fields">
        <span className="listen-fields__label">What each family takes in agent.listen.provider</span>
        <table>
          <thead>
            <tr>
              <th />
              <th>Flux</th>
              <th>Nova-3, Nova-2</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map(([what, flux, nova]) => (
              <tr key={what}>
                <th>{what}</th>
                <td>{flux}</td>
                <td>{nova}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Send a field to the wrong family and the agent answers UNPARSABLE_CLIENT_MESSAGE. Both take keyterms.</p>
      </div>
    )
  },
  Panel: Turns,
})
