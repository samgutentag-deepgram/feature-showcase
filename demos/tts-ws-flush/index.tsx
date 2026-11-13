// Speak an LLM's reply while it is still arriving, on the Flux socket (wss /v2/speak). The page
// drips the reply out a word every 60 ms, like LLM tokens. Verified live 2026-11-12, flux-wes-en,
// linear16 at 24 kHz, a 3-sentence reply (shared/tts/tokens.ts has the numbers):
//   wait for the whole reply, then Speak + Flush: nothing plays until the text is complete
//   Speak each token, Flush after the last: first audio 467 ms after the first token, 2.15 s of
//   8.16 s out before Flush
//   Speak each token, Flush 3 s late: the last 3.85 s of audio waited for Flush
// Flux only (this lab is the Flux take on Speak + Flush). flux-wes-en is the default: the steadiest
// of 14 English Flux voices on 2026-11-11.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { FLUX_SESSION } from '../../shared/tts/voices'

type Mode = 'whole' | 'stream' | 'late'

interface State {
  mode: Mode
}

const STEPS: { name: string; detail: string; value: Mode }[] = [
  { name: 'Wait for the reply', detail: 'then Speak + Flush', value: 'whole' },
  { name: 'Stream tokens', detail: 'Flush at the end', value: 'stream' },
  { name: 'Flush late', detail: 'Flush 3 s after', value: 'late' },
]

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Start talking before the LLM finishes.',
    lede: 'The reply below arrives a word at a time, the way an LLM streams it. Hear it three ways: wait for the whole reply first, send each token to Flux as it arrives, or stream the tokens but forget to Flush. Watch when the first audio plays, and how much was out before Flush.',
    ctaTitle: 'Pipe tokens straight in.',
    ctaBody: (
      <>
        On the Flux socket at <code>/v2/speak</code>, send each LLM token as <code>{'{"type":"Speak","text":"..."}'}</code>{' '}
        the moment it arrives, then <code>{'{"type":"Flush"}'}</code> as soon as the reply is done. New accounts start
        with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/flux-tts/client-messages' },
  voices: FLUX_SESSION,
  initialState: { mode: 'stream' },
  variants: STEPS.map(({ value }) => ({ mode: value })),
  promptState: { mode: 'stream' },
  params: () => ({ encoding: 'linear16', sample_rate: '24000', container: 'none' }),
  highlight: [],
  restartOnPick: true,
  tokens: { tokenMs: 60, mode: ({ mode }) => mode },
  runLabel: ({ mode }) => STEPS.find((s) => s.value === mode)?.name ?? mode,
  phrases: [
    'Sure, I can help with that. Your order shipped this morning, and it should arrive by Thursday. I will text you the tracking number in a minute, so keep an eye on your phone.',
    'Good question. The short answer is yes, you can change your plan at any time. The new price starts on your next bill, and you will not lose any of your saved settings.',
  ],

  Controls({ state, setState }) {
    return <Steps label="How the reply is sent" steps={STEPS} value={state.mode} onPick={(mode) => setState({ mode })} />
  },
})
