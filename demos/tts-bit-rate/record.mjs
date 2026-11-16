// Records the default line in the default voice at every bit rate the page offers, so the first
// press of each button plays at once. Run from the repo root: node demos/tts-bit-rate/record.mjs
// Real /v2/speak responses, saved as returned; re-run when the line, voice, or rates change.
import { readFileSync, writeFileSync } from 'node:fs'

const env = readFileSync('.env', 'utf8')
const key = env.match(/^DEEPGRAM_API_KEY=["']?([^"'\n]+)/m)?.[1]
if (!key) throw new Error('DEEPGRAM_API_KEY missing from .env')
const src = readFileSync('demos/tts-bit-rate/index.tsx', 'utf8')
const text = src.match(/const LINE =\s+'([^']+)'/)[1]
const voice = 'flux-wes-en'
const RATES = { mp3: ['8000', '16000', '24000', '32000', '48000'], opus: ['4000', '8000', '12000', '32000', '64000'] }
for (const [encoding, rates] of Object.entries(RATES)) {
  for (const bit_rate of rates) {
    const q = new URLSearchParams({ model: voice, encoding, bit_rate, ...(encoding === 'opus' ? { container: 'ogg' } : {}) })
    const res = await fetch(`https://api.deepgram.com/v2/speak?${q}`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error(`${encoding} ${bit_rate}: ${res.status} ${await res.text()}`)
    const body = Buffer.from(await res.arrayBuffer())
    const file = `demos/tts-bit-rate/clips/${encoding}-${bit_rate}.${encoding === 'mp3' ? 'mp3' : 'ogg'}`
    writeFileSync(file, body)
    console.log(file, res.headers.get('content-type'), body.length)
  }
}
