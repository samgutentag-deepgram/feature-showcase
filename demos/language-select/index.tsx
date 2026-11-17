// language on Nova-3: one language per request, and Nova-3 transcribes only that one.
// Checked live 2026-11-16 on /v1/listen streaming with macOS-voice clips of the phrases below:
// language=<code>&smart_format=true gave each line back right in all ten languages. Wrong picks:
// Spanish, French, German, and Japanese speech with language=en came back "" (nothing);
// English with language=es gave "I like a table for two by the Windows. Please."; Italian with
// language=es gave "Bora y untávolo perdue viccino a la finaestra, per favore."
// Flux: /v2/listen answers language with a 400 (INVALID_QUERY_PARAMETER) on flux-general-multi
// and flux-general-en, so this demo is Nova-3 only.
// Verified live 2026-11-16: pnpm verify:live opened all ten language= requests on /v1/listen (nova-3, smart_format=true) and the prompt.md URL with a granted token, and the docs link resolved; all passed.
import { defineFeature, type Params, type Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { finalTranscript } from '../../shared/stt/stream'
import { LANGUAGES, PHRASES, SORTED, languageName, type Lang } from './languages'
import './styles.css'

interface State {
  // The language the visitor reads the line in. Picks the suggested phrase; never sent.
  spoken: Lang
  // The one language sent as language=.
  language: Lang
}

export const DEFAULT: State = { spoken: 'en', language: 'en' }

// Why a run came back the way it did, in one sentence.
export function verdict(state: State, heard: boolean): string {
  const said = languageName(state.spoken)
  const set = languageName(state.language)
  if (state.spoken === state.language) {
    return heard ? `Read in ${said}, sent language=${state.language}: a match.` : `Nothing came back. Read the line again, a little louder.`
  }
  return heard
    ? `Read in ${said}, sent language=${state.language}: Nova-3 wrote the sounds down as ${set} words.`
    : `Nothing came back. Nova-3 listened for ${set} only, so the ${said} speech was dropped.`
}

function Picker(props: {
  label: string
  value: Lang
  slot: 'spoken' | 'sent'
  disabled: boolean
  code?: boolean
  onChange(code: Lang): void
}) {
  return (
    <label className="ls-picker" data-slot={props.slot}>
      <span className="ls-picker__label">{props.label}</span>
      <select value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value as Lang)}>
        {SORTED.map((c) => (
          <option key={c} value={c}>
            {props.code ? `${c}  (${languageName(c)})` : languageName(c)}
          </option>
        ))}
      </select>
    </label>
  )
}

function Transcript({ words, state, live, run }: { words: readonly Word[]; state: State; live: boolean; run: boolean }) {
  const match = state.spoken === state.language
  const tag = (
    <p className="ls-tag" data-match={match}>
      <span className="ls-chip" data-slot="spoken">Read in {languageName(state.spoken)}</span>
      <span className="ls-chip" data-slot="sent">language={state.language}</span>
    </p>
  )
  if (words.length === 0) {
    if (!run || live) {
      return <EmptyTranscript live={live} text="Your transcript shows up here. Read the line in the language you picked." />
    }
    return (
      <div className="transcript ls-result">
        {tag}
        <p className="ls-verdict">{verdict(state, false)}</p>
      </div>
    )
  }
  const committed = words.filter((w) => !w.pending).map((w) => w.text).join(' ')
  const pending = words.filter((w) => w.pending).map((w) => w.text).join(' ')
  return (
    <div className="transcript ls-result" aria-live="polite">
      {tag}
      <p className="transcript__text">
        {committed} <span className="word--pending">{pending}</span>
      </p>
      {!live && <p className="ls-verdict">{verdict(state, true)}</p>}
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'What happens when you pick the wrong language?',
    lede: 'Nova-3 transcribes the one language you set with language, and only that one. Read the line in a language you speak with it set to match, then set language to a different one and read the same line again.',
    ctaTitle: 'Set language on your next request.',
    ctaBody: (
      <>
        Nova-3 takes one <code>language</code> on <code>/v1/listen</code>, streaming and pre-recorded, and
        transcribes speech in that language only. Not sure which one is coming? Send{' '}
        <code>language=multi</code> instead. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/language' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      // smart_format changes the transcript, so it is on the card: copy it and you get the same words.
      params: { model: 'nova-3', smart_format: 'true' },
      note: 'Nova-3 only. Flux does not support language yet (/v2/listen answers it with a 400). Flux multilingual takes language_hint instead; see the Language hint demo.',
    },
  ],
  // Live mic only. Runs stay side by side: the right language, then a wrong one.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: DEFAULT,
  // What the visitor reads in is never sent, so one variant per language sent covers every request.
  variants: LANGUAGES.map((l) => ({ spoken: l, language: l })),

  params: ({ language }): Params => ({ language }),
  highlight: ['language'],

  runLabel: ({ spoken, language }) => `language=${language}, read in ${languageName(spoken)}`,
  actionLabel: ({ language }) => `Run with language=${language}`,
  compareTip: ({ spoken, language }) =>
    spoken === language
      ? `Set language to anything but ${languageName(spoken)} and read the same line again.`
      : `Set language back to ${languageName(spoken)} and read the line again to compare.`,

  // One line per language the picker offers, in the language picked to read in.
  phrases: ({ spoken }) => [PHRASES[spoken]],

  // The last final transcript Deepgram sent, verbatim.
  echo: (msg) => finalTranscript(msg),

  Controls({ state, setState, ctx }) {
    return (
      <div className="field ls-pickers">
        <Picker
          label="I'll read in"
          slot="spoken"
          value={state.spoken}
          disabled={ctx.busy}
          onChange={(spoken) => setState({ ...state, spoken })}
        />
        <Picker
          label="Send language="
          slot="sent"
          code
          value={state.language}
          disabled={ctx.busy}
          onChange={(language) => setState({ ...state, language })}
        />
      </div>
    )
  },

  // The last final transcript of the newest run. A run that heard nothing it could write down in the
  // language sent shows the empty string Nova-3 sent.
  Response({ latest }) {
    if (!latest) return <span className="wire__key">The last final transcript shows up here after a run.</span>
    const text = typeof latest.echoed === 'string' ? latest.echoed : ''
    return (
      <span className="wire__part wire__part--text ls-echo">
        <span className="wire__key">"transcript":</span> <mark>{JSON.stringify(text)}</mark>
      </span>
    )
  },

  Result({ run, state, live }) {
    const words = run ? [...run.committed, ...run.pending] : []
    return <Transcript words={words} state={run?.state ?? state} live={live} run={!!run} />
  },
})
