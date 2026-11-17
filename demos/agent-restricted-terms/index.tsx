// Think Live restricted_terms: words the Think Live model will not say in its own lines.
// Probed live 2026-11-16 on the Agent API, gpt-4o-mini thinking, silent mic audio, presence checks
// every 3 s (count 3):
//   Default list (field left out), Flux listening, 3 runs: 8 presence checks, every one used "still"
//   or "there" ("Still on the line?", "Hello? Are you still there?", "Are you still with me?").
//   restricted_terms ["still", "there"], Flux 3 runs and Nova-3 1 run: 8 presence checks, none used
//   either word ("I'm here whenever you're ready.", "Did you need anything else?").
//   No Warning or other message says a term was held back; only the wording changes.
//   The reasoning LLM is not bound, as the docs say: restricted ["refund"], InjectUserMessage "Can I
//   get a refund on my order?", reply "...assist you with the refund process."
//   restricted_terms [] applied fine. A string instead of an array: Error UNPARSABLE_CLIENT_MESSAGE.
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  restrict: boolean
}

export const TERMS = ['still', 'there']
const ASIDES = ['presence_check', 'backchannel', 'filler']

const thinkLive = (restrict: boolean): Json => ({
  provider: {
    type: 'deepgram',
    version: 'v1',
    presence_check_max_count: 3,
    presence_check_interval_ms: 3000,
    ...(restrict ? { restricted_terms: TERMS } : {}),
  },
})

// Whole words only, so "here" in "I'm here" does not count as "there".
const hits = (text: string): string[] => TERMS.filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(text))

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Keep words out of its mouth.',
    lede: 'Think Live checks in when you go quiet, and it almost always asks "are you still there?" Ban "still" and "there" with restricted_terms and stay silent again: the check-ins come back reworded. Run it both ways and compare the two transcripts.',
    ctaTitle: 'Set what your agent never says.',
    ctaBody: (
      <>
        Add <code>restricted_terms</code> to <code>agent.think_live.provider</code>. It binds the Think Live
        model only: your LLM's replies still follow your prompt. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-think-live' },
  initialState: { restrict: true },
  variants: [{ restrict: true }, { restrict: false }],
  agent: ({ restrict }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a support agent for Acme. Help with orders. Keep replies to one short sentence.',
    },
    think_live: thinkLive(restrict),
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, this is Acme support. How can I help?',
  }),
  highlight: ['restricted_terms'],
  events: ['ConversationText presence_check', 'ConversationText backchannel'],
  flushOnUserSpeech: () => true,
  runLabel: ({ restrict }) => (restrict ? 'restricted: still, there' : 'default list: human, transfer'),
  phrases: () => ['(Say nothing after the greeting. A check-in comes about every 6 seconds, three in all.)', '(Then flip the switch, start again, and stay quiet.)'],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.restrict} disabled={busy} onChange={(e) => setState({ restrict: e.target.checked })} />
          Restrict "still" and "there"
        </label>
        <p className="note">
          Off leaves the field out, so the default list applies: <code>["human", "transfer"]</code>. The last two runs
          stay side by side below.
        </p>
      </>
    )
  },

  // This run's Think Live lines, each checked for the two words.
  Panel({ messages, status, state }) {
    const lines = messages
      .filter(({ msg }) => msg.type === 'ConversationText' && ASIDES.includes(String(msg.conversational_behavior)))
      .map(({ ms, msg }) => ({ ms, kind: String(msg.conversational_behavior), text: String(msg.content), found: hits(String(msg.content)) }))
    if (!lines.length) return status === 'idle' ? null : <p className="note rt__empty">Waiting for a check-in. Stay quiet.</p>
    const used = lines.filter((l) => l.found.length).length
    return (
      <div className="rt" aria-label="Think Live lines this run">
        <h3 className="rt__head">
          {state.restrict ? 'Restricted' : 'Not restricted'}
          <span className="rt__count">
            {used} of {lines.length} used "still" or "there"
          </span>
        </h3>
        <ol className="rt__lines">
          {lines.map((l, i) => (
            <li key={i} className={l.found.length ? 'rt__line rt__line--hit' : 'rt__line'}>
              <span className="rt__ms">{(l.ms / 1000).toFixed(1)} s</span> <code>{l.kind}</code> {l.text}
              {l.found.length > 0 && <span className="rt__found">{l.found.join(', ')}</span>}
            </li>
          ))}
        </ol>
      </div>
    )
  },
})
