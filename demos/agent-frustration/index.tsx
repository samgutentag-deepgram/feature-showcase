// Frustration detection: Think Live reads each caller turn for frustration and sends
// FrustrationDetected with a running count, flipping escalated once it reaches frustration_max_count.
// Probed live 2026-11-16 on the Agent API, gpt-4o-mini thinking, four macOS `say` clips (one calm
// order question, then three angry lines such as "This is the third time I've called and nobody
// has fixed it!"), nine runs:
//   Flux, think_live defaults: no event on the calm turn, then FrustrationDetected count 1
//   escalated false on the first angry turn and count 2 escalated true on the next (so the server
//   default is 2). The count keeps going after that (3, 4) with escalated still true.
//   Flux, frustration_max_count 3: counts 1, 2 false, then 3 true. Nova-3, defaults: same pattern.
//   frustration_max_count 0: no FrustrationDetected, as documented.
//   presence_check_max_count 0 also stopped every FrustrationDetected (Flux and Nova-3), which the
//   docs do not say; agent_backchannel_sensitivity 0 did not. So this page leaves presence checks on.
//   No aside comes with it: no ConversationText carries a frustration conversational_behavior, and
//   the LLM's reply ("I understand your frustration") came back the same with detection on or off.
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  // frustration_max_count: how many FrustrationDetected events come before escalated turns true.
  max: number
}

const MAXES = [1, 2, 3]

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'It knows when you are fed up.',
    lede: 'Think Live reads every caller turn for frustration. Ask a calm question, then complain like it is your third call. Each annoyed turn sends FrustrationDetected with a running count, and once the count reaches your limit, escalated flips to true: your cue to hand the call to a person.',
    ctaTitle: 'Escalate before they hang up.',
    ctaBody: (
      <>
        Set <code>agent.think_live.provider.frustration_max_count</code> in your Settings message and listen for{' '}
        <code>FrustrationDetected</code>. When <code>escalated</code> is true, run your own handoff: Deepgram does not
        transfer the call. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-think-live' },
  initialState: { max: 2 },
  variants: MAXES.map((max) => ({ max })),
  agent: ({ max }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a support agent for Acme internet. Help with outages and orders. Keep every reply to one short sentence.',
    },
    think_live: {
      provider: {
        type: 'deepgram',
        version: 'v1',
        frustration_max_count: max,
      },
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, this is Acme support. How can I help?',
  }),
  highlight: ['think_live'],
  events: ['FrustrationDetected', 'ConversationText backchannel', 'ConversationText presence_check'],
  flushOnUserSpeech: () => true,
  runLabel: ({ max }) => `escalate at ${max}`,
  phrases: () => [
    '(Calm:) Hi, my internet has been down since this morning.',
    '(Annoyed:) This is the third time I have called and nobody has fixed it!',
    '(Still annoyed:) Are you kidding me? I already told you that. I want this fixed right now!',
  ],

  Controls({ state, setState, busy }) {
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="Escalate after">
          {MAXES.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={state.max === m}
              className={state.max === m ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ max: m })}
            >
              Escalate after {m}
            </button>
          ))}
        </div>
        <p className="note">
          Sets <code>frustration_max_count</code>. Presence checks stay at their defaults: with{' '}
          <code>presence_check_max_count</code> at 0, no FrustrationDetected arrived in our tests.
        </p>
      </>
    )
  },

  // A counter that fills toward frustration_max_count, then each event with the caller line it followed.
  Panel({ state, messages, status }) {
    if (status === 'idle' && !messages.length) return null
    const hits: Array<{ ms: number; count: number; escalated: boolean; said: string }> = []
    let said = ''
    for (const { ms, msg } of messages) {
      if (msg.type === 'ConversationText' && msg.role === 'user') said = String(msg.content)
      if (msg.type === 'FrustrationDetected') hits.push({ ms, count: Number(msg.count), escalated: msg.escalated === true, said })
    }
    const last = hits[hits.length - 1]
    const count = last?.count ?? 0
    const escalated = last?.escalated ?? false
    return (
      <div className={`afr${escalated ? ' afr--up' : ''}`} aria-label="Frustration counter">
        <div className="afr__head">
          <span className="afr__count">
            {count} / {state.max}
          </span>
          <ol className="afr__pips" aria-hidden="true">
            {Array.from({ length: state.max }, (_, i) => (
              <li key={i} className={i < count ? 'is-on' : ''} />
            ))}
          </ol>
          <span className="afr__flag">
            escalated: <code>{String(escalated)}</code>
          </span>
        </div>
        {escalated ? (
          <p className="afr__note">Escalated. This is where your app hands the caller to a person.</p>
        ) : (
          <p className="afr__note">{hits.length ? 'Frustration noticed. Keep going.' : 'No frustration yet. Calm turns do not count.'}</p>
        )}
        {hits.length > 0 && (
          <ol className="afr__lines">
            {hits.map((h, i) => (
              <li key={i}>
                <span className="afr__ms">{(h.ms / 1000).toFixed(1)} s</span> <code>count {h.count}</code>
                {h.escalated && <code className="afr__up">escalated</code>} {h.said && <q>{h.said}</q>}
              </li>
            ))}
          </ol>
        )}
      </div>
    )
  },
})
