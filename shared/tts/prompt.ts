// Builds a text-to-speech feature's prompt.md, the TTS twin of shared/common/prompt.ts: instructions an
// AI coding agent follows to add this one feature to someone else's app. Every request in it comes
// from the feature object, so the prompt says exactly what the page sends. tests/prompt.test.ts
// fails when a committed prompt.md drifts from this output, and tests/live.test.ts sends every
// request it shows with a granted token (ttsPromptRequests below finds them).
import { TOKEN_TTL_SECONDS, type PromptMeta } from '../common/prompt'
import type { TtsFeature } from './feature'
import { LISTEN_URL } from './listen'
import { pieces, sessionUrl } from './session'
import { LATE_MS, tokenize, tokenUrl } from './tokens'
import { cutMessage, socketUrl } from './socket'
import { CLOSE_MESSAGE, closeMidLine } from './close'
import { isFlux, speakQuery, speakUrl, voiceName } from './speak'
import { callbackBody, isLow } from './callback'

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

// The webhook a callback prompt shows. The live check swaps in a real receiver before sending.
export const PROMPT_CALLBACK = 'https://your-app.example.com/api/tts-callback/<job id>'
export const PROMPT_TEXT_URL = 'https://your-app.example.com/api/tts-callback/<job id>/text'

// The example playback_offset in the prompt. The live check sends it as shown.
export const EXAMPLE_OFFSET_MS = 1000

const tokenSection = (socket: boolean) => `## Keep the API key on your server

The browser never sees \`DEEPGRAM_API_KEY\`. Add one server route, \`GET /api/token\`, that asks
Deepgram for a short-lived token and returns it as plain text:

${fence('http', `POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": ${TOKEN_TTL_SECONDS}}`)}

The response is JSON with \`access_token\`. The key needs the Member role or above. Refuse the route
to other sites: answer 403 when \`Sec-Fetch-Site\` is present and not \`same-origin\`.

${socket
  ? `In the browser, fetch a fresh token for every session and open the socket with it as a
subprotocol: \`new WebSocket(url, ['bearer', token])\`. A token only has to live long enough to
open the socket; an open socket outlives it.`
  : `In the browser, fetch a fresh token for every request and send it as
\`Authorization: Bearer <token>\`.`}`

const playSection = (encoding: string, rate: number, container?: string) => {
  const pcm = encoding === 'mulaw'
    ? `8-bit G.711 mu-law at ${rate / 1000} kHz, one byte a sample. Decode each byte to a float (the
standard G.711 table) before you queue it.`
    : `16-bit signed little-endian PCM at ${rate / 1000} kHz mono. A chunk can end halfway through a
sample: hold the odd byte and put it in front of the next chunk.`
  if (encoding === 'mp3' || encoding === 'opus') {
    const what = encoding === 'mp3' ? 'an MP3 file (`audio/mpeg`)' : 'an Ogg Opus file (`audio/ogg;codecs=opus`)'
    return `## Play the audio

The response is ${what}, compressed to the \`bit_rate\` you asked for. Read the whole body, then
\`AudioContext.decodeAudioData\` it and play the buffer. Its byte length is the size you would store
or send on.`
  }
  if (container === 'wav') {
    return `## Play the audio

The response is a WAV file. Read the whole body, then \`AudioContext.decodeAudioData\` it and play
the buffer.`
  }
  return `## Play the audio

There is no container, so there is nothing to wait for: play the audio as it arrives. The bytes are
${pcm} Turn each chunk into an \`AudioBuffer\` and queue it on one \`AudioContext\` so the
pieces play back to back.`
}

const doneSection = (items: string[]) => `## Done when

${items.map((i) => `- [ ] ${i}`).join('\n')}`

const aura = (voices: string[]) => voices.find((v) => v.startsWith('aura-2-'))

export function ttsPrompt<S>(feature: TtsFeature<S>, meta: PromptMeta): string {
  const state = feature.promptState ?? feature.variants.at(-1) ?? feature.initialState
  const voice = feature.voices[0]
  const params = feature.params(state)
  const name = meta.title.replace(/ \| Deepgram$/, '')
  const text = feature.phrases[0]
  const sent: Record<string, unknown> = { model: voice, ...params }
  const marked = feature.highlight.map((k) => `\`${k}=${sent[k]}\``).join(', ')
  const other = aura(feature.voices)
  const head = `<!-- Generated from the feature's index.tsx by shared/tts/prompt.ts. Do not edit by hand. -->
# Add ${name} to a web app with Deepgram

${feature.copy.lede}
`
  const voices = feature.auraOnly
    ? `\`${voice}\` (${voiceName(voice)}) is an Aura-2 voice, served on \`/v1/speak\`. ${feature.auraOnly}`
    : `\`${voice}\` (${voiceName(voice)}) is a Flux voice: Flux voices are served on \`/v2/speak\` only, and the
same request on \`/v1/speak\` is a 400.${other ? ` Aura-2 voices such as \`${other}\` go to \`/v1/speak\` with the same query.` : ''}`

  if (feature.tokens) {
    const [tok] = tokenize(text)
    return `${head}
Build a page that speaks an LLM's reply over a Deepgram text-to-speech socket while the reply is
still arriving, a token at a time. Live demo: ${meta.url}

## The connection

Open this socket. It is opened and run through every message below with a granted token before
this file ships.

${fence('text', tokenUrl(voice, params))}

${voices}

## Send tokens as they arrive

Don't wait for the whole reply. Send each token from your LLM as it comes, as its own text frame,
exactly as it came (Flux adds no spaces between them):

${fence('json', JSON.stringify({ type: 'Speak', text: tok }))}

The moment the reply is done, end the turn:

${fence('json', JSON.stringify({ type: 'Flush' }))}

Flux starts speaking before the text is complete: measured live on 2026-11-12, with a token every
60 ms the first audio came 467 ms after the first token, and 2.15 s of an 8.16 s reply was already
out before Flush. It holds back the tail of the reply until Flush, though: with Flush sent
${LATE_MS / 1000} s late, the last 3.85 s waited for it. So flush as soon as the last token is in.

The turn ends with \`SpeechMetadata\`.

${tokenSection(true)}

${playSection(String(params.encoding), Number(params.sample_rate))}

## Try it

Stream this reply in, a word every ${feature.tokens.tokenMs} ms:

> ${text}

${doneSection([
  'The first audio plays while the reply is still arriving.',
  'Flush goes out the moment the last token is in.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'Socket errors and closes show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
  }

  if (feature.session) {
    const configure = feature.session.configure?.(state)
    const [first] = pieces(text, feature.session.split)
    return `${head}
Build a page that speaks a line over one Deepgram text-to-speech socket, a turn at a time${configure ? ', with a\ncontrol the user can change while it talks' : ', and lists what the server reports for each turn'}. Live demo: ${meta.url}

## The connection

Open this socket. It is opened and run through every message below with a granted token before
this file ships.

${fence('text', sessionUrl(voice, params, Object.keys(configure ?? {})))}

${voices}

## Speak a turn at a time

Split the line into ${feature.session.split === 'phrase' ? 'short phrases, at commas as well as full stops,' : 'sentences'} and send each as its own turn.
${configure ? `Before a turn, if the setting changed since the last one you sent, send it first:

${fence('json', JSON.stringify({ type: 'Configure', ...configure }))}

Flux answers \`ConfigureSuccess\` and applies it from the next turn, with no reconnect. Configure sent
while a turn's text is already in does not change that turn, which is why the line is split.

` : ''}${fence('json', JSON.stringify({ type: 'Speak', text: `${first} ` }))}

${fence('json', JSON.stringify({ type: 'Flush' }))}

Each turn starts with \`SpeechStarted\` and its \`speech_id\`, streams its audio as binary frames, and
ends with \`SpeechMetadata\`: the same \`speech_id\`, \`audio_duration_ms\`, and
\`billable_character_count\`. Send the next turn when about a second of audio is left in your playback
queue. The server adds no space between turns, so end each one with a space. Keep the socket open
across turns; the voice carries its tone from one to the next.
${feature.close ? `
## Close the session and read the totals

After the last turn's \`SpeechMetadata\`, send:

${fence('json', JSON.stringify(CLOSE_MESSAGE))}

Flux answers with one last message, \`SessionMetadata\`, then closes the socket with code 1000:
\`total_audio_duration_ms\`, \`total_input_character_count\`, and \`total_billable_character_count\`
for every turn on the socket. In testing, each total equaled the sum of the turns' \`SpeechMetadata\`. Closing the
socket yourself, without \`Close\`, gets no \`SessionMetadata\`. Flush the last turn before you send
\`Close\`.
` : ''}
${tokenSection(true)}

${playSection(String(params.encoding), Number(params.sample_rate))}

## Try it

Speak this${configure ? ', and change the setting while it talks' : ''}:

> ${text}

${doneSection([
  'The socket URL and messages match the ones above, apart from the text.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  ...(configure ? ['Changing the setting while it talks changes the next turn, with no reconnect and no gap.'] : ['Every turn shows its speech_id, audio length and billable characters.']),
  ...(feature.close ? ['After the last turn, Close is sent and the page shows the totals from `SessionMetadata` next to the sum of the turns.'] : []),
  'Socket errors and closes show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
  }

  if (closeMidLine(feature)) {
    return `${head}
Build a page that speaks a line over a Deepgram text-to-speech socket and then closes the socket
without cutting off the end of the line. Live demo: ${meta.url}

## The connection

Open this socket. It is opened and run through every message below with a granted token before
this file ships.

${fence('text', socketUrl(voice, params))}

${voices}

Send the line as a text frame:

${fence('json', JSON.stringify({ type: 'Speak', text }))}

## Close it the graceful way

When you have sent your last line, don't call \`ws.close()\`. Send this text frame instead, even
while audio is still arriving:

${fence('json', JSON.stringify(CLOSE_MESSAGE))}

Deepgram finishes the text it already has, streams the rest of the audio, and then closes the
socket itself with code 1000. You don't need a Flush first. Keep handling binary frames until the
socket closes, and play every one. On \`/v2/speak\` (Flux), \`SpeechMetadata\` and then
\`SessionMetadata\` (with \`total_billable_character_count\`) arrive just before the close; on
\`/v1/speak\` (Aura-2) no message comes, only the audio and the close.

Measured live on 2026-11-13, with the close sent 600 ms after the line: Close delivered the whole
line on both endpoints (9.2-9.9 s of Flux audio after Close). Closing the socket from the client
instead kept only what had arrived, 0.6-1.7 s of audio, and the rest was lost.

${tokenSection(true)}

${playSection(String(params.encoding), Number(params.sample_rate))}

## Try it

Speak this, and send Close half a second later:

> ${text}

${doneSection([
  'The socket URL and messages match the ones above, apart from the text.',
  'The whole line plays even though Close went out while the audio was still arriving.',
  'The page waits for the server to close the socket (1000) instead of closing it first.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'Socket errors and closes show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
  }

  if (feature.callback) {
    const shown: Record<string, string | string[]> = { ...params, callback: PROMPT_CALLBACK }
    const method = String(params.callback_method ?? 'post').toUpperCase()
    const low = isLow(params)
    const setting = feature.highlight
      .filter((k) => k in shown)
      .map((k) => `\`${k}=${shown[k]}\``)
      .join(', ')
    return `${head}
Build a page with a text box and a Speak button that asks Deepgram text-to-speech for the audio by
callback: Deepgram answers at once with a \`request_id\`, makes the audio, and sends it to a webhook on
your server, which the page then plays. Live demo: ${meta.url}

## The request

This exact request, with a real webhook URL in place of the example one, is sent to the live API
before this file ships and comes back 200 with a \`request_id\`.

${fence('http', `POST ${speakUrl(voice)}?${speakQuery(voice, shown)}
Authorization: Bearer <token from /api/token>
Content-Type: application/json

${JSON.stringify(callbackBody(params, text, PROMPT_TEXT_URL))}`)}

The feature is ${setting}. ${voices}

The response holds no audio, only \`{"request_id": "..."}\`. \`callback_method\` is \`post\` (the default)
or \`put\`, lowercase. ${low ? `\`priority=low\` (lowercase) queues the job as a batch: the body is then \`{"url": ...}\`, a URL Deepgram
fetches the text from, not \`{"text"}\`. Use a Flux voice: checked live on 2026-11-13, Flux delivered within
seconds, while Aura-2 took the request and fetched the text but sent no audio.` : `With \`priority=low\` the body becomes \`{"url": ...}\`, a URL Deepgram fetches the text from.`}

## The webhook

Deepgram must reach it from the internet: \`http\` or \`https\`, on port 80, 443, 8080, or 8443. It
cannot reach \`localhost\`, so use your deployed URL or a tunnel while you build.

1. Before calling Deepgram, make a job: a random id, the text, and a created time, in memory. Put the
   id in the webhook path, because the delivery carries no \`request_id\` to match on.
2. Accept \`${method} /api/tts-callback/:id\`. The body is the audio file itself (\`content-type:
   audio/wav\` for the request above), not JSON. Store it on the job and answer 200. Any other
   status makes Deepgram retry, up to 10 times, 30 seconds apart.
3. Refuse anything that is not a job you made: unknown ids get a 404, a second delivery is ignored,
   and the body is capped (2 MB covers 400 characters of 24 kHz speech). Drop jobs after 10 minutes.${low ? `
4. For \`priority=low\`, also serve \`GET /api/tts-callback/:id/text\`: the job's text as \`text/plain\`.` : ''}

The page polls its own server (\`GET /api/tts-callback/:id\`, once a second, same-origin only) until
the audio is in, then plays it.

${tokenSection(false)}

## Play the audio

What the page gets from its own server is the WAV file Deepgram delivered. \`AudioContext.decodeAudioData\`
it and play the buffer.

## Try it

Speak:

> ${feature.phrases.join('\n> ')}

${doneSection([
  'The request matches the one above, apart from the text and the job id.',
  `The webhook takes the ${method} with the audio, and the page plays it a few seconds after the \`request_id\`.`,
  'Unknown ids, repeat deliveries and oversized bodies are refused.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'A failed request, or audio that never comes, shows a sentence that says what to do next.',
])}

Docs: ${feature.links.docs}
`
  }

  if (!feature.cutIn) {
    return `${head}
Build a page with a text box and a Speak button that sends the text to Deepgram text-to-speech and
plays the audio. Live demo: ${meta.url}

## The request

This exact request is sent to the live API before this file ships and comes back 200 with audio.

${fence('http', `POST ${speakUrl(voice)}?${speakQuery(voice, params)}
Authorization: Bearer <token from /api/token>
Content-Type: application/json

${JSON.stringify({ text })}`)}

${marked ? `The feature is ${marked}. ` : ''}${voices}

${tokenSection(false)}

${playSection(String(params.encoding), Number(params.sample_rate), params.container as string | undefined)}

## Try it

Speak:

> ${feature.phrases.join('\n> ')}

${doneSection([
  'The request matches the one above, apart from the text.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'A failed request shows a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
  }

  const cut = cutMessage(voice, EXAMPLE_OFFSET_MS)
  if (!isFlux(voice)) return clearPrompt(feature, meta, head, voices, cut, text)
  return `${head}
Build a page that speaks a line over a Deepgram text-to-speech socket, with a Cut in button that
works while the line is playing, the way a caller talks over a voice agent. Live demo: ${meta.url}

## The connection

Open this socket. It is opened and run through every step below with a granted token before this
file ships.

${fence('text', socketUrl(voice, params))}

${voices}

Send the line as two text frames:

${fence('json', JSON.stringify({ type: 'Speak', text }))}

${fence('json', JSON.stringify({ type: 'Flush' }))}

Flux answers \`SpeechStarted\` with a \`speech_id\`, streams the audio as binary frames, and ends the
turn with \`SpeechMetadata\`.

${tokenSection(true)}

${playSection(String(params.encoding), Number(params.sample_rate))}

Count how many milliseconds of audio have actually played since the socket opened. That is your
playback position, and Cut in needs it.

${feature.cutIn.listen ? `## Hear the user cut in

While the line plays, stream the mic (16 kHz mono 16-bit PCM, about 100 ms a frame, with
\`echoCancellation: true\`) to Flux speech-to-text on a second socket, opened the same way:

${fence('text', LISTEN_URL)}

When a \`TurnInfo\` message arrives with \`"event": "StartOfTurn"\`, the user has started talking:
cut in. Flux sends it about half a second into the speech. Keep a button as well, for people
without a mic. Without headphones the mic can hear the voice itself, so test with them first.

` : ''}## Cut in

When the user cuts in, stop playback in the page first, right away: don't wait for the server. Then
send, as a text frame:

${fence('json', JSON.stringify(cut))}

\`value\` is your playback position in ms (${EXAMPLE_OFFSET_MS} here), counted from the start of the
session, not the turn, so each Interrupt's value must be larger than the last. Flux stops the turn
and answers \`SpeechInterrupted\` with \`text_spoken\` (the words the user heard) and
\`text_remaining\` (the ones they didn't). In a voice agent, put \`text_spoken\` in the LLM context as
the assistant's turn. Throw away binary frames until the next \`SpeechStarted\`: they belong to the
interrupted line.

Then speak the answer on the same socket, no reconnect:

${fence('json', JSON.stringify({ type: 'Speak', text: feature.cutIn.reply }))}

${fence('json', JSON.stringify({ type: 'Flush' }))}

Measured live on 2026-11-12: with Interrupt the answer started 235-272 ms after the cut. Without it the
rest of the old line streams first, and the answer waits several seconds behind it.${other ? `

On \`/v1/speak\` (Aura-2) there is no Interrupt: send \`{"type":"Clear"}\` instead and throw away
binary frames until \`Cleared\` arrives. There is no \`text_spoken\`.` : ''}

## Try it

Speak this, and cut in a second or two into it:

> ${text}

${doneSection([
  'The socket URL and messages match the ones above, apart from the text and the playback position.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'Cut in silences the audio at once, and the answer starts in well under a second.',
  'After a cut, `text_spoken` matches what you heard.',
  'Socket errors and closes show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
}

// A cut-in on the Aura-2 socket (/v1/speak): Clear, Cleared, then the reply on the same socket.
function clearPrompt<S>(feature: TtsFeature<S>, meta: PromptMeta, head: string, voices: string, cut: object, text: string): string {
  const params = feature.params(feature.promptState ?? feature.variants.at(-1) ?? feature.initialState)
  const reply = feature.cutIn?.reply ?? ''
  return `${head}
Build a page that speaks a line over a Deepgram text-to-speech socket, with a Cut in button that
works while the line is playing, the way a caller talks over a voice agent. Live demo: ${meta.url}

## The connection

Open this socket. It is opened and run through every step below with a granted token before this
file ships.

${fence('text', socketUrl(feature.voices[0], params))}

${voices}

Send the line as two text frames:

${fence('json', JSON.stringify({ type: 'Speak', text }))}

${fence('json', JSON.stringify({ type: 'Flush' }))}

The server answers \`Metadata\` when the socket opens, streams the audio as binary frames, and ends
the line with \`{"type":"Flushed","sequence_id":0}\`. Each Flush you send gets the next
\`sequence_id\`.

${tokenSection(true)}

${playSection(String(params.encoding), Number(params.sample_rate))}

Keep every queued \`AudioBufferSourceNode\` so you can stop them. Audio arrives faster than it plays
(about twice as fast, measured live on 2026-11-13), so at any moment some of the line is already in
the page but not yet heard.

## Cut in

When the user cuts in, stop every queued source in the page first, right away. Clear cannot take
back audio the server already sent: only the page can silence it. Then send, as a text frame:

${fence('json', JSON.stringify(cut))}

The server drops the text and audio it has not sent yet and answers:

${fence('text', JSON.stringify({ type: 'Cleared', sequence_id: 0 }))}

\`sequence_id\` counts the Clear messages on this socket: 0 for the first, 1 for the second. A few
binary frames of the old line can arrive between your Clear and \`Cleared\` (0.04 to 0.56 s of audio
in testing): throw away every binary frame until \`Cleared\` arrives. The old line never sends its
\`Flushed\`.

Then speak the answer on the same socket, no reconnect:

${fence('json', JSON.stringify({ type: 'Speak', text: reply }))}

${fence('json', JSON.stringify({ type: 'Flush' }))}

Measured live on 2026-11-13 with four Aura-2 voices, cutting 1.5 s into a 211-character line:
\`Cleared\` came back in 20 to 198 ms and the answer's first audio 96 to 198 ms after the cut. Without
Clear the rest of the old line (about 8 s of audio) streams first, and the answer waits behind it.
Send Clear before the answer's Speak, not after: a Clear sent after it clears the answer too.

## Try it

Speak this, and cut in a second or two into it:

> ${text}

${doneSection([
  'The socket URL and messages match the ones above, apart from the text.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'Cut in silences the audio at once, including what was already queued in the page.',
  'Binary frames between Clear and `Cleared` are dropped, and the answer starts in well under a second.',
  'Socket errors and closes show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
}

export interface TtsPromptRequests {
  // Each POST shown: the full URL and the JSON body.
  posts: { url: string; body: string }[]
  // Each socket shown, with the JSON messages in the order the prompt sends them.
  sockets: { url: string; messages: Record<string, unknown>[] }[]
  // Speech-to-text sockets shown, for a voice cut-in: each must open with a granted token.
  listens: string[]
}

// Everything the live check has to prove for a TTS prompt.
export function ttsPromptRequests(md: string): TtsPromptRequests {
  const blocks = [...md.matchAll(/```(\w*)\n([\s\S]*?)\n```/g)].map((m) => ({ lang: m[1], body: m[2] }))
  const posts = blocks
    .filter((b) => b.lang === 'http' && b.body.startsWith('POST https://api.deepgram.com/v') && b.body.includes('/speak?'))
    .map((b) => ({ url: b.body.split('\n')[0].replace(/^POST /, ''), body: b.body.split('\n\n').at(-1) ?? '' }))
  const urls = blocks.map((b) => b.body.trim()).filter((b) => b.startsWith('wss://api.deepgram.com/'))
  const messages = blocks.filter((b) => b.lang === 'json').map((b) => JSON.parse(b.body) as Record<string, unknown>)
  const speakUrls = urls.filter((u) => u.includes('/speak?'))
  return { posts, sockets: speakUrls.map((url) => ({ url, messages })), listens: urls.filter((u) => u.includes('/listen?')) }
}
