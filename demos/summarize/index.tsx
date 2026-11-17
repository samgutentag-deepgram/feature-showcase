// summarize=v2: a support voicemail in, a few sentences out, on /v1/listen (recorded mic) and
// /v1/read (typed text). Input of 50 words or fewer comes back unchanged as the summary.
// Checked live 2026-11-16 with curl: /v1/read returns results.summary.text, /v1/listen returns
// results.summary.short (with result: "success"); a 16-word text came back word for word.
// Verified live 2026-11-16: ONLY=summarize pnpm verify:live passed (the 101-word voicemail on /v1/read, and spoken by Aura-2 on /v1/listen). curl: /v1/read returned summary.text and /v1/listen summary.short, three sentences naming Dana Whitfield, the grinding left leg motor, and the Monday deadline; a 16-word text came back unchanged.
import { defineLlmFeature, type LlmRun } from '../../shared/llm/feature'
import { analysis } from '../../shared/llm/request'
import './styles.css'

// No settings: summarize=v2 is the only value, so the page has one state.
type State = Record<string, never>

// 101 words, a realistic support voicemail. Over 50 words, so Deepgram summarizes it.
const VOICEMAIL =
  'Hi, this is Dana Whitfield calling about order 4817. The standing desk arrived on Tuesday, but the left leg motor makes a grinding noise and the desk stops about halfway up. I tried the reset steps from your manual twice, unplugging it for a full minute each time, and nothing changed. I work from home, so I really need this fixed before Monday. I would rather get a replacement motor than return the whole desk, since it took two of us to put it together. You can reach me at this number after three in the afternoon, or by email. Thanks.'

// 16 words: under the threshold, so the summary is this text back.
const SHORT = 'Hi, this is Dana. My standing desk stopped halfway up. Please call me back after three.'

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

function Pane({ title, text, muted }: { title: string; text: string; muted?: boolean }) {
  return (
    <div className="sum-pane">
      <h3 className="llm-section__title">
        {title}
        {!muted && <span className="sum-count">{words(text)} words</span>}
      </h3>
      <p className={muted ? 'llm-said llm-said--muted' : 'llm-said'}>{text}</p>
    </div>
  )
}

function SideBySide({ run }: { run?: LlmRun<State> }) {
  if (!run) {
    return (
      <div className="sum-grid">
        <Pane title="What you sent" text="Your transcript or text shows up here." muted />
        <Pane title="Summary" text="Deepgram's summary shows up here, beside it." muted />
      </div>
    )
  }
  const lane = run.lanes[0]
  const a = analysis(lane?.exchanges.at(-1)?.json)
  const input = a.transcript ?? run.text
  const echoed = a.summary !== undefined && a.summary.trim() === input.trim()
  return (
    <div className="llm-run">
      <div className="sum-grid">
        <Pane title={a.transcript !== undefined ? 'Transcript' : 'Text sent'} text={input} />
        {a.summary !== undefined ? (
          <Pane title="Summary" text={a.summary} />
        ) : (
          <Pane title="Summary" text={lane?.status === 'running' ? 'Waiting for Deepgram…' : 'No summary came back.'} muted />
        )}
      </div>
      {echoed && (
        <p className="note">
          The summary is the input, unchanged: it was {words(input)} words. Deepgram only summarizes more than 50.
        </p>
      )}
      {lane?.error && <p className="error">{lane.error}</p>}
    </div>
  )
}

export default defineLlmFeature<State>({
  kind: 'llm',
  api: 'intelligence',
  copy: {
    headline: 'What did that voicemail say?',
    lede: 'Read a support voicemail aloud or paste one in. Deepgram hands back a few sentences that say who called, what went wrong, and what they want.',
    ctaTitle: 'Add summarize=v2 to your next request.',
    ctaBody: (
      <>
        <code>summarize=v2</code> works on <code>/v1/listen</code> (pre-recorded audio) and <code>/v1/read</code> (text), in
        English. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/summarization' },
  inputs: [
    { id: 'mic', label: 'Speak', source: 'mic' },
    { id: 'text', label: 'Type', source: 'text' },
  ],
  initialState: {},
  variants: [{}],
  params: () => ({ summarize: 'v2' }),
  highlight: ['summarize'],
  runLabel: () => 'summarize=v2',
  texts: () => [VOICEMAIL, SHORT],
  phrases: () => [VOICEMAIL],
  Controls() {
    return (
      <p className="note">
        Summaries need more than 50 words. Anything shorter comes back unchanged as the summary; try the short chip on the
        Type tab to see it. The voicemail below is about 100 words, roughly 30 seconds to read.
      </p>
    )
  },
  Result({ run }) {
    return <SideBySide run={run} />
  },
})
