// language_hint on Nova-3 multilingual (changelog 2026-10-23), with Flux multi for contrast.
// Rows split wherever the detected language changes; the hints steer detection.
import { defineFeature, type Json, type Model, type Params } from '../../shared/common/feature'
import { FLUX_LANGUAGES, NOVA3_LANGUAGES, phraseFor } from './languages'
import { LanguagePicker } from './LanguagePicker'
import { Transcript } from './Transcript'
import './styles.css'

interface State {
  hints: [string, string]
  // The Upload tab sends hints only when this is ticked.
  uploadHints: boolean
}

export const DEFAULT_HINTS: [string, string] = ['en', 'es']

// Flux first: it takes language_hint too. Nova-3 covers more languages (Catalan, for one).
export const MODELS: Model[] = [
  {
    id: 'flux',
    label: 'Flux',
    endpoint: 'v2',
    params: { model: 'flux-general-multi' },
    note: `Flux covers ${FLUX_LANGUAGES.length} languages and tags one language per turn, so rows split at pauses, not mid-sentence. Catalan needs Nova-3.`,
  },
  {
    id: 'nova-3',
    label: 'Nova-3',
    endpoint: 'v1',
    // smart_format changes the transcript, so it is on the card: copy it and you get the same words.
    params: { model: 'nova-3', language: 'multi', smart_format: 'true' },
  },
]

export const languagesFor = (model: Model): readonly string[] =>
  model.id === 'flux' ? FLUX_LANGUAGES : NOVA3_LANGUAGES

// The hints a run sends. Language hint always sends them, Auto detect never, Upload when ticked.
export function activeHints(state: State, modeId: string): string[] {
  const on = modeId === 'hint' || (modeId === 'upload' && state.uploadHints)
  return on ? [...state.hints] : []
}

export default defineFeature<State>({
  copy: {
    headline: 'Which language was that?',
    lede: 'Talk in more than one language, or upload a clip. Deepgram tags the language of what it hears, and a new row starts every time the speaker switches.',
    ctaTitle: 'Add language_hint to your next request.',
    ctaBody: (
      <>
        Nova-3 multilingual takes <code>language_hint</code> on <code>/v1/listen</code>, streaming and
        pre-recorded. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: {
    docs: 'https://developers.deepgram.com/docs/nova-3-language-prompting',
    changelog: 'https://developers.deepgram.com/changelog/2026/10/23',
  },
  models: MODELS,
  modes: [
    { id: 'hint', label: 'Language hint', source: 'mic' },
    { id: 'auto', label: 'Auto detect', source: 'mic' },
    { id: 'upload', label: 'Upload', source: 'file' },
  ],
  initialState: { hints: DEFAULT_HINTS, uploadHints: false },
  variants: [
    { hints: DEFAULT_HINTS, uploadHints: false },
    { hints: DEFAULT_HINTS, uploadHints: true },
  ],

  onModelChange(state, model) {
    const allowed = languagesFor(model)
    return state.hints.every((h) => allowed.includes(h)) ? state : { ...state, hints: DEFAULT_HINTS }
  },

  // No hints means pure auto-detect. An empty language_hint would be rejected, so omit it.
  // Repeated params (language_hint=en&language_hint=es); comma and bracket forms return 400.
  params(state, { mode }): Params {
    const hints = activeHints(state, mode.id)
    return hints.length ? { language_hint: hints } : {}
  },
  highlight: ['language_hint'],

  runLabel(state, { mode }) {
    const hints = activeHints(state, mode.id)
    return hints.length ? `hints ${hints.join(' + ')}` : 'no hints'
  },
  actionLabel(state, { mode }) {
    const hints = activeHints(state, mode.id)
    return hints.length ? `Run with ${hints.join(' + ')}` : 'Run without hints'
  },
  compareTip(state, { mode }) {
    return activeHints(state, mode.id).length
      ? 'Turn hints off, or pick other languages, and run it again to compare.'
      : 'Turn on language hints, pick two languages, and run it again to compare.'
  },

  // Read one line, then switch languages and read the next. Auto detect suggests the pair picked
  // for hints, since nothing is sent to steer it.
  phrases: (state) => state.hints.map(phraseFor),

  // Nova-3 echoes the hints it applied on each alternative; Flux at the top of each TurnInfo.
  echo(msg, model) {
    const src = model.endpoint === 'v2' ? msg : ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
    return src?.languages_hinted as string[] | undefined
  },

  Controls({ state, setState, ctx }) {
    const { hints } = state
    const options = languagesFor(ctx.model)
    const show = activeHints(state, ctx.mode.id).length > 0
    return (
      <>
        {ctx.mode.id === 'upload' && (
          <label className="check">
            <input
              type="checkbox"
              checked={state.uploadHints}
              disabled={ctx.busy}
              onChange={(e) => setState({ ...state, uploadHints: e.target.checked })}
            />
            Add language hints
          </label>
        )}
        {show && (
          <div className="field field--pickers">
            <LanguagePicker
              label="Language 1"
              slot="1"
              value={hints[0]}
              exclude={hints[1]}
              options={options}
              disabled={ctx.busy}
              onChange={(c) => setState({ ...state, hints: [c, hints[1]] })}
            />
            <LanguagePicker
              label="Language 2"
              slot="2"
              value={hints[1]}
              exclude={hints[0]}
              options={options}
              disabled={ctx.busy}
              onChange={(c) => setState({ ...state, hints: [hints[0], c] })}
            />
          </div>
        )}
      </>
    )
  },

  // What Deepgram echoed for the latest run, if that run used the hints selected now.
  // Otherwise the selection, which is what the next run will echo.
  Response({ state, ctx, latest }) {
    const active = activeHints(state, ctx.mode.id)
    const same = latest && activeHints(latest.state, latest.mode.id).join() === active.join()
    const shown = (same && latest.echoed) || active
    return (
      <span className="wire__part">
        <span className="wire__key">"languages_hinted":</span> <mark>{JSON.stringify(shown)}</mark>
      </span>
    )
  },

  Result({ run, state, ctx, live }) {
    return run ? (
      <Transcript
        committed={run.committed}
        pending={run.pending}
        hints={activeHints(run.state, run.mode.id)}
        live={live}
      />
    ) : (
      <Transcript committed={[]} pending={[]} hints={activeHints(state, ctx.mode.id)} live={false} />
    )
  },
})
