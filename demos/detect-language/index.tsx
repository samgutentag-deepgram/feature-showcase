// detect_language on Nova-3, pre-recorded: record a line, POST it once, and read back the language
// Deepgram picked and how sure it is. detect_language is pre-recorded only: the streaming socket
// answers it with a 400 at the handshake on /v1/listen (nova-3) and /v2/listen (Flux), so the page
// records, then sends one POST.
// Checked 2026-11-16 with macOS say clips on POST /v1/listen?model=nova-3&detect_language=true:
// en 0.998, es 0.999, fr 0.995, de 0.9998, ja 0.999, hi 0.9999, each transcribed in that language.
// Restricting with repeated values works: detect_language=en&detect_language=es on the Spanish clip
// gives es 0.999; on the French clip it gives en with confidence 0.0006 and an empty transcript.
// Verified live 2026-11-16: ONLY=detect-language pnpm verify:live passed (both POSTs, detect_language=true and detect_language=en&detect_language=es, and the prompt), and say clips came back en 0.998, es 0.999, fr 0.995, de 0.9998, ja 0.999, hi 0.9999.
import { defineFeature, type Json, type Params, type Run } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

// The ten languages flux-general-multi covers, the same set the language demos offer. Detection
// itself knows 35 (see the docs), so these are all well inside it.
export const LANGUAGES = ['en', 'es', 'fr', 'de', 'hi', 'ru', 'pt', 'ja', 'it', 'nl'] as const
export type Lang = (typeof LANGUAGES)[number]

// One short line per language, so a visitor reads one in a language they speak.
export const PHRASES: Record<Lang, string> = {
  en: 'Can you guess which language I am speaking right now?',
  es: '¿Puedes adivinar qué idioma estoy hablando ahora mismo?',
  fr: 'Peux-tu deviner quelle langue je parle en ce moment ?',
  de: 'Kannst du erraten, welche Sprache ich gerade spreche?',
  hi: 'क्या आप बता सकते हैं कि मैं अभी कौन सी भाषा बोल रहा हूँ?',
  ru: 'Угадаешь, на каком языке я сейчас говорю?',
  pt: 'Você consegue adivinhar qual idioma eu estou falando agora?',
  ja: '今、私が何語を話しているか分かりますか？',
  it: 'Riesci a indovinare quale lingua sto parlando adesso?',
  nl: 'Kun je raden welke taal ik nu spreek?',
}

const names = new Intl.DisplayNames(['en'], { type: 'language' })
export function languageName(code: string): string {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

interface State {
  // Which line to read. Not sent: detection has to work it out.
  lang: Lang
  // Send the list below instead of detect_language=true.
  limit: boolean
  allowed: Lang[]
}

export const DEFAULT_ALLOWED: Lang[] = ['en', 'es']

// detect_language=true picks from every language it knows. A list is sent as repeated values
// (detect_language=en&detect_language=es) and detection picks only from those.
export const detectParam = (s: State): string | string[] => (s.limit && s.allowed.length ? [...s.allowed] : 'true')

export interface Detected {
  detected_language?: string
  language_confidence?: number
}

// The two fields from the first channel of a pre-recorded response.
export function detected(json: Json): Detected | undefined {
  const ch = ((json.results as Json | undefined)?.channels as Json[] | undefined)?.[0]
  if (!ch || typeof ch.detected_language !== 'string') return undefined
  return {
    detected_language: ch.detected_language,
    ...(typeof ch.language_confidence === 'number' ? { language_confidence: ch.language_confidence } : {}),
  }
}

// Below this, the line read was most likely not on the list (French against en+es came back 0.0006).
export const LOW_CONFIDENCE = 0.5

function Detection({ run }: { run: Run<State> }) {
  const d = run.echoed as Detected | undefined
  if (!d?.detected_language) return null
  const conf = d.language_confidence
  const low = typeof conf === 'number' && conf < LOW_CONFIDENCE
  return (
    <div className="detect" data-low={low || undefined}>
      <span className="detect__label">Detected</span>
      <span className="detect__lang">
        {languageName(d.detected_language)} <code>{d.detected_language}</code>
      </span>
      {typeof conf === 'number' && (
        <span className="detect__conf">
          <span className="detect__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(1, Math.round(conf * 100))}%` }} />
          </span>
          confidence {conf.toFixed(3)}
        </span>
      )}
      {low && (
        <p className="detect__hint">
          Low confidence. The line you read is probably in a language outside the list you sent.
        </p>
      )}
    </div>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Which language did I just speak?',
    lede: 'Pick a line in a language you speak, record it, and Deepgram names the language and how sure it is. Then limit detection to a short list and read a line that is not on it.',
    ctaTitle: 'Add detect_language=true to your next request.',
    ctaBody: (
      <>
        <code>detect_language</code> works on pre-recorded <code>/v1/listen</code> requests. Send <code>true</code>, or
        repeat it once per language to pick from a list. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/language-detection' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support detect_language yet (/v2/listen answers it with a 400), and neither does the streaming socket, so this page records your line and sends it in one pre-recorded POST. One language per clip: for speech that switches mid-sentence, use language=multi instead.',
    },
  ],
  // Record, then one POST. Runs stay side by side so a limited run sits next to an open one.
  modes: [{ id: 'rec', label: 'Record', source: 'mic', batch: true, compare: true }],
  initialState: { lang: 'en', limit: false, allowed: DEFAULT_ALLOWED },
  variants: [
    { lang: 'en', limit: false, allowed: DEFAULT_ALLOWED },
    { lang: 'en', limit: true, allowed: DEFAULT_ALLOWED },
  ],
  // The prompt teaches the plain form, detect_language=true.
  promptState: { lang: 'en', limit: false, allowed: DEFAULT_ALLOWED },

  params: (state): Params => ({ detect_language: detectParam(state) }),
  highlight: ['detect_language'],

  runLabel: (s) => (s.limit ? `limited to ${s.allowed.join(', ')}` : 'any language'),
  compareTip: (s) =>
    s.limit
      ? 'Turn the list off and read the same line again to compare.'
      : 'Limit detection to a list without your language and read the same line again.',

  phrases: (s) => [PHRASES[s.lang]],

  echo: (msg) => detected(msg),

  Controls({ state, setState, ctx }) {
    const toggle = (code: Lang) => {
      const on = state.allowed.includes(code)
      // Keep at least one: an empty list would send nothing to pick from.
      if (on && state.allowed.length === 1) return
      const allowed = on ? state.allowed.filter((c) => c !== code) : LANGUAGES.filter((c) => c === code || state.allowed.includes(c))
      setState({ ...state, allowed })
    }
    return (
      <>
        <label className="field detect-field">
          <span className="detect-field__label">I will read a line in</span>
          <select
            value={state.lang}
            disabled={ctx.busy}
            onChange={(e) => setState({ ...state, lang: e.target.value as Lang })}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={state.limit}
            disabled={ctx.busy}
            onChange={(e) => setState({ ...state, limit: e.target.checked })}
          />
          Limit detection to a list
        </label>
        {state.limit && (
          <div className="detect-chips" role="group" aria-label="Languages detection may pick">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                className="detect-chip"
                aria-pressed={state.allowed.includes(code)}
                disabled={ctx.busy}
                onClick={() => toggle(code)}
              >
                {languageName(code)} <span>{code}</span>
              </button>
            ))}
          </div>
        )}
      </>
    )
  },

  Response({ latest }) {
    const d = latest?.echoed as Detected | undefined
    if (!d?.detected_language) {
      return <span className="wire__key">results.channels[0].detected_language and language_confidence show up here after a run.</span>
    }
    return (
      <>
        <span className="wire__part">
          <span className="wire__key">"detected_language":</span> <mark>{JSON.stringify(d.detected_language)}</mark>,
        </span>{' '}
        <span className="wire__part">
          <span className="wire__key">"language_confidence":</span> <mark>{JSON.stringify(d.language_confidence)}</mark>
        </span>
      </>
    )
  },

  Result({ run, live }) {
    return (
      <>
        {run && <Detection run={run} />}
        <PlainTranscript
          committed={run?.committed ?? []}
          pending={run?.pending ?? []}
          live={live}
          emptyText="Record a line. The detected language, its confidence, and the transcript show up here."
        />
      </>
    )
  },
})
