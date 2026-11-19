// Browse the Flux voices: pick a language, then a voice, and hear the same line in it. Every voice
// is flux-{voice}-{language} on /v2/speak; all 266 in the docs' catalog answered 200 with audio on
// 2026-11-12 (voices.ts), and pnpm verify:live asks for each again.
// flux-wes-en is the default: the steadiest of 14 English Flux voices on 2026-11-11 (0.2 dB
// loudness and 0.08 s duration spread, same line 3 times). Every voice is cleared for use; marcus
// and brittany are listed like the rest, just not the default, since they drift between calls.
// Verified live 2026-11-16: pnpm verify:live opened every request the page makes, and every docs link resolved.
import { defineTtsFeature } from '../../shared/tts/feature'
import { LANGS, VOICES } from './voices'

interface State {
  lang: string
  voice: string
}

const DEFAULT = 'flux-wes-en'
const byModel = new Map(VOICES.map((v) => [v.model, v]))
const lineFor = (lang: string) => LANGS.find((l) => l.name === lang)?.line ?? LANGS[0].line
const detail = (v: (typeof VOICES)[number]) => [v.accent, v.gender, v.age].filter(Boolean).join(', ')

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Hear every Flux voice.',
    lede: `${VOICES.length} Flux voices in ${LANGS.length} languages, all on the same endpoint. Pick a language and a voice to hear the same line in it. The model name is the only thing that changes in the request.`,
    ctaTitle: 'One endpoint, every voice.',
    ctaBody: (
      <>
        Ask <code>/v2/speak</code> for <code>model=flux-{'{voice}'}-{'{language}'}</code>, over REST or the
        streaming socket. Every Flux voice works in the Voice Agent API too. New accounts start with $200 in free
        credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux-tts/voices' },
  voices: [DEFAULT, ...VOICES.map((v) => v.model).filter((m) => m !== DEFAULT)],
  initialState: { lang: 'English', voice: DEFAULT },
  variants: [{ lang: 'English', voice: DEFAULT }],
  params: () => ({ encoding: 'linear16', sample_rate: '24000', container: 'none' }),
  highlight: ['model'],
  restartOnPick: true,
  voiceFrom: ({ voice }) => voice,
  textFor: ({ lang }) => lineFor(lang),
  runLabel: ({ voice }) => {
    const v = byModel.get(voice)
    return v ? `${v.name}, ${v.lang}` : voice
  },
  phrases: [lineFor('English')],

  Controls({ state, setState }) {
    const inLang = VOICES.filter((v) => v.lang === state.lang)
    const lang = LANGS.find((l) => l.name === state.lang)
    const on = byModel.get(state.voice)
    return (
      <div className="tts-browse">
        <div className="tts-browse__row">
          <label className="tts-voice">
            <span className="tts-text__label">Language</span>
            <select
              value={state.lang}
              onChange={(e) => {
                const first = VOICES.find((v) => v.lang === e.target.value)
                if (first) setState({ lang: e.target.value, voice: first.model })
              }}
            >
              {[false, true].map((ea) => (
                <optgroup key={String(ea)} label={ea ? 'Early access' : 'Generally available'}>
                  {LANGS.filter((l) => l.earlyAccess === ea).map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name} ({VOICES.filter((v) => v.lang === l.name).length})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="tts-voice">
            <span className="tts-text__label">Voice</span>
            <select value={state.voice} onChange={(e) => setState({ lang: state.lang, voice: e.target.value })}>
              {inLang.map((v) => (
                <option key={v.model} value={v.model}>
                  {v.name}
                  {v.featured ? ' (featured)' : ''}
                  {detail(v) ? `, ${detail(v)}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {lang?.earlyAccess && <p className="hint">Early access: numbers and dates are not expanded yet, so write them out in words.</p>}
        {on && (
          <div className="tts-voicecard is-on tts-voicecard--static">
            <span className="tts-voicecard__name">
              {on.name}
              {on.featured && <span className="tts-voicecard__tag">Featured</span>}
            </span>
            {on.character && <span className="tts-voicecard__character">{on.character}</span>}
            <code className="tts-voicecard__model">{on.model}</code>
          </div>
        )}
      </div>
    )
  },
})
