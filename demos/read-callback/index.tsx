// read-callback: /v1/read with summarize=v2 and callback=<URL>. Deepgram answers the POST at once with
// only a request_id, then delivers the summary to the callback URL. The demo's server.js is that URL,
// and it checks the Basic Auth credentials it put in the URL (the method the docs recommend).
// Checked 2026-11-16 with the key: POST /v1/read?language=en&summarize=v2&callback=https://example.com/...
// is 200 {"request_id": ...} in about 0.1 s; with deepgram:<password>@ in the URL, and with
// callback_method=put, also 200; an unresolvable host is 400 "Failed to resolve callback."; a
// localhost callback is 400 "Invalid callback URL.". Not yet seen: a real delivery, its shape, and
// whether it carries the Authorization header. Those need the deployed page (no request inspector was used).
// Verified live 2026-11-16: ONLY=read-callback pnpm verify:live POSTs the 116-word email to /v1/read?language=en&summarize=v2&callback=https://example.com/read-callback, with and without callback_method=put, and the prompt.md request with a granted token: each 200 with a request_id. Delivery and its Authorization header not observed before deploy.
// Verified on the deployed site 2026-11-17: Sam ran the page once on dg-devrel-demos.fly.dev and the summary arrived at the callback route and showed on the page. Its body shape, method and Authorization header were not written down; the Response card shows them.
import { useEffect, useState } from 'react'
import { demoPath } from '../../shared/common/demo'
import { defineLlmFeature, type Lane, type LlmRun } from '../../shared/llm/feature'
import { AnalysisView, DefaultResponse } from '../../shared/llm/Results'

interface State {
  put: boolean
}

// What demos/read-callback/server.js saw on the delivery.
interface Receipt {
  auth: 'passed' | 'missing'
  method: string
  contentType: string
  userAgent: string
  headers: string[]
}

const AUTH_TEXT: Record<Receipt['auth'], string> = {
  passed: 'passed: the delivery carried the one-time Basic Auth password from the callback URL',
  missing: 'failed: no Authorization header arrived. A production receiver should refuse this',
}

// 116 words. summarize needs more than 50, or the summary is the text back.
const EMAIL =
  'Hi team, following up on ticket 5521. Our nightly export to the analytics warehouse has failed three nights in a row since we upgraded to the new connector. The job starts on time, runs for about forty minutes, and then stops with a timeout while writing the largest table. Smaller tables finish fine. We already raised the timeout to two hours and doubled the worker memory, and neither helped. The finance team needs last week\'s numbers by Thursday morning for the board review, so this is urgent for us. Could someone look at the connector logs today, or tell us how to roll back to the previous version safely? I am online until six. Thanks, Priya.'

const SHORT = 'Hi, the nightly export failed again. Can someone check the connector logs today? Thanks, Priya.'

// Asks the receiver once what it saw on the delivery for this request_id.
function useReceipt(lane: Lane | undefined): Receipt | 'none' | undefined {
  const [got, setGot] = useState<{ id: string; r: Receipt | 'none' }>()
  const id = lane?.callback?.afterMs !== undefined ? lane.callback.requestId : ''
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

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'Send the text. Get the summary later.',
    lede: 'Type or keep the support email. Deepgram answers the POST at once with a request_id, then delivers the summary to a webhook on this page\'s server, which checks the Basic Auth password it put in the callback URL.',
    ctaTitle: 'Add callback=<your URL> to your next /v1/read request.',
    ctaBody: (
      <>
        With <code>callback</code>, <code>/v1/read</code> answers with a <code>request_id</code> and sends
        the analysis to your URL when it is done, retrying up to 10 times if your server does not answer
        2xx. Put <code>user:password@</code> in the URL to check that a delivery came from Deepgram. New
        accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/text-intelligence-callback' },
  // Text only: the callback applies to /v1/read, and the point is the async round trip, not the input.
  inputs: [{ id: 'text', label: 'Type', source: 'text' }],
  callback: true,
  initialState: { put: false },
  variants: [{ put: false }, { put: true }],
  params: ({ put }) => ({ summarize: 'v2', ...(put ? { callback_method: 'put' } : {}) }),
  highlight: ['callback', 'callback_method'],
  runLabel: ({ put }) => (put ? 'summarize, delivered by PUT' : 'summarize, delivered by POST'),
  texts: () => [EMAIL, SHORT],

  Controls({ state, setState, busy }) {
    return (
      <>
        <div className="segmented" role="radiogroup" aria-label="How Deepgram delivers">
          {[false, true].map((put) => (
            <button
              key={String(put)}
              role="radio"
              aria-checked={state.put === put}
              className={state.put === put ? 'segmented__opt is-on' : 'segmented__opt'}
              disabled={busy}
              onClick={() => setState({ put })}
            >
              {put ? 'Deliver with PUT' : 'Deliver with POST'}
            </button>
          ))}
        </div>
        <p className="hint">
          Checked with the API: the POST and its request_id, with and without a password in the URL.
          Not yet seen from this page: a real delivery and the header it carries. Your run shows both.
          Running locally stops before sending, because Deepgram cannot reach localhost.
        </p>
      </>
    )
  },

  Response({ latest }) {
    const lane = latest?.lanes[0]
    const cb = lane?.callback
    const receipt = useReceipt(lane)
    if (!cb) {
      if (lane?.status === 'error') return <span className="wire__key">No request_id: the run stopped before Deepgram took it.</span>
      return <span className="wire__key">The request_id shows up here as soon as Deepgram takes the POST, then what the webhook received.</span>
    }
    return (
      <>
        <span className="wire__part">
          <span className="wire__key">"request_id":</span> <mark>{JSON.stringify(cb.requestId)}</mark>
        </span>
        <br />
        {cb.afterMs === undefined ? (
          <span className="wire__key">
            {lane?.status === 'error' ? 'Accepted, but no delivery reached the webhook.' : 'Accepted. Waiting for Deepgram to call the webhook...'}
          </span>
        ) : (
          <>
            <span className="wire__key">delivered:</span>
            <br />
            <DefaultResponse latest={latest} />
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
                </span>
              </>
            )}
          </>
        )}
      </>
    )
  },

  Result({ run }) {
    if (!run) return <p className="llm-said llm-said--muted">The summary Deepgram delivers to the webhook shows up here.</p>
    const cb = run.lanes[0]?.callback
    return (
      <>
        <AnalysisView run={run as LlmRun<unknown>} />
        {cb && cb.afterMs === undefined && run.lanes[0]?.status === 'running' && (
          <p className="note">
            Deepgram took the POST in {cb.acceptedMs} ms and answered with only a request_id. The summary arrives at
            the webhook when it is ready; the page asks the server once a second for up to two minutes.
          </p>
        )}
      </>
    )
  },
})
