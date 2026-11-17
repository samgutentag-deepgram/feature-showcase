// Agent keyterms: agent.listen.provider.keyterms makes the agent hear product names right.
// Checked live 2026-11-16 on the Agent API with a macOS voice reading "Hi, I want to order the
// Kallistrum Pro. Can you check if Kallistrum ships to Ohio?":
//   flux-general-en, no keyterms: user "Kolestrum" twice, agent repeated "Kolestrum Pro".
//   flux-general-en, keyterms ["Kallistrum"]: user "Kallistrum" twice, agent "Kallistrum Pro".
//   nova-3, no keyterms: "Colistrum" twice. nova-3 with keyterms: "Kallistrum" twice.
// Same result on Flux with version v2. Settings with keyterms came back SettingsApplied on both models.
import type { FC } from 'react'
import type { AgentPanelProps } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import type { Json } from '../../shared/common/feature'
import './styles.css'

interface State {
  on: boolean
  // What the visitor typed: terms separated by commas.
  terms: string
}

export const DEFAULT_TERMS = 'Kallistrum, Vexmoor'
// A short list keeps the demo well under Deepgram's keyterm token cap.
export const MAX_TERMS = 10
export const MAX_TERM_LENGTH = 50

export function parseTerms(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[,\n]/)) {
    const term = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TERM_LENGTH)
    if (term && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase())
      out.push(term)
    }
  }
  return out.slice(0, MAX_TERMS)
}

const sent = (state: State) => (state.on ? parseTerms(state.terms) : [])

// A line for the visitor to say that uses every term typed, so the agent has each one to repeat.
export function phraseFor(terms: readonly string[]): string {
  const [a, b, ...rest] = terms
  if (!a) return 'Type a product name above, made-up ones work best.'
  const base = b ? `Hi, I want to order the ${a} Pro. Does it work with ${b}?` : `Hi, I want to order the ${a} Pro. Can you check if ${a} ships today?`
  return rest.length ? `${base} I also use ${rest.join(', ')}.` : base
}

// Splits text into plain and matched pieces, so the terms the agent heard right are marked.
export function markTerms(text: string, terms: readonly string[]): Array<{ text: string; hit: boolean }> {
  if (!terms.length) return [{ text, hit: false }]
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  const out: Array<{ text: string; hit: boolean }> = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false })
    out.push({ text: m[0], hit: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false })
  return out
}

// What the agent's speech-to-text wrote down for the caller this run, with the typed terms marked,
// and which of them it never heard.
const Heard: FC<AgentPanelProps<State>> = ({ state, messages }) => {
  const terms = parseTerms(state.terms)
  const said = messages
    .map(({ msg }) => msg as Json)
    .filter((m) => m.type === 'ConversationText' && m.role === 'user')
    .map((m) => String(m.content))
  const all = said.join(' ').toLowerCase()
  return (
    <div className="kt-heard" aria-live="polite">
      <span className="wire__label">What the agent heard you say</span>
      {said.length === 0 ? (
        <p className="note">Your words show up here as the agent's speech-to-text wrote them, with your terms marked.</p>
      ) : (
        <>
          {said.map((line, i) => (
            <p key={i} className="kt-heard__line">
              {markTerms(line, terms).map((p, j) => (p.hit ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>))}
            </p>
          ))}
          <p className="kt-heard__tally">
            {terms.map((t) => (
              <span key={t} className={all.includes(t.toLowerCase()) ? 'kt-tag is-hit' : 'kt-tag'}>
                {t}: {all.includes(t.toLowerCase()) ? 'heard' : 'missed'}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Did it hear Kallistrum?',
    lede: 'A made-up product name trips up any speech model the first time, and the agent then repeats it back wrong. Say the line once without keyterms, then send your product names in the listen provider and say it again.',
    ctaTitle: 'Teach your agent your product names.',
    ctaBody: (
      <>
        Add <code>keyterms</code> to <code>agent.listen.provider</code> in the Settings message. It works with Flux and
        Nova-3. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/configure-voice-agent' },
  initialState: { on: false, terms: DEFAULT_TERMS },
  // On first: prompt.md shows the first of equally sized agent blocks, and it should show keyterms.
  variants: [
    { on: true, terms: DEFAULT_TERMS },
    { on: false, terms: DEFAULT_TERMS },
  ],
  // Flux takes version v2, as the docs show. Off means no keyterms field at all, not an empty one.
  listen: (state, model) => {
    const terms = sent(state)
    return { ...(model.startsWith('flux') ? { version: 'v2' } : {}), ...(terms.length ? { keyterms: terms } : {}) }
  },
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt:
        'You take orders for a small electronics shop. When the caller names a product, first repeat back the product name exactly as it appears in their message, spelled the same way, then ask one short follow-up question. Keep every answer to one or two short sentences.',
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi, thanks for calling. Which product would you like to order?',
  }),
  highlight: ['keyterms'],
  events: [],
  flushOnUserSpeech: () => true,
  runLabel: (state) => (sent(state).length ? `keyterms ${sent(state).join(', ')}` : 'no keyterms'),
  phrases: (state) => [phraseFor(parseTerms(state.terms))],

  Controls({ state, setState, busy }) {
    return (
      <div className="field kt-field">
        <label className="check">
          <input type="checkbox" checked={state.on} disabled={busy} onChange={(e) => setState({ ...state, on: e.target.checked })} />
          Send keyterms
        </label>
        <input
          className="kt-input"
          type="text"
          aria-label="Product names, separated by commas"
          value={state.terms}
          // Editable while off too, so the suggested line uses your own names before the first run.
          disabled={busy}
          onChange={(e) => setState({ ...state, terms: e.target.value })}
        />
      </div>
    )
  },
  Panel: Heard,
})
