// dictation on Nova-3: spoken punctuation becomes punctuation. Verified live 2026-11-09 on
// /v1/listen streaming (macOS voice Samantha):
//   punctuate=true                 "Dear team, comma, the demo is live. Period. New paragraph. ..."
//   punctuate=true&dictation=true  "Quick update: the demo is live. <\n\n> ... for you? Let me know!"
// "new paragraph" comes back as the literal token <\n\n>, drawn here as a paragraph break.
// dictation is refused on Flux with a 400.
import { defineFeature, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'

interface State {
  on: boolean
}


// What Deepgram sends for "new paragraph": the characters < \ n \ n >.
export const PARAGRAPH = '<\\n\\n>'

// Splits words into paragraphs at each PARAGRAPH token.
export function paragraphs(words: readonly Word[]): Word[][] {
  const out: Word[][] = [[]]
  for (const w of words) {
    if (w.text === PARAGRAPH) out.push([])
    else out[out.length - 1].push(w)
  }
  return out.filter((p) => p.length)
}

export default defineFeature<State>({
  copy: {
    headline: 'Say "comma." Get a comma.',
    lede: 'Read the phrase, punctuation and all. Run it with dictation off, then on, and watch the spoken commands turn into punctuation and paragraphs.',
    ctaTitle: 'Add dictation=true to your next request.',
    ctaBody: (
      <>
        <code>dictation</code> turns spoken punctuation into punctuation on Nova-3, on{' '}
        <code>/v1/listen</code>. Send it with <code>punctuate=true</code>. New accounts start with
        $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/dictation' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3', punctuate: 'true' },
      note: 'Nova-3 only. Flux does not support dictation yet (/v2/listen answers it with a 400).',
    },
  ],
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { on: false },
  variants: [{ on: false }, { on: true }],

  // Sent either way on Nova, so the Request card always says which one ran.
  params: ({ on }, { model }): Params => ({ dictation: String(on) }),
  highlight: ['dictation'],

  runLabel: ({ on }, { model }) => `dictation=${on}`,
  actionLabel: ({ on }, { model }) => `Run with dictation=${on}`,
  compareTip: ({ on }) => (on ? 'Turn dictation off and read it again to compare.' : 'Turn dictation on and read it again to compare.'),

  phrases: () => [
    'Quick update colon the demo is live period new paragraph does it work for you question mark let me know exclamation mark',
  ],

  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={state.on}
          disabled={ctx.busy}
          onChange={(e) => setState({ on: e.target.checked })}
        />
        Turn on dictation
      </label>
    )
  },

  Response({ latest }) {
    if (typeof latest?.echoed !== 'string') {
      return <span className="wire__key">The last final transcript shows up here after a run.</span>
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"transcript":</span> <mark>{JSON.stringify(latest.echoed)}</mark>
      </span>
    )
  },

  Result({ run, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    if (words.length === 0) return <EmptyTranscript live={live} text="Your transcript shows up here, as you dictate it." />
    return (
      <div className="transcript" aria-live="polite">
        {paragraphs(words).map((p, i) => (
          <p className="transcript__text" key={i}>
            {p.map((w, j) => (
              <span key={j} className={w.pending ? 'word word--pending' : 'word'}>
                {w.text}{' '}
              </span>
            ))}
          </p>
        ))}
      </div>
    )
  },
})
