// KeepAlive on Nova-3: pause the mic audio and keep the same /v1/listen socket open, or send
// nothing and watch Deepgram close it. The close code and reason show on the page's error line.
// Checked live 2026-11-16 by script (macOS say clips, real time): with KeepAlive every 3 s through
// 14 s of no audio, the socket kept transcribing on the same request_id after audio resumed.
// Without it, Metadata then close 1011 "Deepgram did not receive audio data or a text message
// within the timeout window. See https://dpgr.am/net0001", 11.9 s after the last audio.
// Flux: KeepAlive gets Error UNPARSABLE_CLIENT_MESSAGE and the socket closes (1005); with no audio
// at all a Flux socket stayed open for 40 s, sent nothing meanwhile, and resumed the turn.
import { defineFeature, type Json, type Params, type SttEvent } from '../../shared/common/feature'
import { PlainTranscript } from '../../shared/stt/PlainTranscript'

type State = Record<string, never>

const KEEP_ALIVE = { type: 'KeepAlive' }
const WITH = 'Go quiet with KeepAlive'
const WITHOUT = 'Go quiet without KeepAlive'

const requestId = (m?: Json) => {
  const meta = m?.metadata as Json | undefined
  return String(meta?.request_id ?? m?.request_id ?? '')
}

// What the run did with the quiet, read from its timeline.
function story(events: SttEvent[], live: boolean): string {
  const paused = events.map((e) => e.name).lastIndexOf('audio paused')
  if (paused < 0) return live ? `Read the first line, then press ${WITH} or ${WITHOUT}.` : ''
  const after = events.slice(paused + 1)
  const keepAlives = after.filter((e) => e.sent && e.name === 'KeepAlive').length
  const resumed = after.find((e) => e.name === 'audio resumed')
  const closedAt = after.find((e) => e.name === 'Metadata')
  const secs = (e: SttEvent) => ((e.ms - events[paused].ms) / 1000).toFixed(1)
  if (resumed) {
    const ids = new Set(events.filter((e) => e.msg?.type === 'Results').map((e) => requestId(e.msg)).filter(Boolean))
    const same = ids.size === 1 ? ` Every transcript came back on one request_id, ${[...ids][0].slice(0, 8)}..., so it is the same socket.` : ''
    return `Quiet for ${secs(resumed)} s with ${keepAlives} KeepAlive message${keepAlives === 1 ? '' : 's'}, then audio again.${same}`
  }
  // Metadata also answers the CloseStream sent when the visitor stops the mic, so only a quiet
  // with nothing sent and long enough to hit the timeout reads as Deepgram closing it.
  if (closedAt && !live && !keepAlives && closedAt.ms - events[paused].ms >= 9000) {
    return `Deepgram closed the socket ${secs(closedAt)} s after the audio stopped, with nothing sent. The close code and reason it sent are in the line above the Request card (1011 with NET-0001 is the timeout, not an outage).`
  }
  if (!live) return `The run ended during the quiet, after ${keepAlives} KeepAlive message${keepAlives === 1 ? '' : 's'}.`
  if (live) {
    return keepAlives
      ? `Quiet, with a KeepAlive every 3 s. Wait past 12 s, press Resume audio, and read the second line.`
      : `Quiet, with nothing sent. Deepgram closes the socket about 10 to 12 s after the last audio.`
  }
  return ''
}

export default defineFeature<State>({
  copy: {
    headline: 'Go quiet for 12 seconds. Is Deepgram still listening?',
    lede: 'Start the mic and read the first line. Press Go quiet with KeepAlive, wait about 12 seconds, press Resume audio, and read the second line. Then run it again with Go quiet without KeepAlive and see Deepgram close the socket.',
    ctaTitle: 'Send {"type":"KeepAlive"} every 3 to 5 seconds while you have no audio.',
    ctaBody: (
      <>
        A <code>/v1/listen</code> socket that gets no audio and no message for about 10 seconds closes
        with <code>NET-0001</code>. A <code>KeepAlive</code> text frame resets that clock, gets no reply,
        and costs nothing to send. New accounts start with $200 in free credit.
      </>
    ),
  },
  links: { docs: 'https://developers.deepgram.com/docs/audio-keep-alive' },
  models: [
    {
      id: 'nova-3',
      label: 'Nova-3',
      endpoint: 'v1',
      params: { model: 'nova-3' },
      note: 'Nova-3 only. Flux does not support KeepAlive yet: /v2/listen answers it with an Error (UNPARSABLE_CLIENT_MESSAGE) and closes the socket. Flux does not time out the same way either: in testing, a Flux socket with no audio stayed open for 40 seconds and picked the turn back up when audio returned.',
    },
  ],
  // Live mic only. Runs stay side by side: one with KeepAlive, one without.
  modes: [{ id: 'mic', label: 'Mic', source: 'mic', compare: true }],
  initialState: {},
  variants: [{}],

  // KeepAlive is a message, not a query param: the request is the plain Nova-3 socket. The model
  // is the feature's own param here, marked, because it is the one thing the request must get
  // right (Flux rejects KeepAlive). Same value as the model's, so nothing extra is sent.
  params: (_state, { model }): Params => ({ model: String(model.params.model) }),
  highlight: ['model'],

  actions: () => [
    { label: WITH, audio: 'pause', message: KEEP_ALIVE, every: 3000, primary: true },
    { label: WITHOUT, audio: 'pause' },
    { label: 'Resume audio', audio: 'resume' },
  ],
  timeline: { mark: ['KeepAlive', 'audio paused', 'audio resumed', 'Metadata'] },

  runLabel: () => 'mic, then quiet',

  phrases: () => ['The meeting starts at nine.', 'I am back, and the same socket still hears me.'],

  // The socket's request_id and the last final transcript, so a reader can see the same socket
  // answering before and after the quiet. Metadata arrives just before Deepgram closes it.
  echo: (msg) => {
    if (msg.type === 'Metadata') return { type: 'Metadata', request_id: requestId(msg), duration: msg.duration }
    if (msg.type !== 'Results' || msg.is_final !== true) return undefined
    const alt = ((msg.channel as Json | undefined)?.alternatives as Json[] | undefined)?.[0]
    const transcript = String(alt?.transcript ?? '')
    return transcript ? { type: 'Results', request_id: requestId(msg), transcript } : undefined
  },

  Controls() {
    return null
  },

  Response({ latest }) {
    const e = latest?.echoed as { type: string; request_id: string; transcript?: string; duration?: number } | undefined
    if (!e) {
      return <span className="wire__key">KeepAlive gets no reply. The request_id of each answer shows up here.</span>
    }
    return (
      <span className="wire__part wire__part--text">
        <span className="wire__key">"type":</span> {JSON.stringify(e.type)}, <span className="wire__key">"request_id":</span>{' '}
        <mark>{JSON.stringify(e.request_id)}</mark>
        {e.transcript !== undefined && (
          <>
            , <span className="wire__key">"transcript":</span> {JSON.stringify(e.transcript)}
          </>
        )}
        {e.duration !== undefined && (
          <>
            , <span className="wire__key">"duration":</span> {e.duration}
          </>
        )}
      </span>
    )
  },

  Result({ run, live }) {
    const said = story(run?.events ?? [], live)
    return (
      <>
        {said && <p className="note">{said}</p>}
        <PlainTranscript
          committed={run?.committed ?? []}
          pending={run?.pending ?? []}
          live={live}
          emptyText="Your transcript shows up here. Read the first line, go quiet, then read the second."
        />
      </>
    )
  },
})
