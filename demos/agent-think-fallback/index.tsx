// Think fallback: agent.think as an ordered list. Break the first provider and the second answers.
// Probed live 2026-11-16, Flux listening, silence streaming, InjectUserMessage as the question:
//   How to break the first provider and keep every request inside managed providers Deepgram
//     already uses: open_ai gpt-4o-mini with temperature 5. Settings applies, and OpenAI refuses
//     each try with 400 "Invalid 'temperature': decimal above maximum value. Expected a value <= 2"
//     (OpenAI's documented range is 0 to 2). No key, no endpoint, and the model is a current one.
//     Anthropic claude-haiku-4-5 with temperature 5 fails the same way (400 invalid_request_error).
//   Tried and dropped: endpoint.url https://example.com/v1/chat/completions (RFC 2606) failed at think
//     time with 405, but it sends every visitor question and the prompt to a host we do not control.
//     https://example.invalid/... and https://192.0.2.1/... came back Error INVALID_SETTINGS at
//     Settings ("Failed to resolve endpoint", "Invalid endpoint"). A made-up model on a managed
//     provider (anthropic claude-does-not-exist, google gemini-does-not-exist) is INVALID_SETTINGS at
//     Settings too. open_ai gpt-4.1-nano fails at think time (404 upstream) but would start working
//     if the model came back.
//   Broken, [gpt-4o-mini at temperature 5, anthropic claude-haiku-4-5]: three Warning
//     THINK_REQUEST_FAILED (400 Bad Request) within about 0.5 s of the question, then the reply.
//     Asked "Which company trained you?", it said "Anthropic"; with both up, it said "OpenAI".
//   Later turns in the same session: no Warnings, and Anthropic still answered, at normal speed.
//   On the failover turn the fallback got the first provider's prompt: with a prompt per provider
//     that names it, turn 1 began "OpenAI here." although Anthropic answered; turns 2 and 3 began
//     "Anthropic here.".
//   Cost of the detour, first reply, total_latency from LatencyReport: gpt-4o-mini alone 0.47 to
//     0.58 s, claude-haiku-4-5 alone 0.42 to 0.45 s, broken then claude-haiku-4-5 0.88 to 0.98 s.
//     About half a second, once: the three refused tries are real round trips to OpenAI.
// Docs mismatches (https://developers.deepgram.com/docs/voice-agent-llm-models): the docs say each
// new turn starts again from the first provider, but later turns went straight to the fallback with
// no Warnings; the docs describe one Warning per failure, but each failed provider sent three.
// Verified live 2026-11-16: ONLY=agent-think-fallback pnpm verify:live passed. With Flux and
//   Nova-3 listening, both Settings (first LLM at temperature 5, and both up) came back
//   SettingsApplied with no Error, Ask who answered came back AgentAudioDone in both (with the first
//   LLM broken, only the Anthropic fallback could have replied), and the prompt.md Settings worked
//   with a granted token.
import { useEffect, useState } from 'react'
import { defineAgentFeature, type AgentMessage } from '../../shared/agent/feature'
import './styles.css'

interface State {
  broken: boolean
}

// Above OpenAI's 0 to 2 range: Settings applies, and OpenAI refuses every request with a 400.
export const BAD_TEMPERATURE = 5
const PROMPT = 'You are a helpful voice assistant. Answer in one short sentence.'
const QUESTION = 'Which company trained you? Answer in a few words.'
const FIRST = 'OpenAI gpt-4o-mini'
const SECOND = 'Anthropic claude-haiku-4-5'

const secs = (s: number) => `${s.toFixed(2)} s`
const oneLine = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

interface Turn {
  ms: number
  question: string
  warnings: { ms: number; code: string; why: string }[]
  reply: string
  replyMs?: number
  total?: number
  failed?: string
}

// The turns of a run: each user line, the Warnings after it, the agent's reply, and the reply's
// total_latency from LatencyReport.
export function turns(messages: AgentMessage[]): Turn[] {
  const out: Turn[] = []
  for (const { ms, msg } of messages) {
    const cur = out[out.length - 1]
    if (msg.type === 'ConversationText' && msg.role === 'user') out.push({ ms, question: oneLine(msg.content), warnings: [], reply: '' })
    else if (!cur) continue
    else if (msg.type === 'Warning') {
      const code = String(msg.code ?? '')
      const status = /Code: ([^.]+)\./.exec(String(msg.description ?? ''))
      cur.warnings.push({ ms, code, why: status ? status[1] : oneLine(msg.description).slice(0, 80) })
    } else if (msg.type === 'Error') cur.failed = `${msg.code ?? 'Error'}: ${oneLine(msg.description ?? msg.message)}`
    else if (msg.type === 'ConversationText' && msg.role === 'assistant') {
      cur.reply = cur.reply ? `${cur.reply} ${oneLine(msg.content)}` : oneLine(msg.content)
      cur.replyMs ??= ms
    } else if (msg.type === 'LatencyReport' && typeof msg.total_latency === 'number' && cur.reply && cur.total === undefined) cur.total = msg.total_latency
  }
  return out
}

// The first reply's total_latency from the latest run of each setting, kept while the page is open.
const lastFirst: { up?: number; broken?: number } = {}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Break the first LLM. The agent still answers.',
    lede: 'Here agent.think is a list: OpenAI gpt-4o-mini first, Anthropic claude-haiku-4-5 second. Tick Break the first LLM to give the first one temperature 5, outside the 0 to 2 that OpenAI accepts, so OpenAI refuses every request. Start talking and ask a question: three THINK_REQUEST_FAILED Warnings arrive, then the second provider answers. The panel shows each Warning, who answered, and what the detour cost.',
    ctaTitle: 'Give think a backup.',
    ctaBody: (
      <>
        Send <code>agent.think</code> as an array, with the fallback on other infrastructure. A dead primary
        then costs three <code>Warning</code>s and about half a second, not the turn. New accounts start
        with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-llm-models' },
  initialState: { broken: true },
  variants: [{ broken: true }, { broken: false }],
  agent: ({ broken }) => ({
    think: [
      { provider: { type: 'open_ai', model: 'gpt-4o-mini', ...(broken ? { temperature: BAD_TEMPERATURE } : {}) }, prompt: PROMPT },
      { provider: { type: 'anthropic', model: 'claude-haiku-4-5' }, prompt: PROMPT },
    ],
    speak: { provider: { type: 'deepgram', model: 'flux-wes-en' } },
  }),
  actions: () => [{ label: 'Ask who answered', message: { type: 'InjectUserMessage', content: QUESTION }, ack: ['AgentAudioDone'], primary: true }],
  highlight: ['think', 'temperature'],
  events: ['Warning', 'Error'],
  flushOnUserSpeech: () => true,
  runLabel: ({ broken }) => (broken ? 'first LLM broken' : 'both LLMs up'),
  phrases: () => ['Which company trained you?', 'What is the capital of France?'],

  Controls({ state, setState, busy }) {
    return (
      <div className="atf-pick">
        <label className="check">
          <input type="checkbox" checked={state.broken} disabled={busy} onChange={(e) => setState({ broken: e.target.checked })} />
          Break the first LLM
        </label>
        <ol className="atf-chain">
          <li className={state.broken ? 'is-down' : ''}>
            <strong>{FIRST}</strong>
            {state.broken ? (
              <>
                {' '}with <code>temperature: {BAD_TEMPERATURE}</code>, which OpenAI refuses with a 400
              </>
            ) : (
              ', managed by Deepgram'
            )}
          </li>
          <li>
            <strong>{SECOND}</strong>, managed by Deepgram
          </li>
        </ol>
      </div>
    )
  },

  Panel({ state, status, messages, audioStarts }) {
    const list = turns(messages)
    const firstTotal = list[0]?.total
    const key = state.broken ? 'broken' : 'up'
    const [seen, setSeen] = useState({ ...lastFirst })
    useEffect(() => {
      if (firstTotal === undefined) return
      lastFirst[key] = firstTotal
      setSeen({ ...lastFirst })
    }, [firstTotal, key])

    let failedOver = false
    return (
      <div className="atf" aria-live="polite">
        <div className="atf__title">Turns this run</div>
        {list.length === 0 ? (
          <p className="note atf__empty">
            {status === 'idle' ? 'Press Start talking, then ask a question out loud or press Ask who answered.' : 'Ask a question.'}{' '}
            {state.broken ? 'Expect three THINK_REQUEST_FAILED Warnings, then a reply from Anthropic.' : 'Expect a reply from OpenAI and no Warnings.'}
          </p>
        ) : (
          <ol className="atf__turns">
            {list.map((t, i) => {
              const fresh = t.warnings.length > 0
              failedOver ||= fresh
              const audio = audioStarts.find((a) => a >= t.ms)
              const who = failedOver ? SECOND : FIRST
              return (
                <li key={i} className="atf__turn">
                  <div className="atf__q">
                    <span className="atf__ms">{(t.ms / 1000).toFixed(1)} s</span> You: "{t.question}"
                  </div>
                  {t.warnings.map((w, j) => (
                    <div key={j} className="atf__warn">
                      <span className="atf__ms">+{secs((w.ms - t.ms) / 1000)}</span>
                      <span className="atf-badge">Warning</span> <code>{w.code}</code> {w.why}
                    </div>
                  ))}
                  {t.failed && <div className="atf__warn atf__warn--error">{t.failed}</div>}
                  {t.reply && (
                    <div className="atf__a">
                      Agent: "{t.reply}"
                      <div className="atf__who">
                        Answered by <strong>{who}</strong>
                        {fresh
                          ? ', after the first provider failed.'
                          : failedOver
                            ? '. No new Warnings: once it fell back, the session stayed on the fallback.'
                            : ', the first in the list.'}
                        {t.total !== undefined && (
                          <>
                            {' '}
                            Total latency <strong>{secs(t.total)}</strong>
                          </>
                        )}
                        {audio !== undefined && <> (first audio {secs((audio - t.ms) / 1000)} after your line)</>}.
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        <div className="atf__cost">
          <span>First reply, both up: {seen.up !== undefined ? <strong>{secs(seen.up)}</strong> : 'not run yet'}</span>
          <span>First reply, first LLM broken: {seen.broken !== undefined ? <strong>{secs(seen.broken)}</strong> : 'not run yet'}</span>
          {seen.up !== undefined && seen.broken !== undefined && (
            <span>
              Cost of falling back: <strong>{seen.broken - seen.up >= 0 ? '+' : ''}{secs(seen.broken - seen.up)}</strong>
            </span>
          )}
        </div>
        <p className="note atf__empty">
          Deepgram does not name the provider that answered; the page infers it from the Warnings. Ask "Which company
          trained you?" to hear it from the model. Run both settings to compare. In testing the first reply took 0.88 to
          0.98 s with the first LLM broken, and 0.47 to 0.58 s with both up.
        </p>
      </div>
    )
  },
})
