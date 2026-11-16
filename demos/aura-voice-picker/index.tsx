// Browse the Aura-2 voices: pick a language, then a voice, and hear the same line in it. Every voice
// is aura-2-{voice}-{language} on POST /v1/speak. Verified live 2026-11-13 with linear16, 24 kHz,
// container=none: all 90 voices in the docs' catalog (voices.ts) came back 200 audio/l16;rate=24000,
// each speaking its own language's line (2.2 s to 7.2 s of audio). GET /v1/models lists the same
// 90 plus aura-2-valentina-es, which the docs do not list yet, so it is left out.
// pnpm verify:live requests every voice again.
// Aura-2 only on purpose: this is the Aura-2 voice tour. Flux voices (flux-*, POST /v2/speak) have
// their own, flux-tts-voices. aura-2-thalia-en is the default: the first featured English voice
// in the docs.
import { defineTtsFeature } from '../../shared/tts/feature'
import { LANGS, VOICES } from './voices'

interface State {
  lang: string
  voice: string
}

const DEFAULT = 'aura-2-thalia-en'
const byModel = new Map(VOICES.map((v) => [v.model, v]))
const lineFor = (lang: string) => LANGS.find((l) => l.name === lang)?.line ?? LANGS[0].line
const detail = (v: (typeof VOICES)[number]) => [v.accent, v.gender, v.age].filter(Boolean).join(', ')

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Hear every Aura-2 voice.',
    lede: `Start with Flux voices: they are the ones to build on, and the Flux voices demo tours them. Aura-2 is the fallback, ${VOICES.length} voices in ${LANGS.length} languages on one endpoint. Pick a language and a voice to hear the same line; the model name is the only thing that changes in the request.`,
    ctaTitle: 'One endpoint, every Aura-2 voice.',
    ctaBody: (
      <>
        Ask <code>/v1/speak</code> for <code>model=aura-2-{'{voice}'}-{'{language}'}</code>, over REST or the
        streaming socket. Flux voices use the same query on <code>/v2/speak</code>. New accounts start with $200
        in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-models' },
  voices: [DEFAULT, ...VOICES.map((v) => v.model).filter((m) => m !== DEFAULT)],
  auraOnly:
    'Aura-2 only. This is the Aura-2 voice tour: Flux voices (flux-*) take the same query on /v2/speak and have their own tour, the Flux voices demo.',
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
              {LANGS.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name} ({VOICES.filter((v) => v.lang === l.name).length})
                </option>
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
        {on && (
          <div className="tts-voicecard is-on tts-voicecard--static">
            <span className="tts-voicecard__name">
              {on.name}
              {on.featured && <span className="tts-voicecard__tag">Featured</span>}
            </span>
            {on.character && <span className="tts-voicecard__character">{on.character}</span>}
            {on.useCases && <span className="tts-voicecard__detail">For: {on.useCases}</span>}
            <code className="tts-voicecard__model">{on.model}</code>
          </div>
        )}
      </div>
    )
  },
})
