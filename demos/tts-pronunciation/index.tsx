// Fix how a word is said with an inline IPA override, on Flux (Early Access). Verified live
// 2026-11-12 on POST /v2/speak, flux-wes-en and flux-hannah-en, linear16 at 24 kHz:
//   'Take \{"word": "dupilumab", "pronounce": "duːˈpɪljuːmæb"\} twice daily.'  200,
//   dg-pronunciations-applied: 1 (the same line without the override: 0).
//   With speed=1.2 as well -> 400 CONTROL_COMBINATION_INVALID ("pronunciation and speed controls
//   cannot be combined"), so this page sends no speed.
// IPA from the docs' own examples (docs/tts-voice-controls), in the broad American style Flux was
// trained on. Early Access: the docs say an override can come out differently from one generation
// to the next, so the page says to listen a few times. pnpm verify:live requests every term, both
// ways, on every voice. Flux only here (Aura-2 takes the same syntax with the stress mark placed
// before the vowel). flux-wes-en is the default: the steadiest of 14 English Flux voices.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_INLINE } from '../../shared/tts/voices'

interface State {
  term: string
  ipa: string
}

const TERMS: Record<string, { word: string; ipa: string; line: (w: string) => string }> = {
  dupilumab: { word: 'dupilumab', ipa: 'duːˈpɪljuːmæb', line: (w) => `Take ${w} every two weeks, as your doctor prescribed.` },
  azathioprine: { word: 'azathioprine', ipa: 'æzəˈθaɪəpɹiːn', line: (w) => `Your refill of ${w} is ready for pickup at the pharmacy.` },
  hermes: { word: 'Hermès', ipa: 'ɛəɹˈmɛz', line: (w) => `Your ${w} order has shipped and should arrive on Friday.` },
  nguyen: { word: 'Nguyen', ipa: 'ˈwɪn', line: (w) => `Doctor ${w} will see you at three thirty this afternoon.` },
  sql: { word: 'SQL', ipa: 'ˈsiːkwəl', line: (w) => `The ${w} database is back online, and your report is ready.` },
}
const TERM_STEPS = Object.entries(TERMS).map(([value, t]) => ({ name: t.word, detail: t.ipa, value }))
const HOW = [
  { name: 'As written', detail: 'no override', value: 'off' },
  { name: 'With IPA', detail: 'override', value: 'on' },
]
const override = (t: { word: string; ipa: string }) => `\\{"word": "${t.word}", "pronounce": "${t.ipa}"\\}`
const lineFor = ({ term, ipa }: State) => {
  const t = TERMS[term]
  return t.line(ipa === 'on' ? override(t) : t.word)
}

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Say the drug name right.',
    lede: 'Drug names, brands and surnames trip up any voice. Pick a word, then hear it as written and with an IPA override in the text: the override tells Flux exactly how to say it. Pronunciation on Flux is in Early Access, so play each one a few times.',
    ctaTitle: 'Spell out how a word sounds.',
    ctaBody: (
      <>
        Put <code>{'\\{"word": "dupilumab", "pronounce": "duːˈpɪljuːmæb"\\}'}</code> in the text you send to{' '}
        <code>/v2/speak</code>. The response header <code>dg-pronunciations-applied</code> counts the overrides used.
        New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-voice-controls' },
  voices: FLUX_INLINE,
  initialState: { term: 'dupilumab', ipa: 'on' },
  variants: Object.keys(TERMS).flatMap((term) => [{ term, ipa: 'off' }, { term, ipa: 'on' }]),
  params: () => ({ encoding: 'linear16', sample_rate: '24000', container: 'none' }),
  highlight: [],
  restartOnPick: true,
  textFor: lineFor,
  runLabel: ({ term, ipa }) => `${TERMS[term].word}, ${ipa === 'on' ? 'with IPA' : 'as written'}`,
  phrases: [lineFor({ term: 'dupilumab', ipa: 'on' })],

  Controls({ state, setState }) {
    return (
      <div className="tts-browse">
        <Steps label="Word" steps={TERM_STEPS} value={state.term} onPick={(term) => setState({ ...state, term })} />
        <Steps label="Pronunciation" steps={HOW} value={state.ipa} onPick={(ipa) => setState({ ...state, ipa })} />
      </div>
    )
  },
})
