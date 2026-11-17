// Agent handshake: the opening of every Voice Agent session, step by step, with timings. Probed live
// 2026-11-16, one short socket each, no audio played:
//   Handshake: open 80 to 350 ms after the socket was made, Welcome with request_id in the same ms,
//   SettingsApplied 30 to 110 ms after Settings. Settings sent on open (before Welcome) also works.
//   Binary audio before Settings: Error NON_SETTINGS_MESSAGE_BEFORE_SETTINGS, socket closed.
//   Audio straight after Settings, before SettingsApplied: accepted, SettingsApplied, no Error.
//   KeepAlive before Settings: accepted (the errors page says any message before Settings fails).
//   Settings twice: SettingsApplied, then Error SETTINGS_ALREADY_APPLIED, socket closed.
//   Malformed Settings (top-level greeting, unknown field, string sample_rate, broken JSON): Error
//   UNPARSABLE_CLIENT_MESSAGE naming the field. Unknown listen model: FAILED_TO_START_LISTENING.
// The panel runs these on sockets of its own (no mic). Start talking runs the real conversation.
import { useState } from 'react'
import { fetchToken } from '../../shared/common/config'
import { AGENT_URL, defineAgentFeature, settingsMessage, type AgentMessage } from '../../shared/agent/feature'
import { SCENARIOS, runScenario, type Outcome, type ScenarioId } from './handshake'
import './styles.css'

interface State {
  settings: 'valid' | 'malformed'
}

const GREETING_DEMO = '/demos/agent-greeting/'
// The panel's sockets listen with Flux; the handshake is the same with either listen model.
const PANEL_LISTEN = 'flux-general-en'

const ms = (n?: number) => (n === undefined ? 'never' : `${n} ms`)
const secs = (n: number) => `${(n / 1000).toFixed(2)} s`

// The handshake of the conversation started with Start talking, from the server messages the shell
// timed (ms since Start, so mic permission and the token fetch are included).
function liveHandshake(messages: AgentMessage[]) {
  const welcome = messages.find((m) => m.msg.type === 'Welcome')
  const applied = messages.find((m) => m.msg.type === 'SettingsApplied')
  const error = messages.find((m) => m.msg.type === 'Error')
  return { welcome, applied, error }
}

const feature = defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Watch the agent say hello.',
    lede: 'Every Voice Agent session opens the same way: the socket opens, Deepgram sends Welcome with a request_id, you send Settings, and SettingsApplied comes back. Only then is the agent ready. Run the handshake below and see each step timed, then break the order on purpose and see the real error.',
    ctaTitle: 'Open every session in order.',
    ctaBody: (
      <>
        Log the <code>request_id</code> from <code>Welcome</code>, send one <code>Settings</code> first, and start streaming
        audio once it is sent. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-welcome-message' },
  initialState: { settings: 'valid' },
  variants: [{ settings: 'valid' }, { settings: 'malformed' }],
  // A top-level greeting is a real mistake: it belongs inside agent. The server refuses the message.
  settings: ({ settings }) => (settings === 'malformed' ? { greeting: 'Hi, how can I help?' } : {}),
  expects: ({ settings }) => (settings === 'malformed' ? { error: 'UNPARSABLE_CLIENT_MESSAGE' } : {}),
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly assistant. Answer in one or two short sentences.',
    },
    speak: { provider: { type: 'deepgram', model: 'flux-wes-en' } },
  }),
  highlight: ['greeting'],
  events: ['Welcome', 'SettingsApplied'],
  flushOnUserSpeech: () => true,
  runLabel: ({ settings }) => (settings === 'malformed' ? 'malformed Settings' : 'handshake'),
  phrases: ({ settings }) =>
    settings === 'malformed' ? ['(Nothing to say: the session ends at Settings with an Error.)'] : ['Hi, can you hear me?'],

  Controls({ state, setState, busy }) {
    return (
      <div className="toolbar">
        <span className="agent-listen">Settings</span>
        <div className="segmented" role="radiogroup" aria-label="Settings message">
          {(['valid', 'malformed'] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={state.settings === v}
              className={state.settings === v ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ settings: v })}
            >
              {v === 'valid' ? 'Valid' : 'Malformed'}
            </button>
          ))}
        </div>
      </div>
    )
  },

  Panel({ status, messages }) {
    const [running, setRunning] = useState<ScenarioId | null>(null)
    const [shown, setShown] = useState<Outcome | null>(null)
    const [seen, setSeen] = useState<Partial<Record<ScenarioId, Outcome>>>({})
    const [error, setError] = useState('')
    const busy = running !== null || status !== 'idle'

    const run = async (id: ScenarioId) => {
      setRunning(id)
      setError('')
      try {
        const token = await fetchToken()
        const outcome = await runScenario(
          id,
          {
            valid: settingsMessage<State>(feature, { settings: 'valid' }, PANEL_LISTEN),
            malformed: settingsMessage<State>(feature, { settings: 'malformed' }, PANEL_LISTEN),
          },
          () => new WebSocket(AGENT_URL, ['bearer', token]),
        )
        setShown(outcome)
        setSeen((all) => ({ ...all, [id]: outcome }))
      } catch (err) {
        setError((err as Error).message)
      }
      setRunning(null)
    }

    const live = liveHandshake(messages)
    const scenario = shown && SCENARIOS.find((s) => s.id === shown.scenario)

    return (
      <div className="hs">
        <div className="hs__head">
          <span className="hs__title">Run the opening on its own</span>
          <span className="note">No mic, no agent audio: a fresh socket each time, closed as soon as the answer is in.</span>
        </div>
        <div className="hs__buttons">
          {SCENARIOS.map((s) => {
            const o = seen[s.id]
            return (
              <button key={s.id} className={`btn ${s.id === 'ok' ? 'btn--primary' : 'btn--ghost'} hs__btn`} disabled={busy} onClick={() => run(s.id)} title={s.what}>
                {running === s.id ? 'Running…' : s.label}
                {o && <span className={`hs__code${o.codes.length ? ' is-error' : ''}`}>{o.codes[0] ?? (o.applied ? 'SettingsApplied' : 'no answer')}</span>}
              </button>
            )
          })}
        </div>
        {error && <p className="error" role="alert">{error}</p>}

        {shown && scenario && (
          <div className="hs__run" aria-live="polite">
            <p className="hs__what">
              <strong>{scenario.label}.</strong> {scenario.what}
            </p>
            <dl className="hs__times">
              <div>
                <dt>open</dt>
                <dd>{ms(shown.openMs)}</dd>
              </div>
              <div>
                <dt>Welcome</dt>
                <dd>{ms(shown.welcomeMs)}</dd>
              </div>
              <div>
                <dt>Settings sent</dt>
                <dd>{ms(shown.settingsMs)}</dd>
              </div>
              <div>
                <dt>SettingsApplied</dt>
                <dd>{ms(shown.appliedMs)}</dd>
              </div>
            </dl>
            {shown.requestId && (
              <p className="hs__id">
                request_id <code>{shown.requestId}</code>
              </p>
            )}
            <ol className="hs__steps" aria-label="Steps">
              {shown.steps.map((s, i) => (
                <li key={i} className={`hs__step hs__step--${s.kind}${s.label === 'Error' || s.label === 'Warning' ? ' is-error' : ''}`}>
                  <span className="hs__ms">{s.ms} ms</span>
                  <span className="hs__dir">{s.kind === 'sent' ? 'you →' : s.kind === 'got' ? '← Deepgram' : ''}</span>
                  <span className="hs__label">{s.label}</span>
                  {s.detail && <span className="hs__detail">{s.detail}</span>}
                </li>
              ))}
            </ol>
            <p className="note">Times are from creating the socket; the token fetch before it is not counted.</p>
          </div>
        )}

        {(status !== 'idle' || messages.length > 0) && (
          <p className="note hs__live">
            Your conversation:{' '}
            {live.welcome ? (
              <>
                <code>Welcome</code> at {secs(live.welcome.ms)}, request_id <code>{String(live.welcome.msg.request_id)}</code>
                {live.applied ? (
                  <>
                    , <code>SettingsApplied</code> at {secs(live.applied.ms)}
                  </>
                ) : live.error ? (
                  <>
                    , then <code>Error</code> <code>{String(live.error.msg.code)}</code>
                  </>
                ) : (
                  ', waiting for SettingsApplied'
                )}
                . Times are since you pressed Start, so the mic prompt and the token fetch are in them. This page sends
                Settings the moment the socket opens, without waiting for Welcome; that works too.
              </>
            ) : (
              'waiting for Welcome.'
            )}
          </p>
        )}
        <p className="note">
          After <code>SettingsApplied</code>, an agent with a greeting speaks first. See it in the{' '}
          <a href={GREETING_DEMO}>agent greeting demo</a>.
        </p>
      </div>
    )
  },
})

export default feature
