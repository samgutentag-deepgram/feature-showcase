// The opening of a Voice Agent session, run on a socket of its own with no mic and no agent audio:
// open, Welcome, Settings, SettingsApplied, then close. Each scenario breaks one rule of that order
// so the page can show the real Error the server sends back. No imports, so Node can run it as-is.

export type ScenarioId = 'ok' | 'audio-first' | 'audio-early' | 'twice' | 'malformed'

export interface Scenario {
  id: ScenarioId
  label: string
  what: string
}

export const SCENARIOS: Scenario[] = [
  { id: 'ok', label: 'Handshake', what: 'Wait for Welcome, send Settings, wait for SettingsApplied.' },
  { id: 'audio-first', label: 'Audio before Settings', what: 'After Welcome, send 100 ms of silent audio, then Settings.' },
  { id: 'audio-early', label: 'Audio before SettingsApplied', what: 'Send Settings, then 100 ms of silent audio straight after, without waiting.' },
  { id: 'twice', label: 'Settings twice', what: 'Send Settings, and once SettingsApplied arrives, send it again.' },
  { id: 'malformed', label: 'Malformed Settings', what: 'Send Settings with greeting at the top level instead of inside agent.' },
]

export interface Step {
  // Since the socket was created.
  ms: number
  kind: 'open' | 'sent' | 'got' | 'close'
  label: string
  detail?: string
}

export interface Outcome {
  scenario: ScenarioId
  steps: Step[]
  requestId?: string
  // The Error or Warning codes the server sent, in order.
  codes: string[]
  applied: boolean
  // Ms since the socket was created.
  openMs?: number
  welcomeMs?: number
  settingsMs?: number
  appliedMs?: number
}

type Msg = Record<string, unknown>

// 100 ms of silence at 16 kHz, 16-bit: the same framing the mic sends.
const SILENCE_BYTES = 3200

// open() makes the socket (the page passes a bearer token subprotocol; Node passes the key).
export function runScenario(scenario: ScenarioId, settings: { valid: Msg; malformed: Msg }, open: () => WebSocket, timeoutMs = 6000): Promise<Outcome> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const at = () => Math.round(performance.now() - t0)
    const out: Outcome = { scenario, steps: [], codes: [], applied: false }
    const step = (kind: Step['kind'], label: string, detail?: string) => out.steps.push({ ms: at(), kind, label, detail })
    let done = false
    let ws: WebSocket
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (ws.readyState <= 1) ws.close()
      resolve(out)
    }
    const timer = setTimeout(() => {
      step('close', 'gave up', `nothing more in ${timeoutMs / 1000} s`)
      finish()
    }, timeoutMs)
    const send = (msg: Msg, note?: string) => {
      if (ws.readyState !== 1) return
      ws.send(JSON.stringify(msg))
      if (msg.type === 'Settings' && out.settingsMs === undefined) out.settingsMs = at()
      step('sent', String(msg.type), note)
    }
    const sendAudio = () => {
      if (ws.readyState !== 1) return
      ws.send(new Uint8Array(SILENCE_BYTES))
      step('sent', 'audio', `${SILENCE_BYTES} bytes of silence (binary frame)`)
    }

    try {
      ws = open()
    } catch (err) {
      step('close', 'could not open', (err as Error).message)
      done = true
      clearTimeout(timer)
      resolve(out)
      return
    }
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      out.openMs = at()
      step('open', 'socket open')
    }
    ws.onerror = () => {}
    ws.onclose = (e) => {
      if (!done) step('close', 'socket closed', `code ${e.code}${e.reason ? `, ${e.reason}` : ''}`)
      finish()
    }
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') {
        step('got', 'audio', `${(e.data as ArrayBuffer).byteLength} bytes`)
        return
      }
      const m = JSON.parse(e.data) as Msg
      const type = String(m.type)
      if (type === 'Welcome') {
        out.welcomeMs = at()
        out.requestId = String(m.request_id ?? '')
        step('got', type, `request_id ${out.requestId}`)
        if (scenario === 'audio-first') {
          sendAudio()
          send(settings.valid)
        } else if (scenario === 'audio-early') {
          send(settings.valid)
          sendAudio()
        } else send(scenario === 'malformed' ? settings.malformed : settings.valid, scenario === 'malformed' ? 'greeting at the top level' : undefined)
        return
      }
      if (type === 'Error' || type === 'Warning') {
        out.codes.push(String(m.code))
        step('got', type, `${String(m.code)}: ${String(m.description ?? '')}`)
        // The server closes the socket after an Error; onclose finishes.
        return
      }
      if (type === 'SettingsApplied') {
        const first = !out.applied
        out.applied = true
        if (first) out.appliedMs = at()
        step('got', type)
        if (scenario === 'twice' && first) send(settings.valid, 'the same message again')
        // Hold the line a moment so a late Error or Warning still shows, then hang up.
        else if (scenario === 'ok' || scenario === 'audio-early') setTimeout(() => {
          step('close', 'closed by the page', 'no Error or Warning after 1 s')
          finish()
        }, 1000)
        return
      }
      step('got', type)
    }
  })
}
