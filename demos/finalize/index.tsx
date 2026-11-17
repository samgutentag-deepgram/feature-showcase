// Finalize on Nova-3: flush the audio Deepgram is holding into a final result now, like a
// push-to-talk release, and keep the socket open for the next line.
// Checked live 2026-11-16 on /v1/listen (model=nova-3&endpointing=1000, a 3.5 s line streamed at
// real time): Finalize came back as Results from_finalize (also speech_final) in 38 to 113 ms, and
// the socket stayed open. Without it, speech_final came after 1.21 s of silence. endpointing=1500 or
// 2000 never sent speech_final on the words (an is_final without it, then nothing), so the page
// uses 1000. Flux answers Finalize with Error UNPARSABLE_CLIENT_MESSAGE and closes the socket.
import { defineFeature, type Json, type Params, type Run, type SttEvent } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'
import './styles.css'

type State = Record<string, never>

const FINALIZE = { type: 'Finalize' }

// Seconds of audio Deepgram heard after the last word before it closed the result: the end of the
// result's audio window minus the end of its last word.
function silenceAfter(msg: Json | undefined): number | undefined {
  const alt = ((msg?.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
  const words = (alt?.words as Array<{ end: number }> | undefined) ?? []
  if (!words.length || typeof msg?.start !== 'number' || typeof msg?.duration !== 'number') return undefined
  return Math.max(0, msg.start + msg.duration - words[words.length - 1].end)
}

interface Final {
  how: 'finalize' | 'endpointing'
  // Finalize only: press to answer, in ms.
  ms?: number
  silence?: number
  text: string
}

// Each final result in a run that has words, and what closed it.
export function finals(events: SttEvent[]): Final[] {
  const out: Final[] = []
  let pressedAt: number | undefined
  for (const e of events) {
    if (e.sent && e.name === 'Finalize') pressedAt = e.ms
    const text = String(((e.msg?.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]?.transcript ?? '')
    if (e.name === 'Results from_finalize') {
      if (text) out.push({ how: 'finalize', ms: pressedAt === undefined ? undefined : e.ms - pressedAt, silence: silenceAfter(e.msg), text })
      pressedAt = undefined
    } else if (e.name === 'Results speech_final' && text) {
      out.push({ how: 'endpointing', silence: silenceAfter(e.msg), text })
    }
  }
  return out
}

function Summary({ run }: { run?: Run<State> }) {
  const rows = finals(run?.events ?? [])
  if (!rows.length) return null
  return (
    <ul className="fin-summary" aria-label="What closed each line">
      {rows.map((r, i) => (
        <li key={i} className={r.how === 'finalize' ? 'is-finalize' : ''}>
          <span className="fin-summary__how">{r.how === 'finalize' ? 'Finalize' : 'speech_final'}</span>
          <span className="fin-summary__time">
            {r.how === 'finalize'
              ? `${r.ms === undefined ? '?' : Math.round(r.ms)} ms after the press`
              : `after ${r.silence?.toFixed(2) ?? '?'} s of silence`}
          </span>
          {r.how === 'finalize' && r.silence !== undefined && (
            <span className="fin-summary__note">{r.silence.toFixed(2)} s of silence heard before it</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default defineFeature<State>({
  copy: {
    headline: 'Done talking? Say so.',
    lede: 'Read the line, then press Finalize now the moment you stop. Deepgram turns what it is holding into a final result right away, instead of waiting out a second of silence. Run it again without the button to compare.',
    ctaTitle: 'Send {"type":"Finalize"} when your user lets go.',
    ctaBody: (
      <>
        <code>Finalize</code> flushes the audio buffered on a <code>/v1/listen</code> stream into a final
        result marked <code>from_finalize: true</code>, and leaves the socket open for the next line.
        Use it for push-to-talk, or whenever your app knows the speaker is done before silence can
        tell. To close the stream as well, send <code>CloseStream</code>. New accounts start with $200
        in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/finalize' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support Finalize yet: /v2/listen answers it with an Error and closes the socket. Flux ends a turn early with its own ForceEndTurn message instead (see the flux-force-end-turn demo).',
    },
  ],
  // Live mic only. Runs stay side by side: one with the button, one waiting for endpointing.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: {},
  variants: [{}],

  // Endpointing at 1000 ms, so the wait Finalize skips is long enough to see. Checked live: at 1500
  // or 2000 Nova-3 never sent speech_final on the words.
  params: (): Params => ({ endpointing: '1000' }),
  highlight: ['endpointing'],

  runLabel: () => 'endpointing=1000',
  compareTip: () => 'Run it again: this time press Finalize now (or do not), and compare what closed each line.',

  phrases: () => ['Book a table for four at seven thirty tonight, by the window.'],

  actions: () => [{ label: 'Finalize now', message: FINALIZE, ack: ['Results from_finalize'], primary: true }],
  timeline: { mark: ['Finalize', 'Results from_finalize', 'Results speech_final'] },

  // The last final result with words, and what closed it.
  echo: (msg) => {
    if (msg.type !== 'Results' || msg.is_final !== true) return undefined
    const transcript = String(((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]?.transcript ?? '')
    if (!transcript) return undefined
    return { from_finalize: msg.from_finalize === true, speech_final: msg.speech_final === true, transcript }
  },

  Controls() {
    return (
      <p className="note">
        Press <strong>Start mic</strong>, read the line, and press <strong>Finalize now</strong> as you
        finish the last word. The socket stays open, so you can read it again and press again.
      </p>
    )
  },

  Response({ latest }) {
    const e = latest?.echoed as { from_finalize: boolean; speech_final: boolean; transcript: string } | undefined
    if (!e) return <span className="wire__key">The last final result shows up here after a run.</span>
    return (
      <>
        <span className="wire__part">
          <span className="wire__key">"from_finalize":</span> {e.from_finalize ? <mark>true</mark> : 'false'},{' '}
        </span>
        <span className="wire__part">
          <span className="wire__key">"speech_final":</span> {String(e.speech_final)},{' '}
        </span>
        <span className="wire__part wire__part--text">
          <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)}
        </span>
      </>
    )
  },

  Result({ run, live }) {
    return (
      <>
        <PlainTranscript
          committed={run?.committed ?? []}
          pending={run?.pending ?? []}
          live={live}
          emptyText="Your transcript shows up here. Read the line and press Finalize now as you finish."
        />
        <Summary run={run} />
      </>
    )
  },
})
