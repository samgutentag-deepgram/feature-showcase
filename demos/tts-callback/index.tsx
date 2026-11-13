// Text-to-speech with a callback. Verified live 2026-11-13, linear16 at 24 kHz in a WAV, with the
// key and with a 30-second granted token:
//   POST /v2/speak flux-wes-en       &callback=<url>                          200 {"request_id"} only
//   POST /v1/speak aura-2-thalia-en  &callback=<url>&callback_method=put      200 {"request_id"} only
//   callback_method takes post or put (lowercase); get and POST are a 400 "expected `post` or `put`".
//   Round trip through a public receiver: Deepgram sent the audio as the request body, POST or PUT
//   as asked, content-type audio/wav, about a second after the request_id, with dg-model-name and
//   dg-char-count headers and no request_id header (so each run gets its own callback path).
//   priority=low (lowercase; Low is a 400 "expected `low`") with a callback takes {"url": ...} in
//   place of {"text"} ({"text"} alone is a 400 "specify a `url` field"). Deepgram fetched the text
//   from the url (user-agent Deepgram) and delivered the audio on Flux within seconds. The same
//   request on /v1/speak aura-2-thalia-en was accepted and the text fetched, but no audio came in
//   minutes, so Low is offered on Flux voices only.
// Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default.
import { defineTtsFeature } from '../../shared/tts/feature'
import { Steps } from '../../shared/tts/Steps'
import { CALLBACK_SHOWN } from '../../shared/tts/callback'
import { FLUX_THEN_AURA } from '../../shared/tts/voices'

type Delivery = 'post' | 'put' | 'low'

interface State {
  delivery: Delivery
}

const STEPS = [
  { name: 'POST', detail: 'callback_method=post', value: 'post' as const },
  { name: 'PUT', detail: 'callback_method=put', value: 'put' as const },
  { name: 'Low priority', detail: 'priority=low, Flux', value: 'low' as const },
]

const LABEL: Record<Delivery, string> = {
  post: 'Callback by POST',
  put: 'Callback by PUT',
  low: 'Low priority batch, by POST',
}

export default defineTtsFeature<State>({
  kind: 'tts',
  copy: {
    headline: 'Get the audio later, on your webhook.',
    lede: 'Press Speak. Deepgram answers at once with a request_id and no audio, makes the speech, then sends the file to this page\'s server as a webhook. Pick PUT to have it delivered by PUT, or Low priority to queue it as a batch job on Flux, where Deepgram fetches the text from a URL instead of the request body.',
    ctaTitle: 'Make the audio without holding the connection.',
    ctaBody: (
      <>
        Add <code>callback</code> to a <code>/v2/speak</code> or <code>/v1/speak</code> request and Deepgram replies
        with a <code>request_id</code>, then sends the audio to your URL. <code>callback_method=put</code> switches the
        delivery to PUT, and <code>priority=low</code> on Flux runs it as a batch job from a text URL. New accounts start
        with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/tts-callback' },
  voices: FLUX_THEN_AURA,
  initialState: { delivery: 'post' },
  variants: STEPS.map(({ value }) => ({ delivery: value })),
  promptState: { delivery: 'put' },
  params: ({ delivery }) => ({
    encoding: 'linear16',
    sample_rate: '24000',
    container: 'wav',
    callback: CALLBACK_SHOWN,
    callback_method: delivery === 'put' ? 'put' : 'post',
    ...(delivery === 'low' && { priority: 'low' }),
  }),
  highlight: ['callback', 'callback_method', 'priority'],
  callback: { fluxOnly: ({ delivery }) => delivery === 'low' },
  runLabel: ({ delivery }) => LABEL[delivery],
  phrases: [
    'Hi Dana, this is a reminder from Bayside Dental. Your cleaning is on Thursday at 2 30 in the afternoon. Reply yes to confirm, or call us to move it.',
    'Your weekly summary is ready. You closed 14 tickets, and your average first reply time was 6 minutes. Nice work.',
    'Welcome to chapter three. In this chapter, we cover how to set up your account, and how to invite the rest of your team.',
  ],

  Controls({ state, setState, busy }) {
    return <Steps label="Delivery" steps={STEPS} value={state.delivery} onPick={(delivery) => setState({ delivery })} disabled={busy} />
  },
})
