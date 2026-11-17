// Reusable agent configurations: the agent block is stored once with the REST API and Settings
// carries only its id. Checked live 2026-11-16 on the Agent API:
//   GET /v1/projects/{project_id}/agents/377c136a-... returned the stored config below (as a JSON
//   string in "config", metadata name customer-service-agent). Settings with "agent": that id came
//   back Welcome, SettingsApplied; an InjectUserMessage then got ConversationText assistant "You're
//   speaking with a customer service agent here to assist you." and AgentAudioDone 2.2 s in.
//   An unknown id came back Error INTERNAL_SERVER_ERROR "Internal Server Error resolving agent ID."
//   right after Welcome. This page never creates, changes or deletes a stored config.
// Verified live 2026-11-16: ONLY=agent-reusable-config pnpm verify:live passed; Settings with the stored id came back SettingsApplied and the unknown id came back Error INTERNAL_SERVER_ERROR, as expected; a probe call with the stored id answered an InjectUserMessage with ConversationText assistant "You're speaking with a customer service agent here to assist you." and AgentAudioDone.
import type { AgentPanelProps } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

type Which = 'stored' | 'unknown'
interface State {
  which: Which
}

// Stored in the demo project with POST /v1/projects/{project_id}/agents. Copied here from a GET of
// it on 2026-11-16 so the page can show what the id stands for; the browser never reads it.
export const STORED_ID = '377c136a-5516-4824-8f54-0220d5ce2920'
export const STORED_CONFIG = {
  language: 'en',
  listen: { provider: { type: 'deepgram', model: 'nova-3' } },
  think: { provider: { type: 'open_ai', model: 'gpt-4o-mini' }, prompt: 'You are a helpful customer service agent.' },
  speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
}
// A well-formed id that no stored config has, like one that was deleted.
export const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

const idOf = (s: State) => (s.which === 'stored' ? STORED_ID : UNKNOWN_ID)
const configText = JSON.stringify(STORED_CONFIG, null, 2)

function StoredConfig({ state, messages }: AgentPanelProps<State>) {
  const err = messages.find((m) => m.msg.type === 'Error')
  const applied = messages.some((m) => m.msg.type === 'SettingsApplied')
  return (
    <div className="rc-panel">
      {state.which === 'stored' ? (
        <>
          <span className="wire__label">What the id stands for: stored once, applied on every call</span>
          <pre className="agent-json">{configText}</pre>
          <p className="note">
            This agent block lives in the Deepgram project under id <code>{STORED_ID}</code>. Settings above sends only the
            id, and Deepgram applies this block: Nova-3 listening, gpt-4o-mini thinking with that one-line prompt, and the
            Aura-2 Thalia voice. Every client that sends the id gets this same agent. A stored config cannot be edited: to change it, create a new one and send its id.
            {applied && ' SettingsApplied came back, so the stored config is live on this call.'}
          </p>
        </>
      ) : (
        <>
          <span className="wire__label">An id with no stored config behind it</span>
          <p className="note">
            Nothing is stored under <code>{UNKNOWN_ID}</code>, as after a delete. Deepgram answers with an{' '}
            <code>Error</code> whose code is <code>INTERNAL_SERVER_ERROR</code> right after <code>Welcome</code>, and the
            call never starts. Check the id before you delete a config that live apps still send.
          </p>
        </>
      )}
      {err && (
        <p className="note rc-error">
          Came back: <code>{JSON.stringify(err.msg)}</code>
        </p>
      )}
    </div>
  )
}

const OPTIONS: { id: Which; label: string }[] = [
  { id: 'stored', label: 'Stored id' },
  { id: 'unknown', label: 'Unknown id' },
]

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Send an id, not the whole agent.',
    lede: 'Store the agent block once with the Deepgram REST API and the Settings message shrinks to an id. Press Start and talk: the Request card carries only the id, the panel shows the stored prompt, models and voice it stands for, and the agent answers with them.',
    ctaTitle: 'Keep the agent out of your client code.',
    ctaBody: (
      <>
        Create the config with <code>POST {'/v1/projects/{project_id}/agents'}</code>, then send its id as{' '}
        <code>agent</code> in your <code>Settings</code> message. Keep one id per customer, region or test arm. New accounts
        start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/reusable-agent-configurations' },
  initialState: { which: 'stored' },
  variants: [{ which: 'stored' }, { which: 'unknown' }],
  agent: idOf,
  // The stored config carries its own listen model (Nova-3), so the page adds no listen block.
  listenModels: [],
  expects: (s) => (s.which === 'unknown' ? { error: 'INTERNAL_SERVER_ERROR' } : {}),
  highlight: ['agent'],
  events: ['ConversationText'],
  flushOnUserSpeech: () => true,
  runLabel: (s) => (s.which === 'stored' ? `stored id ${STORED_ID.slice(0, 8)}` : 'unknown id'),
  phrases: (s) =>
    s.which === 'stored'
      ? ['Hi, who am I talking to?', 'Can you help me track an order?']
      : ['(Press Start. The call ends with an Error before you can talk.)'],
  Panel: StoredConfig,

  Controls({ state, setState, busy }) {
    return (
      <div className="field">
        <div className="segmented" role="radiogroup" aria-label="Agent id">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={state.which === o.id}
              className={state.which === o.id ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ which: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
