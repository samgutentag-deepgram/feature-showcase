// Builds prompt.md for an LLM-kind feature, from the same plan() the page sends. tests/prompt.test.ts
// fails when a committed prompt.md drifts from this, and `pnpm verify:live` sends every http block
// here with a granted token (tests/llm-live.ts).
import type { Json } from '../common/feature'
import { TOKEN_TTL_SECONDS, type PromptMeta } from '../common/prompt'
import { LISTEN_URL, READ_URL, THINK_URL, type ChatMessage, type LlmFeature, type ThinkBody } from './feature'
import { MIC_AUDIO, plan, thinkBodies, type AudioInfo } from './request'

// The webhook a prompt shows. A reserved example domain: Deepgram resolves it and answers with a
// request_id, so verify:live can send the prompt as written, and nothing real gets the result.
export const PROMPT_CALLBACK = 'https://example.com/deepgram-callback'
// The id the tool round in a prompt uses for its call.
export const PROMPT_CALL_ID = 'call_1'

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

const http = (url: string, type: string, body: string) =>
  fence('http', `POST ${url}\nAuthorization: Bearer <token>\nContent-Type: ${type}\n\n${body}`)

const richest = <S,>(variants: S[], size: (s: S) => number) => variants.reduce((best, s) => (size(s) > size(best) ? s : best), variants[0])

const tokenSection = `## Keep the API key on your server

The browser never sees \`DEEPGRAM_API_KEY\`. Add one server route, \`GET /api/token\`, that asks
Deepgram for a short-lived token and returns it as plain text:

${fence('http', `POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": ${TOKEN_TTL_SECONDS}}`)}

The response is JSON with \`access_token\`. Refuse the route to other sites: answer 403 when
\`Sec-Fetch-Site\` is present and not \`same-origin\`. In the browser, fetch a fresh token for every
request and send it as \`Authorization: Bearer <token>\`. Deepgram allows these requests from a
browser (CORS), so no proxy is needed.`

const doneSection = (items: string[]) => `## Done when

${items.map((i) => `- [ ] ${i}`).join('\n')}`

export function llmPrompt<S>(feature: LlmFeature<S>, meta: PromptMeta): string {
  const name = meta.title.replace(/ \| Deepgram$/, '')
  const marked = feature.highlight.map((h) => `\`${h}\``).join(', ')
  const head = `<!-- Generated from the feature's index.tsx by shared/llm/prompt.ts. Do not edit by hand. -->
# Add ${name} to a web app with Deepgram

${feature.copy.lede}`
  if (feature.api === 'think') return head + '\n\n' + thinkPrompt(feature, meta, marked)

  const on = richest(feature.variants, (s) => JSON.stringify(feature.params(s)).length)
  const text = feature.texts(on)[0] ?? ''
  const sources = new Set(feature.inputs.map((i) => i.source))
  const audio = sources.has('mic') || sources.has('sample')
  const [read] = plan(feature, on, 'text', text, { callback: feature.callback ? PROMPT_CALLBACK : undefined })
  const sampleAudio: AudioInfo = { note: 'your audio file', type: 'audio/wav' }
  const [listen] = plan(feature, on, 'mic', text, { audio: sources.has('mic') ? MIC_AUDIO : sampleAudio })
  const phrase = feature.phrases?.(on) ?? []

  const callback = feature.callback
    ? `## Take the result on a webhook

With \`callback\` set, Deepgram answers the POST at once with \`{"request_id": "..."}\` and later
POSTs the result to the callback URL (\`callback_method=put\` makes it a PUT). Replace
\`${PROMPT_CALLBACK}\` with a public URL on your server, on port 80, 443, 8080 or 8443. Answer the
delivery with a 2xx: Deepgram retries a failed one up to 10 times, 30 seconds apart. The browser
cannot take a webhook, so the page asks your server for the result by \`request_id\` until it lands.

`
    : ''

  return `${head}

Build a page that sends ${audio ? 'a recording or typed text' : 'typed text'} to Deepgram once, with ${marked}
set as below, and shows what comes back. Live demo: ${meta.url}

## The request

Every request here is sent to the live API before this file ships.

### Text: \`/v1/read\`

${http(read.url, read.contentType, read.body!)}

\`language=en\` is required on \`/v1/read\`; without it the request is a 400.
${audio ? `
### Audio: \`/v1/listen\`

The same params work on pre-recorded audio. Record the mic (or take a file), then send it in one POST:

${http(listen.url, listen.contentType, listen.shown.body.split('\n\n').at(-1) ?? '')}

Do not stream these: the \`/v1/listen\` WebSocket refuses \`topics\`, \`intents\` and \`summarize\` at the
handshake, and takes \`sentiment\` but sends no sentiment back.
` : ''}
${callback}${tokenSection}

## Read the response

${[
    '- `results.summary`: `text` on `/v1/read`, `short` on `/v1/listen`. Under about 50 words, the summary is the input itself.',
    '- `results.topics.segments[]`, `results.intents.segments[]`: `text`, `start_word`, `end_word`, and `topics[]` or `intents[]` with `confidence_score`.',
    '- `results.sentiments.segments[]` with `sentiment` and `sentiment_score` (-1 to 1), and `results.sentiments.average`.',
    audio ? '- `/v1/listen` also returns the transcript in `results.channels[0].alternatives[0].transcript`.' : '',
  ]
    .filter(Boolean)
    .join('\n')}

## Try it

${audio && phrase.length ? `Say this, then send the recording:\n\n> ${phrase.join('\n> ')}\n\nOr send this text:` : 'Send this text:'}

> ${text}

${doneSection([
  `The page sends the request above, with ${marked} exactly as shown.`,
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  'The result shows the fields that matter, not the raw JSON alone.',
  'Errors show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
}

function thinkPrompt<S>(feature: Extract<LlmFeature<S>, { api: 'think' }>, meta: PromptMeta, marked: string): string {
  // The variant that sends the most, model names aside, so a model toggle shows its first model.
  const on = richest(feature.variants, (s) => JSON.stringify([feature.think(s, '')].flat().map((b) => ({ ...b, model: '' }))).length)
  const text = feature.texts(on)[0] ?? ''
  const bodies = thinkBodies(feature, on, text)
  const first = bodies[0]
  const ex = feature.toolExample
  const streams = bodies.some((b) => b.stream)

  const requests = bodies
    .map((b, i) => `${bodies.length > 1 ? `**${i === 0 ? 'Model' : 'And the same request on'} \`${b.model}\`**\n\n` : ''}${http(THINK_URL, 'application/json', JSON.stringify(b, null, 2))}`)
    .join('\n\n')

  let tools = ''
  if (ex && feature.onToolCall) {
    const call = { id: PROMPT_CALL_ID, type: 'function' as const, function: { name: ex.name, arguments: JSON.stringify(ex.args) } }
    const assistant: ChatMessage = { role: 'assistant', content: null, tool_calls: [call] }
    const result: ChatMessage = { role: 'tool', tool_call_id: PROMPT_CALL_ID, content: JSON.stringify(feature.onToolCall(ex.name, ex.args, on)) }
    const next: ThinkBody = { ...first, messages: [...first.messages, assistant, result] }
    tools = `## Answer tool calls

When the reply's message has \`tool_calls\` (and \`finish_reason\` is \`"tool_calls"\`), run each one in
your app, then send the request again with the same \`tools\`, the assistant message appended as it
came back, and one \`tool\` message per call with your result, JSON-encoded, and the call's \`id\`.
\`function.arguments\` is a JSON string: parse it. For the text below the model calls
\`${ex.name}\` with \`${JSON.stringify(ex.args)}\`, and the follow-up looks like this:

${http(THINK_URL, 'application/json', JSON.stringify(next, null, 2))}

The endpoint is stateless: every request carries the whole conversation. Stop after a few rounds
if the model keeps calling tools.

`
  }

  const stream = streams
    ? `## Read the stream

With \`"stream": true\` the response is \`text/event-stream\`. Each \`data:\` line is a
\`chat.completion.chunk\`: append \`choices[0].delta.content\`, and build tool calls from
\`choices[0].delta.tool_calls\` by \`index\` (\`function.arguments\` arrives in pieces). Then come a chunk
with \`finish_reason\`, a chunk with an empty \`choices\` and the \`usage\`, and \`data: [DONE]\`. A
stream that ends without \`[DONE]\` broke off: treat it as failed. Time to first token is from
sending the request to the first chunk with content.

`
    : `## Read the reply

The response is a \`chat.completion\`: the reply is \`choices[0].message.content\`, and \`usage\` has
\`prompt_tokens\`, \`completion_tokens\`, and (Think-Fast) \`completion_tokens_details.reasoning_tokens\`.

`

  return `Build a page that sends a message to a Deepgram LLM, with ${marked} set as below, and shows the
reply. Live demo: ${meta.url}

Deepgram LLMs are in Early Access: the project must be enrolled, and fields can change before GA.

## The request

Every request here is sent to the live API before this file ships. The endpoint takes these
top-level fields only: \`model\`, \`messages\`, \`temperature\`, \`reasoning_effort\`, \`tools\`, \`stream\`,
\`stream_options\`, \`mip_opt_out\`. Anything else (\`max_tokens\`, \`top_p\`, \`tool_choice\`) is a 400.

${requests}

${tokenSection}

${stream}${tools}## Try it

Send:

> ${text}

${doneSection([
  `The page sends the request above, with ${marked} exactly as shown.`,
  '`DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.',
  ...(ex ? [`Sending the text above makes the model call \`${ex.name}\`, the page answers, and the reply uses the result.`] : []),
  'Errors show a sentence that says what to do next, not a stack trace.',
])}

Docs: ${feature.links.docs}
`
}

export interface LlmPromptRequest {
  url: string
  contentType: string
  body: string
  json?: Json
}

// Every POST a prompt shows to /v1/read, /v1/listen or /v1/think, for the live check. A listen
// body is a placeholder; the check sends real audio.
export function llmPromptRequests(md: string): LlmPromptRequest[] {
  return [...md.matchAll(/```http\n([\s\S]*?)\n```/g)]
    .map((m) => m[1])
    .filter((b) => [READ_URL, LISTEN_URL, THINK_URL].some((u) => b.startsWith(`POST ${u}`)))
    .map((b) => {
      const [head, ...rest] = b.split('\n\n')
      const lines = head.split('\n')
      const body = rest.join('\n\n')
      const contentType = lines.find((l) => l.startsWith('Content-Type: '))?.slice(14) ?? ''
      return { url: lines[0].replace(/^POST /, ''), contentType, body, json: contentType === 'application/json' ? (JSON.parse(body) as Json) : undefined }
    })
}
