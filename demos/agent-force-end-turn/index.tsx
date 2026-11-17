// Agent ForceEndTurn: push-to-talk for a voice agent. Hold the button while you talk and let go to
// end your turn; the page sends {"type":"ForceEndTurn"} and the agent answers at once. With
// eot_threshold 1.0 Flux never ends a turn on its own (eot_timeout_ms 30000 is the backstop).
// Checked live 2026-11-16 on wss://agent.deepgram.com/v1/agent/converse, listen flux-general-en
// with version "v2", a 2.9 s macOS-voice line ("So for the trip I was thinking we could maybe, um")
// streamed in real time after 1 s of silence, then silence:
//   eot_threshold 1.0, eot_timeout_ms 30000, no ForceEndTurn: UserStartedSpeaking, then nothing;
//     no user ConversationText, no EndOfTurn, no reply in 9 s.
//   Same, ForceEndTurn 0.9 s after the line ended: 100 ms later the user's ConversationText and
//     {"type":"EndOfTurn","trigger":"manual"} in the same ms, first reply audio 0.72 s after the
//     press (LatencyReport total_latency 0.70).
//   A second ForceEndTurn with no turn in progress: nothing came back, no Warning, socket stayed
//     open (the Flux STT socket sends FORCE_END_TURN_NO_ACTIVE_TURN here; the agent does not).
//   eot_threshold 0.7, no ForceEndTurn: EndOfTurn "trigger":"model" 1.6 s after the line ended.
//   Nova-3 listen: every ForceEndTurn got Warning FORCE_END_TURN_UNSUPPORTED ("ForceEndTurn
//     requires a Deepgram v2 (Flux) listen provider. The current turn was not ended."), and
//     Nova-3 had already ended the turn on its own. So this demo is Flux only.
// The docs say AgentThinking follows ForceEndTurn; it never arrived. EndOfTurn with its trigger
// does arrive, though the agent docs do not mention it.
import { useEffect, useRef, useState } from 'react'
import type { AgentMessage } from '../../shared/agent/feature'
import { defineAgentFeature } from '../../shared/agent/feature'
import './styles.css'

type Who = 'you' | 'both'

interface State {
  // you: eot_threshold 1.0, only the button ends a turn (30 s backstop). both: Flux's default 0.7.
  who: Who
}

export const FORCE = { type: 'ForceEndTurn' }
const LABEL = 'End my turn'

// The docs' own-turn-detection recipe: 1.0 keeps Flux from ending a turn, the timeout is a backstop.
export function listenFor(who: Who) {
  return who === 'you' ? { version: 'v2', eot_threshold: 1.0, eot_timeout_ms: 30000 } : { version: 'v2', eot_threshold: 0.7 }
}

const TRIGGER: Record<string, string> = {
  manual: 'Ended by you',
  model: 'Ended by Flux',
  timeout: 'Ended by the timeout',
}

export interface Turn {
  ms: number
  trigger: string
  text: string
  // First reply audio after this EndOfTurn, ms after it.
  replyIn?: number
}

// Each EndOfTurn with the user's line that came with it and when the agent's audio started.
export function turnsOf(messages: AgentMessage[], audioStarts: number[]): Turn[] {
  const out: Turn[] = []
  let text = ''
  for (const { ms, msg } of messages) {
    if (msg.type === 'ConversationText' && msg.role === 'user') text = String(msg.content)
    if (msg.type === 'EndOfTurn') {
      const start = audioStarts.find((a) => a >= ms)
      out.push({ ms, trigger: String(msg.trigger ?? ''), text, replyIn: start === undefined ? undefined : start - ms })
      text = ''
    }
  }
  return out
}

// A release that no manual EndOfTurn answered within this long ended nothing.
const ANSWER_MS = 1500

// For each release (ms since Start): the manual EndOfTurn it caused, or none.
export function releasesOf(releases: number[], turns: Turn[], now: number) {
  const manual = turns.filter((t) => t.trigger === 'manual')
  return releases.map((ms) => {
    const hit = manual.find((t) => t.ms >= ms && t.ms - ms <= ANSWER_MS)
    return { ms, turnIn: hit ? hit.ms - ms : undefined, waiting: !hit && now - ms < ANSWER_MS }
  })
}

const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Let go to end your turn.',
    lede: 'Hold the button while you talk to the agent, and let go when you are done. The page sends ForceEndTurn, and the agent answers right away. Flux is set so it never ends a turn on its own, so pausing mid-sentence does not cut you off.',
    ctaTitle: 'Decide when the caller is done.',
    ctaBody: (
      <>
        Send <code>{'{"type":"ForceEndTurn"}'}</code> on the agent socket from a push-to-talk release, a Send button, or a
        keypad press. It needs a Flux listen provider. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-force-end-turn' },
  initialState: { who: 'you' },
  variants: [{ who: 'you' }, { who: 'both' }],
  // ForceEndTurn on Nova-3 is a FORCE_END_TURN_UNSUPPORTED warning, so Flux is the only choice.
  listenModels: [{ id: 'flux-general-en', label: 'Flux' }],
  listen: ({ who }) => listenFor(who),
  agent: () => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly travel planner. Answer in one or two short sentences.',
    },
    speak: { provider: { type: 'deepgram', version: 'v2', model: 'flux-wes-en' } },
    greeting: 'Hi! Hold the button while you talk, and let go when you are done.',
  }),
  highlight: ['eot_threshold', 'eot_timeout_ms'],
  events: ['EndOfTurn', 'UserStartedSpeaking'],
  flushOnUserSpeech: () => true,
  // Fired by the hold button in the Panel. With no turn in progress the agent sends nothing back.
  actions: () => [{ label: LABEL, message: FORCE, ack: [], hidden: true }],
  runLabel: ({ who }) => (who === 'you' ? 'only you end the turn' : 'you or Flux end the turn'),
  phrases: () => [
    '(Hold the button, then say, with a pause in the middle:) So for the trip I was thinking we could maybe... um...',
    '...go somewhere warm. (Let go.)',
  ],

  Controls({ state, setState, busy }) {
    return (
      <div className="field">
        <div className="segmented" role="radiogroup" aria-label="Who ends the turn">
          {(['you', 'both'] as Who[]).map((who) => (
            <button
              key={who}
              type="button"
              role="radio"
              aria-checked={state.who === who}
              className={state.who === who ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ who })}
            >
              {who === 'you' ? 'Only you (eot_threshold 1.0)' : 'You or Flux (eot_threshold 0.7)'}
            </button>
          ))}
        </div>
        <p className="note">
          {state.who === 'you'
            ? 'Flux waits however long you pause; only letting go of the button ends the turn (or 30 s of silence).'
            : 'Flux also ends the turn on its own when it hears you finish, so a long pause can cut you off before you let go.'}
        </p>
      </div>
    )
  },

  Panel({ status, messages, audioStarts, fire }) {
    const [holding, setHolding] = useState(false)
    const [releases, setReleases] = useState<number[]>([])
    const [now, setNow] = useState(0)
    // performance.now() at Start, worked out from the first message's ms, so a release can be timed
    // on the same clock as the server messages.
    const base = useRef<number | null>(null)
    useEffect(() => {
      if (!messages.length) {
        base.current = null
        setReleases([])
        return
      }
      if (base.current === null) base.current = performance.now() - messages[messages.length - 1].ms
      setNow(performance.now() - base.current)
    }, [messages])
    const live = status === 'live'
    useEffect(() => {
      if (!live) setHolding(false)
    }, [live])

    const press = () => live && setHolding(true)
    const release = () => {
      if (!holding) return
      setHolding(false)
      fire(LABEL)
      if (base.current !== null) setReleases((r) => [...r, performance.now() - base.current!])
    }

    const turns = turnsOf(messages, audioStarts)
    const rel = releasesOf(releases, turns, now)
    const missed = rel.filter((r) => r.turnIn === undefined && !r.waiting)
    return (
      <div className="fet">
        <button
          type="button"
          className={`btn btn--primary fet__hold${holding ? ' is-held' : ''}`}
          disabled={!live}
          aria-pressed={holding}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            press()
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault()
              press()
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              release()
            }
          }}
        >
          {holding ? 'Talking. Let go to end your turn' : 'Hold while you talk'}
        </button>
        <p className="note">The mic stays open the whole call. Letting go sends {'{"type":"ForceEndTurn"}'}.</p>
        {(turns.length > 0 || rel.length > 0) && (
          <ol className="fet__turns" aria-label="Turns">
            {turns.map((t, i) => {
              const r = rel.find((x) => x.turnIn !== undefined && x.ms + x.turnIn === t.ms)
              return (
                <li key={i} className={`fet__turn fet__turn--${t.trigger || 'unknown'}`}>
                  <span className="fet__who">{TRIGGER[t.trigger] ?? `EndOfTurn ${t.trigger}`}</span>
                  <span className="fet__text">{t.text ? `"${t.text}"` : '(no words)'}</span>
                  <span className="fet__ms">
                    {r && <>EndOfTurn {secs(r.turnIn!)} after you let go. </>}
                    {t.replyIn !== undefined ? <>Reply audio {secs(t.replyIn)} after EndOfTurn.</> : 'Waiting for the reply.'}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
        {missed.length > 0 && (
          <p className="note fet__missed">
            {missed.length === 1 ? 'One release' : `${missed.length} releases`} ended nothing: no turn was in progress, so the agent ignored
            ForceEndTurn and sent nothing back, not even a Warning.
          </p>
        )}
      </div>
    )
  },
})
