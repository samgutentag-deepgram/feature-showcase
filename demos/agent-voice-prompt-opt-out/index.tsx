// Voice prompt opt-out: Think-Fast, Deepgram's own LLM (Early Access), gets spoken-style instructions
// placed ahead of your prompt unless agent.think.provider.voice_prompt_opt_out is true.
// Probed live 2026-11-16 (Flux listen, InjectUserMessage "Order A1234, pickup at 9 AM tomorrow, my
// number is 415-555-0123.", the prompt below, which asks for digits):
//   voice_prompt_opt_out false (or left out): Warning VOICE_PROMPT_ADDED before SettingsApplied, every
//   run. Over 4 runs, 3 spelled the order out ("A one two three four") and 4 said "nine" for the
//   time, overriding the prompt; 3 opened with a separate short line ("Thanks!", "Let me confirm.").
//   voice_prompt_opt_out true: no Warning, every run. 4 of 4 kept "A1234" as written, 3 of 4 kept
//   "9 AM", 2 of 4 opened with a short line. The phone number came out spelled ("four one five...")
//   in 6 of 8 runs across both:
//   Think-Fast itself leans spoken, so the instructions are a push, not a switch.
//   With a vaguer prompt the added instructions also brought filler lines ("Let me look up that
//   order.") and once a raw "<tool_call>" text line with no functions defined.
// Verified live 2026-11-16: pnpm verify:live applied both Settings (voice_prompt_opt_out false and true) with Flux and Nova-3 listen; false also brought Warning VOICE_PROMPT_ADDED, the InjectUserMessage test line came back as ConversationText, prompt.md requests worked, and the docs link resolved. Separate probes: true never sent the warning (6 of 6 runs).
import type { AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

interface State {
  optOut: boolean
}

export const WARNING = 'VOICE_PROMPT_ADDED'
export const LINE = 'Order A1234, pickup at 9 AM tomorrow, my number is 415-555-0123.'
export const PROMPT =
  "You are the order desk for Acme. Read the caller's order number, pickup time and phone number back in one sentence and ask if that is right. Write numbers as digits, exactly as the caller gave them."
const SEND = 'Send the test line'

const NUMBER_WORDS = 'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve'
const PART = new RegExp(`(\\d[\\d:\\-]*|\\b(?:${NUMBER_WORDS})\\b)`, 'gi')

// Splits a reply into plain text, numbers written as digits, and numbers spoken as words.
export function numberParts(text: string): { text: string; kind: 'plain' | 'digits' | 'words' }[] {
  return text
    .split(PART)
    .filter(Boolean)
    .map((t) => ({ text: t, kind: /^\d/.test(t) ? 'digits' : new RegExp(`^(?:${NUMBER_WORDS})$`, 'i').test(t) ? 'words' : 'plain' }))
}

// What this run showed: the warning, if any, and the agent's lines.
export function summarize(messages: AgentMessage[]) {
  const warning = messages.find((m) => m.msg.type === 'Warning' && m.msg.code === WARNING)
  const replies = messages.filter((m) => m.msg.type === 'ConversationText' && m.msg.role === 'assistant').map((m) => String(m.msg.content))
  return { warning: warning ? String(warning.msg.description ?? '') : '', replies }
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Send your prompt as written.',
    lede: "Think-Fast, Deepgram's own LLM, is tuned for voice: Deepgram puts spoken-style instructions ahead of your prompt and tells you so with a VOICE_PROMPT_ADDED warning. This prompt asks for digits. Send the test line with the opt-out off, then on, and compare the two runs below: watch the warning and the order number.",
    ctaTitle: 'Decide how your agent says numbers.',
    ctaBody: (
      <>
        Set <code>agent.think.provider.voice_prompt_opt_out</code> to <code>true</code> and Think-Fast gets your prompt
        unchanged. Think-Fast is in Early Access. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/llm/voice-agent' },
  initialState: { optOut: false },
  variants: [{ optOut: false }, { optOut: true }],
  agent: ({ optOut }) => ({
    language: 'en',
    think: {
      provider: { type: 'deepgram', model: 'think-fast', voice_prompt_opt_out: optOut },
      prompt: PROMPT,
    },
    speak: { provider: { type: 'deepgram', model: 'flux-wes-en' } },
  }),
  expects: ({ optOut }) => (optOut ? {} : { warning: WARNING }),
  highlight: ['voice_prompt_opt_out'],
  events: ['Warning'],
  flushOnUserSpeech: () => true,
  actions: () => [{ label: SEND, message: { type: 'InjectUserMessage', content: LINE }, ack: ['ConversationText'], primary: true }],
  runLabel: ({ optOut }) => (optOut ? 'opt-out on: your prompt only' : 'opt-out off: voice prompt added'),
  phrases: () => [`(Press ${SEND} once connected, or say:) ${LINE.replace('A1234', 'A one two three four')}`],

  Controls({ state, setState, busy }) {
    return (
      <>
        <label className="check">
          <input type="checkbox" checked={state.optOut} disabled={busy} onChange={(e) => setState({ optOut: e.target.checked })} />
          Opt out of the voice prompt (<code>voice_prompt_opt_out</code>)
        </label>
        <p className="note">
          <span className="vpo-tag">Early access</span> Think-Fast only. In our runs the phone number came out spelled most
          times either way; the order number and time are where the opt-out shows.
        </p>
      </>
    )
  },

  Panel({ state, status, messages }) {
    const { warning, replies } = summarize(messages)
    const started = status !== 'idle' || messages.length > 0
    if (!started) return <p className="note vpo-wait">Press Start, then {SEND}. Run it once with the opt-out off and once on: the two runs land side by side below.</p>
    const applied = messages.some((m) => m.msg.type === 'SettingsApplied')
    return (
      <section className="vpo" aria-label="This run" aria-live="polite">
        <p className={warning ? 'vpo-warn is-on' : 'vpo-warn'}>
          <span className="vpo-warn__code">{warning ? `Warning ${WARNING}` : applied ? `No ${WARNING} warning` : 'Waiting for SettingsApplied'}</span>
          {warning ? <span className="vpo-warn__text">{warning}</span> : applied && <span className="vpo-warn__text">voice_prompt_opt_out is {String(state.optOut)}: Think-Fast got the prompt unchanged.</span>}
        </p>
        {replies.length > 0 && (
          <div className="vpo-replies">
            <span className="vpo-replies__key">
              <span className="vpo-n vpo-n--digits">digits</span> <span className="vpo-n vpo-n--words">spoken</span>
            </span>
            {replies.map((r, i) => (
              <p key={i} className="vpo-reply">
                {numberParts(r).map((p, k) => (p.kind === 'plain' ? <span key={k}>{p.text}</span> : <span key={k} className={`vpo-n vpo-n--${p.kind}`}>{p.text}</span>))}
              </p>
            ))}
          </div>
        )}
      </section>
    )
  },
})
