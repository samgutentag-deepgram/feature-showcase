// Live transcript: the ConversationText messages the Voice Agent API sends for both sides of the
// call, drawn as a chat with each line's arrival time. Probed live 2026-11-16 with synthetic user
// speech (Aura-2 audio streamed at real time), gpt-4o-mini as the LLM and flux-wes-en as the voice,
// on Flux and Nova-3:
//   Assistant text arrives one sentence at a time, each ConversationText landing with the first
//   audio chunk of that sentence (same 10 ms tick), not when its audio ends. A two-sentence reply
//   came as two messages 2.0 s apart; the greeting (two short sentences) came as one.
//   User text arrives once per turn, after the user stops: Flux sent it with EndOfTurn, 1.2 to
//   3.1 s after the turn's first UserStartedSpeaking (the speaking itself included).
//   No interim user ConversationText arrived on either model.
//   Nova-3 split "Stop. What is two plus two?" into two user lines; Flux sent it as one. Flux user
//   lines also carry "words": [] (not in the docs).
//   Barge-in (talking 1.9 s into a four-sentence reply): UserStartedSpeaking and AgentAudioDone
//   came together after 3.35 s of reply audio. The sentence that was playing had already been sent
//   in full, and no ConversationText came for the sentences after it, on both models. The next
//   reply came as usual.
// Verified live 2026-11-16: ONLY=agent-live-transcript pnpm verify:live passed. Both Settings
// variants (long and one-sentence answers) came back SettingsApplied on Flux and Nova-3, and the
// docs link resolved. ConversationText timing and barge-in behavior above come from separate live
// probes the same day.
// The panel groups assistant sentences into one reply and marks a reply interrupted when
// UserStartedSpeaking arrives before its AgentAudioDone, or while its audio is still playing here.
import { useRef } from 'react'
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

interface State {
  long: boolean
}

export const GREETING = 'Hi there. Ask me about any city.'

export interface Piece {
  // ms since Start.
  ms: number
  text: string
}

export interface Entry {
  role: 'user' | 'assistant'
  behavior: string
  pieces: Piece[]
  // Fields other than type, role, content, conversational_behavior, e.g. Flux's words.
  extra: string[]
  // user: when the first UserStartedSpeaking since the previous user line arrived.
  heardAt?: number
  // assistant: when the reply's first audio chunk arrived, and when AgentAudioDone came.
  audioAt?: number
  doneAt?: number
  // assistant: the UserStartedSpeaking that cut this reply off, and whether the server had already
  // sent all its audio by then (only the page's playback was cut).
  cutAt?: number
  cutAfterDone?: boolean
}

const KNOWN = new Set(['type', 'role', 'content', 'conversational_behavior'])

// Turns the run's server messages into chat entries. playingAt holds the indexes of the
// UserStartedSpeaking messages that arrived while agent audio was playing on the page.
export function buildTranscript(messages: Array<{ ms: number; msg: Json }>, audioStarts: number[], playingAt: Set<number> = new Set()): Entry[] {
  const out: Entry[] = []
  // The assistant reply the server is still sending (no AgentAudioDone yet).
  let open: Entry | undefined
  let lastReply: Entry | undefined
  let heard: number | undefined
  messages.forEach(({ ms, msg }, i) => {
    const type = msg.type
    if (type === 'ConversationText') {
      const role = msg.role === 'user' ? 'user' : 'assistant'
      const piece = { ms, text: String(msg.content ?? '') }
      const behavior = String(msg.conversational_behavior ?? 'default')
      const extra = Object.keys(msg).filter((k) => !KNOWN.has(k))
      if (role === 'assistant' && open && open.behavior === behavior) {
        open.pieces.push(piece)
        return
      }
      const e: Entry = { role, behavior, pieces: [piece], extra }
      if (role === 'user') {
        e.heardAt = heard
        heard = undefined
      } else {
        // Text and the first audio chunk land together; allow a little slack either way.
        const starts = audioStarts.filter((a) => a <= ms + 150)
        e.audioAt = starts.length ? starts[starts.length - 1] : undefined
        open = e
        lastReply = e
      }
      out.push(e)
      return
    }
    if (type === 'AgentAudioDone') {
      if (open) open.doneAt = ms
      open = undefined
      return
    }
    if (type === 'UserStartedSpeaking') {
      // Flux can send several in one turn; count from the first.
      if (heard === undefined) heard = ms
      if (open) {
        open.cutAt = ms
        open.cutAfterDone = false
        open = undefined
      } else if (lastReply && lastReply.cutAt === undefined && playingAt.has(i) && out[out.length - 1] === lastReply) {
        lastReply.cutAt = ms
        lastReply.cutAfterDone = true
      }
    }
  })
  return out
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`

function TranscriptPanel({ messages, audioStarts, playing, status }: AgentPanelProps<State>) {
  // Which UserStartedSpeaking messages arrived while agent audio was still playing here. The shell
  // stops the audio on that message, so read playing on the render that first sees it.
  const seen = useRef<{ count: number; playingAt: Set<number> }>({ count: 0, playingAt: new Set() })
  if (messages.length < seen.current.count) seen.current = { count: 0, playingAt: new Set() }
  for (let i = seen.current.count; i < messages.length; i++) if (messages[i].msg.type === 'UserStartedSpeaking' && playing) seen.current.playingAt.add(i)
  seen.current.count = messages.length

  const entries = buildTranscript(messages, audioStarts, seen.current.playingAt)
  // The clock starts at the first agent audio of the call (the greeting).
  const zero = audioStarts[0] ?? 0
  const at = (ms: number) => `${((ms - zero) / 1000).toFixed(1)} s`
  const texts = messages.filter((m) => m.msg.type === 'ConversationText')
  const users = texts.filter((m) => m.msg.role === 'user').length
  const replies = entries.filter((e) => e.role === 'assistant').length
  const last = texts[texts.length - 1]?.msg

  return (
    <div className="ct" aria-live="polite">
      <div className="ct__head">
        <span className="ct__title">ConversationText, as it arrives</span>
        <span className="ct__meta">
          {texts.length} messages: {users} user, {texts.length - users} assistant in {replies} {replies === 1 ? 'reply' : 'replies'}. Times count from the first agent audio.
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="ct__empty">{status === 'idle' ? 'Start talking. Each ConversationText lands here with the time it arrived.' : 'Waiting for the greeting.'}</p>
      ) : (
        <ol className="ct__chat">
          {entries.map((e, i) =>
            e.role === 'user' ? (
              <li key={i} className="ct__msg ct__msg--user">
                <span className="ct__who">You</span>
                {e.pieces.map((p, j) => (
                  <p className="ct__piece" key={j}>
                    <span className="ct__at">{at(p.ms)}</span>
                    <span className="ct__text">{p.text}</span>
                  </p>
                ))}
                <span className="ct__note">
                  {e.heardAt !== undefined ? `${secs(e.pieces[0].ms - e.heardAt)} after UserStartedSpeaking` : 'final text'}
                  {e.extra.length > 0 ? `; extra field ${e.extra.join(', ')}` : ''}
                </span>
              </li>
            ) : (
              <li key={i} className={`ct__msg ct__msg--agent${e.cutAt !== undefined ? ' is-cut' : ''}${e.behavior !== 'default' ? ' is-aside' : ''}`}>
                <span className="ct__who">
                  Agent{e.behavior !== 'default' ? `, ${e.behavior.replace('_', ' ')}` : ''}
                  {e.cutAt !== undefined && <span className="ct__flag">Interrupted</span>}
                </span>
                {e.pieces.map((p, j) => (
                  <p className="ct__piece" key={j}>
                    <span className="ct__at">{at(p.ms)}</span>
                    <span className="ct__text">{p.text}</span>
                    {e.audioAt !== undefined && <span className="ct__into">+{secs(Math.max(0, p.ms - e.audioAt))} into its audio</span>}
                  </p>
                ))}
                <span className="ct__note">
                  {e.pieces.length} {e.pieces.length === 1 ? 'message' : 'messages'}
                  {e.cutAt !== undefined && e.audioAt !== undefined
                    ? e.cutAfterDone
                      ? `. You cut in ${secs(e.cutAt - e.audioAt)} into its audio, after AgentAudioDone: every line had arrived, only playback stopped.`
                      : `. You cut in ${secs(e.cutAt - e.audioAt)} into its audio, before AgentAudioDone. The last line above arrived in full; nothing after it did.`
                    : e.doneAt !== undefined && e.audioAt !== undefined
                      ? `, AgentAudioDone at +${secs(e.doneAt - e.audioAt)}`
                      : ', still speaking'}
                </span>
              </li>
            ),
          )}
        </ol>
      )}
      {last && (
        <code className="ct__raw">
          last message: <mark>{JSON.stringify(last)}</mark>
        </code>
      )}
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Read the call as it happens.',
    lede: "Talk to the agent and every ConversationText lands in a chat with the time it arrived. The agent's text comes one sentence at a time, as each sentence starts to play. Your text comes once, when you stop talking. Ask for a long answer, then talk over it: the line that was playing still shows in full, and the rest of the answer never arrives.",
    ctaTitle: 'Put the conversation on screen.',
    ctaBody: (
      <>
        The Voice Agent API sends <code>ConversationText</code> for both sides of the call, with nothing to
        turn on. Render it as captions or a chat log. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-conversation-text' },
  initialState: { long: true },
  variants: [{ long: true }, { long: false }],
  agent: ({ long }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: long ? 'You are a friendly travel guide. Answer in four or five full sentences.' : 'You are a friendly travel guide. Answer in one short sentence.',
    },
    speak: { provider: { type: 'deepgram', model: 'flux-wes-en' } },
    greeting: GREETING,
  }),
  highlight: ['prompt'],
  events: ['ConversationText'],
  flushOnUserSpeech: () => true,
  runLabel: ({ long }) => (long ? 'long answers' : 'one-sentence answers'),
  phrases: () => ['Tell me about the history of Paris.', '(A few seconds into the answer, talk over it:)', 'Stop. What is two plus two?'],

  Controls({ state, setState, busy }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.long} disabled={busy} onChange={(e) => setState({ long: e.target.checked })} />
        Long answers (four or five sentences, so each one arrives in pieces)
      </label>
    )
  },

  Panel: TranscriptPanel,
})
