// callback on Nova-3 pre-recorded: Deepgram answers the POST at once with only a request_id, then
// delivers the transcript to the callback URL. The demo's server.js is that URL, and it checks the
// Basic Auth credentials it put in the URL (the method the docs recommend).
// Checked 2026-11-16 with the key: POST /v1/listen?model=nova-3&callback=https://example.com/... is 200
// {"request_id": ...}; with deepgram:<password>@ in the URL, and with callback_method=put, also 200;
// a localhost callback is 400 "Invalid callback URL."; Flux /v2/listen with callback is 400 at the
// handshake. Not yet seen: a real delivery, and whether it carries the Authorization header. Those
// need the deployed page (no request inspector was used).
// Verified live 2026-11-16: pnpm verify:live POSTs Aura-2 speech of the phrase to /v1/listen?model=nova-3&smart_format=true&callback=https://example.com/stt-callback, with and without callback_method=put, and the prompt.md request with a granted token: each 200 with a request_id. Delivery not observed before deploy.
// Verified on the deployed site 2026-11-17: Sam ran the page once on dg-devrel-demos.fly.dev and the transcript arrived at the callback route and showed on the page. Its method and Authorization header were not written down; the Response card shows both.
import { useEffect, useState } from 'react'
import { defineFeature, type Json, type Params } from '../../shared/common/feature'
import { demoPath } from '../../shared/common/demo'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import { CALLBACK_SHOWN } from '../../shared/stt/batch'

interface State {
  put: boolean
}

interface Echo {
  requestId: string
  delivered: boolean
  transcript?: string
}

// What demos/callback/server.js saw on the delivery.
interface Receipt {
  auth: 'passed' | 'missing'
  method: string
  contentType: string
  userAgent: string
  headers: string[]
  dgToken: boolean
}

const AUTH_TEXT: Record<Receipt['auth'], string> = {
  passed: 'passed: the delivery carried the one-time Basic Auth password from the callback URL',
  missing: 'failed: no Authorization header arrived. A production receiver should refuse this',
}

export function echoCallback(msg: Json): Echo | undefined {
  const meta = msg.metadata as Json | undefined
  const requestId = String(meta?.request_id ?? msg.request_id ?? '')
  if (!requestId) return undefined
  if (!msg.results) return { requestId, delivered: false }
  const alt = (((msg.results as Json).channels as Json[] | undefined)?.[0]?.alternatives as Json[] | undefined)?.[0]
  return { requestId, delivered: true, transcript: String(alt?.transcript ?? '') }
}

function useReceipt(echo: Echo | undefined): Receipt | 'none' | undefined {
  const [got, setGot] = useState<{ id: string; r: Receipt | 'none' }>()
  const id = echo?.delivered ? echo.requestId : ''
  useEffect(() => {
    if (!id) return
    let stop = false
    fetch(`${demoPath()}api/receipt/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()) as Receipt) : 'none'))
      .catch(() => 'none' as const)
      .then((r) => !stop && setGot({ id, r }))
    return () => {
      stop = true
    }
  }, [id])
  return got && got.id === id ? got.r : undefined
}

export default defineFeature<State>({
  copy: {
    headline: 'Send the audio. Get the transcript later.',
    lede: 'Record a line. Deepgram answers the POST at once with a request_id, then delivers the transcript to a webhook on this page\'s server, which checks the Basic Auth password it put in the callback URL.',
    ctaTitle: 'Add callback=<your URL> to your next pre-recorded request.',
    ctaBody: (
      <>
        With <code>callback</code>, <code>/v1/listen</code> answers with a <code>request_id</code> and
        sends the transcript to your URL when it is done, retrying up to 10 times if your server does
        not answer 2xx. Put <code>user:password@</code> in the URL to check that a delivery came
        from Deepgram. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/callback' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support callback yet (/v2/listen answers it with a 400).',
    },
  ],
  // Pre-recorded: record the mic, then one POST. The webhook needs the deployed page; locally the
  // page says Deepgram cannot reach this machine.
  modes: [{ id: 'rec', label: 'Record', source: 'mic', batch: true }],
  callback: true,
  initialState: { put: false },
  variants: [{ put: false }, { put: true }],
  promptState: { put: false },

  // The page swaps CALLBACK_SHOWN for its own slot URL, with a one-time deepgram:<password>@ in it.
  params: ({ put }): Params => ({ smart_format: 'true', callback: CALLBACK_SHOWN, ...(put ? { callback_method: 'put' } : {}) }),
  highlight: ['callback', 'callback_method'],

  runLabel: ({ put }) => (put ? 'callback, PUT' : 'callback, POST'),

  phrases: () => ['Send this to my server when it is ready. I will not wait for the answer.'],

  echo: (msg) => echoCallback(msg),

  Controls({ state, setState, ctx }) {
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="How Deepgram delivers">
          {[false, true].map((put) => (
            <button
              key={String(put)}
              role="radio"
              aria-checked={state.put === put}
              className={state.put === put ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={ctx.busy}
              onClick={() => setState({ put })}
            >
              {put ? 'Deliver with PUT' : 'Deliver with POST'}
            </button>
          ))}
        </div>
        <p className="hint">
          Checked with the API: the POST and its request_id, with and without a password in the URL.
          Not yet seen from this page: a real delivery and the header it carries. Your run shows both.
        </p>
      </>
    )
  },

  Response({ latest }) {
    const echo = latest?.echoed as Echo | undefined
    const receipt = useReceipt(echo)
    if (!echo) {
      return <span className="wire__key">The request_id shows up here as soon as Deepgram takes the POST, then what the webhook received.</span>
    }
    return (
      <>
        <span className="wire__part">
          <span className="wire__key">"request_id":</span> <mark>{JSON.stringify(echo.requestId)}</mark>
        </span>
        <br />
        {!echo.delivered ? (
          <span className="wire__key">Accepted. Waiting for Deepgram to call the webhook...</span>
        ) : (
          <>
            <span className="wire__part wire__part--text">
              <span className="wire__key">delivered "transcript":</span> {JSON.stringify(echo.transcript ?? '')}
            </span>
            <br />
            {receipt === undefined && <span className="wire__key">Reading what the webhook saw...</span>}
            {receipt === 'none' && <span className="wire__key">The webhook kept no receipt for this request_id.</span>}
            {receipt && receipt !== 'none' && (
              <>
                <span className="wire__part wire__part--text">
                  <span className="wire__key">Basic Auth check:</span> <mark>{AUTH_TEXT[receipt.auth]}</mark>
                </span>
                <br />
                <span className="wire__part wire__part--text">
                  <span className="wire__key">arrived as:</span> {receipt.method} {receipt.contentType}
                  {receipt.userAgent ? `, user-agent ${receipt.userAgent}` : ''}
                </span>
                <br />
                <span className="wire__part wire__part--text">
                  <span className="wire__key">header names:</span> {receipt.headers.join(', ')}
                  {receipt.dgToken ? ' (includes dg-token)' : ''}
                </span>
              </>
            )}
          </>
        )}
      </>
    )
  },

  Result({ run, live }) {
    return (
      <PlainTranscript
        committed={run?.committed ?? []}
        pending={run?.pending ?? []}
        live={live}
        emptyText="The transcript Deepgram delivers to the webhook shows up here."
      />
    )
  },
})
