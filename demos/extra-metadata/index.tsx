// extra on Nova-3: tag a request with your own key:value pairs and get them back in the response.
// Checked live 2026-11-16 on /v1/listen streaming with a macOS-voice clip:
// extra=order_id%3AA1042&extra=team%3Asupport+desk came back as
// metadata.extra = {"order_id":"A1042","team":"support desk"} on every Results message, interim
// and final, and on the closing Metadata message. With no extra sent, metadata has no extra key.
// Flux refuses it: /v2/listen answers the handshake with 400 "Unknown query parameters: extra".
// Verified live 2026-11-16: ONLY=extra-metadata pnpm verify:live passed (both variants, two pairs and one pair, accepted on /v1/listen nova-3, plus the prompt URL); a streamed clip returned metadata.extra {"order_id":"A1042","team":"support desk"} on every Results message.
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

export interface Pair {
  key: string
  value: string
}

interface State {
  pairs: Pair[]
}

export const DEFAULT_PAIRS: Pair[] = [
  { key: 'order_id', value: 'A1042' },
  { key: 'team', value: 'support' },
]

// Deepgram allows 2048 characters per pair; a short cap keeps the demo's query small.
export const MAX_LENGTH = 64

// The first colon splits key from value, so neither side may contain one here.
const clean = (s: string) => s.replace(/:/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH)

// One extra=key:value per filled row. A row missing either side is skipped.
export function extraParams(pairs: readonly Pair[]): string[] {
  return pairs
    .map((p) => ({ key: clean(p.key), value: clean(p.value) }))
    .filter((p) => p.key && p.value)
    .map((p) => `${p.key}:${p.value}`)
}

// metadata.extra from a Nova Results message, exactly as Deepgram sent it.
export function echoedExtra(msg: Json): Record<string, unknown> | undefined {
  if (msg.type !== 'Results') return undefined
  const extra = (msg.metadata as Json | undefined)?.extra
  return extra && typeof extra === 'object' ? (extra as Record<string, unknown>) : undefined
}

export default defineFeature<State>({
  copy: {
    headline: 'Send an order ID. Get it back.',
    lede: 'Tag the request with your own key:value pairs, read the phrase, and Deepgram hands them back inside every transcript message, so the result already knows which order, call, or customer it belongs to.',
    ctaTitle: 'Add extra to your next request.',
    ctaBody: (
      <>
        <code>extra=key:value</code> works on Nova-3, on <code>/v1/listen</code>. Repeat it for more
        than one pair, and read them back from <code>metadata.extra</code>. New accounts start with
        $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/extra-metadata' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support extra yet (/v2/listen answers it with a 400).',
    },
  ],
  // Live mic only. What comes back does not depend on the words, so one run shows it.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic' }],
  initialState: { pairs: DEFAULT_PAIRS },
  variants: [{ pairs: DEFAULT_PAIRS }, { pairs: [DEFAULT_PAIRS[0], { key: '', value: '' }] }],

  // No filled rows means no extra param at all.
  params({ pairs }): Params {
    const list = extraParams(pairs)
    return list.length ? { extra: list } : {}
  },
  highlight: ['extra'],

  runLabel: ({ pairs }) => {
    const list = extraParams(pairs)
    return list.length ? `extra ${list.join(', ')}` : 'no extra'
  },

  phrases: ({ pairs }) => {
    const order = pairs.map((p) => clean(p.value)).find(Boolean)
    return [order ? `Hi, I'm calling about order ${order}. Can you tell me when it ships?` : 'Hi, I am calling about my order. Can you tell me when it ships?']
  },

  echo: (msg) => echoedExtra(msg),

  Controls({ state, setState, ctx }) {
    const setPair = (i: number, next: Pair) => setState({ pairs: state.pairs.map((p, j) => (j === i ? next : p)) })
    return (
      <div className="field extra-field">
        {state.pairs.map((p, i) => (
          <div className="extra-pair" key={i}>
            <input
              aria-label={`Key ${i + 1}`}
              placeholder="key"
              value={p.key}
              maxLength={MAX_LENGTH}
              disabled={ctx.busy}
              onChange={(e) => setPair(i, { ...p, key: e.target.value })}
            />
            <span aria-hidden="true">:</span>
            <input
              aria-label={`Value ${i + 1}`}
              placeholder="value"
              value={p.value}
              maxLength={MAX_LENGTH}
              disabled={ctx.busy}
              onChange={(e) => setPair(i, { ...p, value: e.target.value })}
            />
          </div>
        ))}
      </div>
    )
  },

  // metadata.extra from the newest Results message, straight from the response.
  Response({ latest }) {
    const extra = latest?.echoed as Record<string, unknown> | undefined
    if (!extra) {
      return (
        <span className="wire__key">
          {latest ? 'No extra came back. Fill in a key and a value, then run it again.' : 'metadata.extra from the response shows up here after a run.'}
        </span>
      )
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"metadata": {'{'} "extra":</span> <mark>{JSON.stringify(extra)}</mark>{' '}
        <span className="wire__key">{'}'}</span>
      </span>
    )
  },

  Result({ run, live }) {
    return (
      <PlainTranscript
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        live={live}
        emptyText="Your transcript shows up here. The pairs you sent come back on the Response card."
      />
    )
  },
})
