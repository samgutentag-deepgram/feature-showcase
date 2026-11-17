// Latency report: the per-stage timings the Voice Agent API sends on every turn, with no setting
// to turn on. Checked live 2026-11-16 with synthetic user speech (Aura-2 audio streamed at real time),
// gpt-4o-mini as the LLM and aura-2-thalia-en as the voice:
//   Every LatencyReport carries exactly one field, not the whole breakdown the docs' example shows.
//   A plain turn sends four, all within about 0.1 s of the reply's first audio: ttt_token_latency
//   0.49, ttt_text_latency 0.49, tts_latency 0.07, total_latency 0.59 (seconds).
//   A tool turn sends ttt_token 0.52 and ttt_tool 0.52, then after FunctionCallResponse ttt_token
//   again and ttt_text 1.20 (the tool round trip is inside it), tts 0.07, total 1.30.
//   stt_latency on Flux arrives about every 240 ms for the whole call, silence included, cycling
//   0 to 0.08 in 0.02 steps. On Nova-3 it arrives once per final user transcript (0.07 to 0.09).
//   ttt_thinking_latency never arrived (gpt-4o-mini does not think). flags.latency_report is
//   UNPARSABLE_CLIENT_MESSAGE: there is no switch, the reports always come.
// The panel groups the single-field reports into one row per turn and only shows fields that arrived.
import type { Json } from '../../shared/common/feature'
import { defineAgentFeature, type AgentPanelProps } from '../../shared/agent/feature'
import './styles.css'

interface State {
  tool: boolean
}

export const GET_WEATHER = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Call this whenever the caller asks about the weather.',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string', description: 'The city name, e.g. Paris' } },
    required: ['city'],
  },
}

// Demo data: it is always 18 C and cloudy. Real code would call a weather service here.
export function getWeather(args: Json): Json {
  return { city: String(args.city ?? 'unknown'), temp_c: 18, sky: 'cloudy', note: 'demo data' }
}

// Every field the docs list, in pipeline order. Anything else that shows up is appended after.
export const FIELDS: Array<[string, string]> = [
  ['stt_latency', 'STT'],
  ['ttt_token_latency', 'LLM first token'],
  ['ttt_thinking_latency', 'LLM first thinking'],
  ['ttt_tool_latency', 'LLM first tool call'],
  ['ttt_text_latency', 'LLM first text'],
  ['tts_latency', 'TTS'],
  ['total_latency', 'Total'],
]

export interface Turn {
  user: string
  reply: string
  // The latest value of each field this turn, in seconds.
  fields: Record<string, number>
  // stt_latency reports since the previous turn ended.
  sttCount: number
  closed: boolean
}

export interface Report {
  turns: Turn[]
  count: number
  stt: { count: number; last?: number; everyMs?: number }
  seen: string[]
  // The latest report other than stt_latency, which Flux sends all call long.
  last?: Json
}

// Groups single-field LatencyReport messages into turns. A turn opens on the user's final
// transcript (or on the first LLM report when no transcript came, e.g. an injected message) and
// closes on total_latency. A transcript that lands before the turn closes (Nova-3 can split one
// utterance in two) joins the open turn, and the later LLM reports replace the cancelled ones.
export function groupReports(messages: Array<{ ms: number; msg: Json }>): Report {
  const turns: Turn[] = []
  let open: Turn | undefined
  let stt: number | undefined
  let sttSince = 0
  const sttTimes: number[] = []
  const seen = new Set<string>()
  let count = 0
  let last: Json | undefined
  const start = (): Turn => {
    const t: Turn = { user: '', reply: '', fields: {}, sttCount: sttSince, closed: false }
    if (stt !== undefined) t.fields.stt_latency = stt
    sttSince = 0
    turns.push(t)
    return t
  }
  for (const { ms, msg } of messages) {
    if (msg.type === 'ConversationText' && msg.role === 'user') {
      if (open) {
        open.sttCount += sttSince
        sttSince = 0
      } else open = start()
      open.user = `${open.user} ${String(msg.content)}`.trim()
      if (stt !== undefined) open.fields.stt_latency = stt
      continue
    }
    if (msg.type === 'ConversationText' && msg.role === 'assistant') {
      const t = open ?? turns.at(-1)
      if (t && !t.reply) t.reply = String(msg.content)
      continue
    }
    if (msg.type !== 'LatencyReport') continue
    count++
    for (const [k, v] of Object.entries(msg)) {
      if (k === 'type' || typeof v !== 'number') continue
      seen.add(k)
      if (k === 'stt_latency') {
        stt = v
        sttSince++
        sttTimes.push(ms)
        continue
      }
      last = msg
      open = open ?? start()
      open.fields[k] = v
      if (k === 'total_latency') {
        open.closed = true
        open = undefined
      }
    }
  }
  const gaps = sttTimes.slice(1).map((t, i) => t - sttTimes[i])
  // The median gap, so the extra reports Flux sends around a turn's end do not skew it.
  const everyMs = gaps.length >= 3 ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : undefined
  const known = FIELDS.map(([k]) => k)
  return {
    turns,
    count,
    stt: { count: sttTimes.length, last: stt, everyMs },
    seen: [...known.filter((k) => seen.has(k)), ...[...seen].filter((k) => !known.includes(k))],
    last,
  }
}

const msText = (s?: number) => (s === undefined ? '' : `${Math.round(s * 1000)} ms`)
const labelOf = (k: string) => FIELDS.find(([f]) => f === k)?.[1] ?? k

// One bar per turn, laid end to end: STT, then the LLM's first text (or tool call), then TTS, with
// total_latency as the outline. The stages are measured separately, so they need not add up exactly.
function Waterfall({ turn, scale }: { turn: Turn; scale: number }) {
  const f = turn.fields
  const llm = f.ttt_text_latency ?? f.ttt_tool_latency ?? f.ttt_token_latency
  const parts: Array<[string, number | undefined]> = [
    ['stt', f.stt_latency],
    ['llm', llm],
    ['tts', f.tts_latency],
  ]
  let at = 0
  return (
    <div className="lat-bar" aria-hidden="true">
      {f.total_latency !== undefined && <span className="lat-bar__total" style={{ width: `${(f.total_latency / scale) * 100}%` }} />}
      {parts.map(([cls, v]) => {
        if (v === undefined) return null
        const left = at
        at += v
        return <span key={cls} className={`lat-bar__seg lat-bar__seg--${cls}`} style={{ left: `${(left / scale) * 100}%`, width: `${(v / scale) * 100}%` }} />
      })}
    </div>
  )
}

function LatencyPanel({ messages, status }: AgentPanelProps<State>) {
  const r = groupReports(messages)
  const cols = r.seen
  const scale = Math.max(
    0.5,
    ...r.turns.map((t) => {
      const f = t.fields
      const sum = (f.stt_latency ?? 0) + (f.ttt_text_latency ?? f.ttt_tool_latency ?? f.ttt_token_latency ?? 0) + (f.tts_latency ?? 0)
      return Math.max(sum, f.total_latency ?? 0)
    }),
  )
  return (
    <div className="lat" aria-live="polite">
      <div className="lat__head">
        <span className="lat__title">LatencyReport, per turn</span>
        <span className="lat__meta">
          {r.count} messages this run
          {r.stt.count > 0 && (
            <>
              , {r.stt.count} of them stt_latency{r.stt.everyMs ? `, one every ${Math.round(r.stt.everyMs)} ms` : ''}, last {msText(r.stt.last)}
            </>
          )}
        </span>
      </div>
      {r.turns.length === 0 ? (
        <p className="lat__empty">{status === 'idle' ? 'Start talking. Each turn lands here as a row once the agent answers.' : 'Waiting for your first turn.'}</p>
      ) : (
        <div className="lat__scroll">
          <table className="lat__table">
            <thead>
              <tr>
                <th>Turn</th>
                {cols.map((k) => (
                  <th key={k} title={k}>
                    {labelOf(k)}
                  </th>
                ))}
                <th className="lat__wide">Waterfall</th>
              </tr>
            </thead>
            <tbody>
              {r.turns.map((t, i) => (
                <tr key={i} className={t.closed ? '' : 'is-open'}>
                  <td className="lat__turn">
                    <span className="lat__num">{i + 1}</span>
                    {t.user && <span className="lat__said">{t.user}</span>}
                  </td>
                  {cols.map((k) => (
                    <td key={k} className="lat__val">
                      {msText(t.fields[k])}
                      {k === 'stt_latency' && t.sttCount > 1 && <span className="lat__of">last of {t.sttCount}</span>}
                    </td>
                  ))}
                  <td className="lat__wide">
                    <Waterfall turn={t} scale={scale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="lat__legend">
        <span className="lat__key lat__key--stt" /> STT <span className="lat__key lat__key--llm" /> LLM first text or tool call{' '}
        <span className="lat__key lat__key--tts" /> TTS <span className="lat__key lat__key--total" /> total_latency
      </p>
      {r.last && (
        <code className="lat__raw">
          last turn report: <mark>{JSON.stringify(r.last)}</mark>
        </code>
      )}
    </div>
  )
}

export default defineAgentFeature<State>({
  kind: 'agent',
  copy: {
    headline: 'Where does the time go?',
    lede: "Talk to the agent and each turn breaks down into speech-to-text, the LLM's first token, text-to-speech, and the total, straight from the LatencyReport messages Deepgram sends. Each message carries one number; the panel puts a turn's numbers in one row. Give the agent a tool and ask about the weather to see a tool call's time.",
    ctaTitle: 'Know which stage is slow.',
    ctaBody: (
      <>
        The Voice Agent API sends <code>LatencyReport</code> on every turn, with nothing to turn on. Log it
        next to your own timings. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/voice-agent-latency-report' },
  initialState: { tool: true },
  variants: [{ tool: true }, { tool: false }],
  agent: ({ tool }) => ({
    language: 'en',
    think: {
      provider: { type: 'open_ai', model: 'gpt-4o-mini' },
      prompt: 'You are a friendly assistant. Keep answers to one short sentence.',
      ...(tool ? { functions: [GET_WEATHER] } : {}),
    },
    speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
    greeting: 'Hi. Ask me anything.',
  }),
  highlight: ['functions'],
  events: ['EndOfTurn', 'FunctionCallRequest'],
  flushOnUserSpeech: () => true,
  functionExample: { name: GET_WEATHER.name, args: { city: 'Paris' } },
  onFunctionCall: (name, args) => (name === GET_WEATHER.name ? getWeather(args) : { error: `no function named ${name}` }),
  runLabel: ({ tool }) => (tool ? 'with get_weather' : 'no tools'),
  phrases: ({ tool }) => [tool ? 'What is the weather in Paris right now?' : 'What is the capital of France?'],

  Controls({ state, setState, busy }) {
    return (
      <label className="check">
        <input type="checkbox" checked={state.tool} disabled={busy} onChange={(e) => setState({ tool: e.target.checked })} />
        Give the agent a get_weather function (a tool turn reports its own first-token time)
      </label>
    )
  },

  Panel: LatencyPanel,
})
