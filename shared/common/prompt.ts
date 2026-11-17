// Builds a feature's prompt.md: instructions an AI coding agent follows to add this one feature to
// someone else's app. Every request in it comes from the feature object itself, so the prompt says
// exactly what the page sends. tests/prompt.test.ts fails when a committed prompt.md drifts from
// this output, and tests/live.test.ts opens every URL and Settings message the prompt shows.
import { BATCH_MAX_SECONDS, requestParams, SAMPLE_RATE, shownParams, toQuery } from './config'
import type { Feature, Json, Model, Params, SttAction } from './feature'
import { LISTEN_REST } from '../stt/batch'
import { AGENT_URL, INPUT_RATE, LISTEN_MODELS, OUTPUT_RATE, settingsMessage, type AgentFeature } from '../agent/feature'

export const TOKEN_TTL_SECONDS = 30

// The setting that shows the feature off: the one that sends the most.
function richest<S>(variants: S[], size: (s: S) => number): S {
  return variants.reduce((best, s) => (size(s) > size(best) ? s : best), variants[0])
}

export const streamUrl = (model: Model, params: Params) =>
  `wss://api.deepgram.com/${model.endpoint}/listen?${toQuery(requestParams(model, params))}`

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

const tokenSection = `## Keep the API key on your server

The browser never sees \`DEEPGRAM_API_KEY\`. Add one server route, \`GET /api/token\`, that asks
Deepgram for a short-lived token and returns it as plain text:

${fence('http', `POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": ${TOKEN_TTL_SECONDS}}`)}

The response is JSON with \`access_token\`. The key needs the Member role or above. A token only
has to live long enough to open the socket; an open socket outlives it. Refuse the route to other
sites: answer 403 when \`Sec-Fetch-Site\` is present and not \`same-origin\`.

In the browser, fetch a fresh token for every session and open the socket with it as a
subprotocol: \`new WebSocket(url, ['bearer', token])\`.`

const micSection = (rate: number) => `## Capture the mic

Use \`getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })\`
and an AudioWorklet that downsamples to ${rate / 1000} kHz mono and converts to 16-bit signed
little-endian PCM. Send each chunk (about 100 ms) as a binary WebSocket frame. Raw PCM has no
header, which is why the request names \`encoding=linear16\` and \`sample_rate=${rate}\`.`

const doneSection = (items: string[]) => `## Done when

${items.map((i) => `- [ ] ${i}`).join('\n')}`

export interface PromptMeta {
  title: string
  url: string
}

export function sttPrompt<S>(feature: Feature<S>, meta: PromptMeta): string {
  const mode = feature.modes[0]
  const ctx = (model: Model) => ({ model, mode, busy: false })
  const variants = feature.variants ?? [feature.initialState]
  const first = feature.models[0]
  // Prefer a setting with the feature switched on: a highlighted param sent as 'false' is the off state.
  const isOff = (p: Params) => feature.highlight.some((h) => p[h] === 'false')
  const on = feature.promptState ?? richest(variants, (s) => {
    const p = feature.params(s, ctx(feature.models.find((m) => m.endpoint === 'v1') ?? first))
    return (isOff(p) ? 0 : 1e6) + JSON.stringify(p).length
  })
  const off = variants.find((s) => {
    const p = feature.params(s, ctx(first))
    return Object.keys(p).length === 0 || isOff(p)
  })
  const marked = feature.highlight.map((h) => `\`${h}\``).join(', ')
  const name = meta.title.replace(/ \| Deepgram$/, '')

  if (mode.batch) return sttBatchPrompt(feature, meta, on)
  const models = feature.models.map((m, i) => {
    const params = feature.params(on, ctx(m))
    const shown = `/${m.endpoint}/listen?${toQuery(shownParams(m, params))}`
    return [
      `### ${i === 0 ? 'Use' : 'Or'} ${m.label}: \`/${m.endpoint}/listen\``,
      m.note ? `${m.note}\n` : '',
      'The params that matter, as a reader would copy them:',
      fence('', shown),
      'The exact URL to open, with the audio format appended:',
      fence('', streamUrl(m, params)),
    ]
      .filter(Boolean)
      .join('\n\n')
  })

  const phrase = feature.phrases?.(on, ctx(first)) ?? []
  const v2 = feature.models.some((m) => m.endpoint === 'v2')
  const v1 = feature.models.some((m) => m.endpoint === 'v1')
  // The v1 model's own label: Nova-3 for most, Nova-2 for a legacy page.
  const v1Label = feature.models.find((m) => m.endpoint === 'v1')?.label ?? 'Nova-3'
  const results = [
    v2 ? '- Flux (`/v2/listen`): a message with `"type": "TurnInfo"` and `"event": "EndOfTurn"` carries the finished turn in `transcript`.' : '',
    v1 ? `- ${v1Label} (\`/v1/listen\`): a message with \`"type": "Results"\` and \`"is_final": true\` carries it in \`channel.alternatives[0].transcript\`.` : '',
  ].filter(Boolean)

  return `<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add ${name} to a web app with Deepgram

${feature.copy.lede}

Build a page with a mic button that streams speech to Deepgram and shows the final transcript,
with ${marked} set as below. Live demo: ${meta.url}

## The request

Every URL here is opened against the live API before this file ships.

${models.join('\n\n')}

Send repeated params once per value (\`keyterm=a&keyterm=b\`), never comma-joined. Build the query with
\`URLSearchParams\` and \`append\`, which encodes a space in a value as \`+\`.

${tokenSection}

${micSection(SAMPLE_RATE)}

## Read the transcript

${results.join('\n')}

## Stop without losing the last words

${[
    v2 ? '- Flux: send `{"type": "ForceEndTurn"}` as a text frame, wait for the `EndOfTurn` it produces, then send `{"type": "CloseStream"}`. `CloseStream` alone closes at once and drops a turn still in progress.' : '',
    v1 ? `- ${v1Label}: send \`{"type": "CloseStream"}\` as a text frame and wait for the socket to close; the last final results arrive first.` : '',
  ]
    .filter(Boolean)
    .join('\n')}

${sttActionsSection(feature.actions?.(on, ctx(first)) ?? [])}## Try it

Read this aloud${off ? ` twice: once without ${marked}, once with` : ''}:

> ${phrase.join('\n> ')}

${doneSection([
  `The page streams the mic to the URL above, with ${marked} exactly as shown.`,
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'Reading the phrase above shows the difference the feature makes, in the final transcript.',
  'Mic errors and socket closes show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
}

export function agentPrompt<S>(feature: AgentFeature<S>, meta: PromptMeta): string {
  const on = richest(feature.variants, (s) => JSON.stringify(feature.agent(s)).length)
  const listen = LISTEN_MODELS[0]
  const settings = settingsMessage(feature, on, listen.id)
  const others = LISTEN_MODELS.slice(1).map((m) => `\`${m.id}\``).join(', ')
  const name = meta.title.replace(/ \| Deepgram$/, '')
  const ex = feature.functionExample
  const acts = feature.actions?.(on) ?? []
  const midCall = acts.length
    ? `## Mid-call messages

Once \`SettingsApplied\` has arrived, these go on the same socket as text frames, one per button.
Each is sent live before this file ships and comes back with the message named under it.

${acts.map((a) => `**${a.label}**${a.flush ? ' (also drop the agent audio still queued on the page)' : ''}

${fence('json', JSON.stringify(a.message, null, 2))}

Comes back: ${a.ack.map((t) => `\`${t}\``).join(' or ')}.${a.then ? `

Once it does, send this too${a.then.behavior === 'interrupt' ? ' (and drop the queued agent audio)' : ''}:

${fence('json', JSON.stringify(a.then, null, 2))}` : ''}`).join('\n\n')}

`
    : ''
  const calls = feature.onFunctionCall && ex
    ? `## Answer function calls

When the agent decides to call a function it sends \`FunctionCallRequest\` with a \`functions\`
array. For each entry with \`"client_side": true\`, parse \`arguments\` (a JSON string), run your
code, and reply on the same socket:

${fence('json', JSON.stringify({ type: 'FunctionCallResponse', id: '<the id from the request>', name: ex.name, content: JSON.stringify(feature.onFunctionCall(ex.name, ex.args, on)) }, null, 2))}

\`content\` is a string: JSON-encode your result. For the phrase below, the request names
\`${ex.name}\` with arguments \`${JSON.stringify(ex.args)}\`.

`
    : ''

  return `<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add ${name} to a web app with Deepgram

${feature.copy.lede}

Build a page with a Start button that opens a voice conversation with a Deepgram voice agent
configured by the Settings message below. Live demo: ${meta.url}

## The connection

Open \`${AGENT_URL}\` and send this Settings message first, as a text frame. It is sent to the live
API before this file ships and comes back \`SettingsApplied\`.

${fence('json', JSON.stringify(settings, null, 2))}

\`listen\` uses ${listen.label} (\`${listen.id}\`), built for turn-taking. ${others} also works as the listen model.

${tokenSection}

${micSection(INPUT_RATE)}

Start sending mic audio only after \`SettingsApplied\` arrives.

## Play the agent

Binary frames from the agent are ${OUTPUT_RATE / 1000} kHz mono 16-bit PCM with no container. Queue them
on an AudioContext so they play back to back.${feature.flushOnUserSpeech(on) ? ` When \`UserStartedSpeaking\` arrives, stop and drop everything still queued, so the user can interrupt.` : ''}

${calls}${midCall}## Try it

Say:

> ${feature.phrases(on).join('\n> ')}

${doneSection([
  'The first message on the socket matches the Settings message above, apart from your own prompt and greeting.',
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  ...(ex ? [`Saying the phrase makes the agent call \`${ex.name}\`, the page answers, and the agent speaks the result.`] : []),
  'Mic errors and socket closes show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
}

// Everything the live check has to prove for a prompt: each wss:// URL opens, each Settings applies,
// each pre-recorded POST to /v1/listen comes back 200 (listenPosts).
export function promptRequests(md: string): { urls: string[]; settings: Json[]; listenPosts: string[] } {
  const blocks = [...md.matchAll(/```(\w*)\n([\s\S]*?)\n```/g)].map((m) => ({ lang: m[1], body: m[2] }))
  const urls = blocks.map((b) => b.body.trim()).filter((b) => b.startsWith('wss://api.deepgram.com/'))
  const settings = blocks
    .filter((b) => b.lang === 'json')
    .map((b) => JSON.parse(b.body) as Json)
    .filter((j) => j.type === 'Settings')
  const listenPosts = blocks
    .filter((b) => b.lang === 'http' && b.body.startsWith(`POST ${LISTEN_REST}?`))
    .map((b) => b.body.split('\n')[0].replace(/^POST /, ''))
  return { urls, settings, listenPosts }
}

// ---- Speech-to-text extensions (2026-11-16) -------------------------------------------------------

// Mid-stream messages, one per button. tests/live.test.ts sends each from the feature itself and
// waits for its ack, so the prompt only repeats them.
function sttActionsSection(actions: SttAction[]): string {
  const sent = actions.filter((a) => a.message)
  if (!sent.length) return ''
  return `## Mid-stream messages

While the socket is open, these go on it as text frames, one per button. Each is sent live before
this file ships.

${sent
  .map((a) => {
    const how = [
      a.audio === 'pause' ? 'Stop sending mic audio first; keep the socket open.' : '',
      a.every ? `Send it again every ${a.every / 1000} s while the audio is paused.` : '',
      a.ends ? 'After this, stop the mic and wait for the socket to close.' : '',
      a.ack?.length ? `Comes back: ${a.ack.map((t) => `\`${t}\``).join(' or ')}.` : 'Nothing comes back; the socket stays open.',
    ].filter(Boolean)
    return `**${a.label}**\n\n${fence('json', JSON.stringify(a.message, null, 2))}\n\n${how.join(' ')}`
  })
  .join('\n\n')}

`
}

// A batch (pre-recorded) feature: record or pick a clip, POST it once, read the JSON.
function sttBatchPrompt<S>(feature: Feature<S>, meta: PromptMeta, on: S): string {
  const mode = feature.modes[0]
  const model = feature.models[0]
  const ctx = { model, mode, busy: false }
  const params = feature.params(on, ctx)
  const marked = feature.highlight.map((h) => `\`${h}\``).join(', ')
  const name = meta.title.replace(/ \| Deepgram$/, '')
  const url = `${LISTEN_REST}?${toQuery(requestParams(model, params, mode))}`
  const phrase = mode.source === 'mic' ? feature.phrases?.(on, ctx) ?? [] : []
  const callback = feature.callback
    ? `

## Receive the callback

With \`callback\`, Deepgram answers the POST at once with only \`{"request_id": ...}\` and later
POSTs the full transcript JSON to that URL. It must be a public HTTPS URL on your server (a
localhost URL is refused with a 400, "Invalid callback URL"). Store the JSON by job id and let the
page poll for it.`
    : ''
  return `<!-- Generated from the feature's index.tsx by shared/common/prompt.ts. Do not edit by hand. -->
# Add ${name} to a web app with Deepgram

${feature.copy.lede}

Build a page that ${mode.source === 'mic' ? 'records a few seconds from the mic' : 'takes a short audio clip'} and sends it
to Deepgram's pre-recorded endpoint with ${marked} set as below. Live demo: ${meta.url}

## The request

${model.note ? `${model.note}\n\n` : ''}This param works on pre-recorded audio only, so the clip goes in one POST. The request is sent
against the live API before this file ships.

${fence('http', `POST ${url}
Authorization: Bearer <token from /api/token>
Content-Type: audio/wav

<the audio bytes>`)}

${tokenSection.replace(" and open the socket with it as a\nsubprotocol: \`new WebSocket(url, ['bearer', token])\`.", ' and send it as `Authorization: Bearer <token>`. Deepgram answers CORS\nfor browser requests.')}
${mode.source === 'mic' ? `
## Record the mic

Capture the mic at ${SAMPLE_RATE / 1000} kHz mono, 16-bit PCM, keep the chunks until the visitor stops
(cap it at ${BATCH_MAX_SECONDS} s), and wrap them in a 44-byte WAV header. With the header, the POST needs no
\`encoding\` or \`sample_rate\`.
` : ''}
## Read the result

The response is JSON. The transcript is in \`results.channels[0].alternatives[0].transcript\`, with
one entry per word in \`words\` (\`speaker\` on each when diarizing, one channel per entry in
\`channels\` with \`multichannel=true\`).${callback}
${phrase.length ? `
## Try it

Read this aloud:

> ${phrase.join('\n> ')}
` : ''}
${doneSection([
  `The page POSTs the clip to the URL above, with ${marked} exactly as shown.`,
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'The result shows the fields the feature adds.',
  'Errors show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
}
