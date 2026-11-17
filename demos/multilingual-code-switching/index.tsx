// Multilingual code-switching: language=multi on Nova-3, flux-general-multi on Flux. One sentence
// that changes language partway through, transcribed as one stream, each Nova-3 word tagged.
// Checked 2026-11-16 on /v1/listen streaming (model=nova-3&language=multi&endpointing=100) with a
// Spanish-then-English clip: one final result came back "español/es ok/en now/en", the switch
// inside a single result. flux-general-multi on /v2/listen gave the same turn with
// languages ["es","en"] and no per-word tags; language=multi there is a 400 (unknown query parameter).
// Verified live 2026-11-16: pnpm verify:live opened every request the page makes (Flux flux-general-multi and Nova-3 language=multi, both variants) and the docs link resolved.
import { defineFeature, type Json, type Model, type Params } from '../../shared/common/feature'
import { WordsByLanguage } from './WordsByLanguage'
import { PAIRS, type PairId } from './pairs'
import './styles.css'

interface State {
  pair: PairId
}

export const MODELS: Model[] = [
  {
    id: 'flux',
    label: 'Flux',
    endpoint: 'v2',
    params: { model: 'flux-general-multi' },
    note: 'Flux multilingual code-switches on its own: no language param (language=multi is a 400 on /v2/listen). It lists the languages once per turn, so words are not tagged one by one. Nova-3 tags each word.',
  },
  {
    id: 'nova-3',
    label: 'Nova-3',
    endpoint: 'v1',
    // endpointing=100 is what the docs recommend for code-switching on a stream.
    params: { model: 'nova-3', language: 'multi', endpointing: '100' },
  },
]

type Echo = { field: 'words'; value: Array<{ word: string; language: string }> } | { field: 'languages'; value: string[] }

// Two words from the latest final result: the first pair where the language changes, or the last two.
export function switchPoint(words: Array<{ word: string; language: string }>) {
  const i = words.findIndex((w, j) => j > 0 && w.language !== words[j - 1].language)
  return i > 0 ? words.slice(i - 1, i + 1) : words.slice(-2)
}

export default defineFeature<State>({
  copy: {
    headline: 'Two languages, one sentence?',
    lede: 'Read a sentence that starts in English and finishes in Spanish. Deepgram transcribes the whole thing in one stream, and Nova-3 tags every word with the language it heard.',
    ctaTitle: 'Add language=multi to your next request.',
    ctaBody: (
      <>
        Nova-3 takes <code>language=multi</code> on <code>/v1/listen</code>, streaming and pre-recorded,
        across 55 languages. On Flux, use <code>model=flux-general-multi</code>. New accounts start with
        $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/multilingual-code-switching' },
  models: MODELS,
  // Live mic only. Runs stay side by side, so Flux and Nova-3 can read the same sentence.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: { pair: 'en-es' },
  // The pair only changes the suggested phrase and the colors; every variant sends the same request.
  variants: [{ pair: 'en-es' }, { pair: 'en-fr' }],

  // Nova-3 takes language=multi on the model; Flux is multilingual by model name. Nothing extra.
  params: (): Params => ({}),
  highlight: ['language', 'model'],

  runLabel: ({ pair }) => PAIRS[pair].label,

  phrases: ({ pair }) => [PAIRS[pair].phrase],

  // Nova-3: the words of the latest final result, each with its language. Flux: languages per turn.
  echo(msg, model): Echo | undefined {
    if (model.endpoint === 'v2') {
      const langs = msg.type === 'TurnInfo' ? (msg.languages as string[] | undefined) : undefined
      return langs?.length ? { field: 'languages', value: langs } : undefined
    }
    if (msg.type !== 'Results' || msg.is_final !== true) return undefined
    const alt = ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
    const words = ((alt?.words as Json[] | undefined) ?? []).map((w) => ({
      word: String(w.word ?? ''),
      language: String(w.language ?? ''),
    }))
    return words.length ? { field: 'words', value: switchPoint(words) } : undefined
  },

  Controls({ state, setState, ctx }) {
    return (
      <div className="segmented" role="radiogroup" aria-label="Languages to mix">
        {(Object.keys(PAIRS) as PairId[]).map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={state.pair === id}
            className={state.pair === id ? 'segmented__opt is-on' : 'segmented__opt'}
            disabled={ctx.busy}
            onClick={() => setState({ pair: id })}
          >
            {PAIRS[id].label}
          </button>
        ))}
      </div>
    )
  },

  Response({ ctx, latest }) {
    const echo = latest?.model.id === ctx.model.id ? (latest.echoed as Echo | undefined) : undefined
    if (!echo) {
      return (
        <span className="wire__key">
          {ctx.model.endpoint === 'v2'
            ? 'The languages Flux heard in the latest turn show up here after a run.'
            : 'Where the language switched, word by word, shows up here after a run.'}
        </span>
      )
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"{echo.field}":</span> <mark>{JSON.stringify(echo.value)}</mark>
      </span>
    )
  },

  Result({ run, state, live }) {
    const pair = PAIRS[(run?.state ?? state).pair]
    const perTurn = run?.model.endpoint === 'v2'
    const echo = run?.echoed as Echo | undefined
    return (
      <WordsByLanguage
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        order={pair.langs}
        perTurn={perTurn}
        turnLanguages={perTurn && echo?.field === 'languages' ? echo.value : []}
        live={live}
      />
    )
  },
})
