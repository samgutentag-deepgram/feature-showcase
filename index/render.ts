// The site root. Builds the tiles, filter chips and coming-soon cards of / from index/demos.json and
// index/coming-soon.json, plus each demo's own meta.json, so a tile can never disagree with the page
// it links to. vite.config.ts calls renderIndex() on the repo-root index.html, in dev and in build.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export interface DemoEntry {
  id: string
  platform: string
  headline?: string
  param: string
  flux: string
  // Replaces "partly" in the 'partial' badge, e.g. "numbers only".
  flux_note?: string
}

export interface SoonEntry {
  id: string
  platform: string
  param: string
  what: string
  models?: string
  docs: string
  built?: boolean
}

interface DemoMeta {
  title: string
  description: string
}

// Filter chips, in Deepgram's product order. A product with no demos yet shows as disabled.
export const PRODUCTS = ['Speech-to-text', 'Text-to-speech', 'Voice agent', 'LLM']

// The model badge on each tile: [label, tooltip].
export const FLUX: Record<string, [string, string]> = {
  works: ['Flux and Nova-3', 'Works on both models.'],
  'built-in': ['Flux built in, Nova-3', 'Flux does this on its own; Nova-3 takes the param.'],
  'nova-only': ['Nova-3 only', 'Flux does not support this yet.'],
  partial: ['Nova-3, Flux partly', 'Nova-3 takes every option; Flux takes some of them.'],
  tts: ['Flux and Aura-2', 'Text-to-speech with Flux voices first, Aura-2 after.'],
  'tts-flux': ['Flux TTS only', 'Flux voices only: Aura-2 does not take this.'],
  'tts-aura': ['Aura-2 only', 'Aura-2 voices only: Flux does not take this.'],
  agent: ['Flux or Nova-3 listening', 'Voice agent; pick the speech-to-text model it listens with.'],
}

// Run from the repo root, as vite.config.ts and vitest are.
const ROOT = path.resolve('.')
export const DEMOS_FILE = path.join(ROOT, 'index', 'demos.json')
export const SOON_FILE = path.join(ROOT, 'index', 'coming-soon.json')

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

export const readDemoEntries = (): DemoEntry[] => JSON.parse(readFileSync(DEMOS_FILE, 'utf8')).demos
export const readSoonEntries = (): SoonEntry[] => JSON.parse(readFileSync(SOON_FILE, 'utf8')).features

const UPPER: Record<string, string> = {
  tts: 'TTS', stt: 'STT', eot: 'EOT', llm: 'LLM', io: 'I/O', byo: 'BYO', mip: 'MIP', ws: 'WebSocket', v2: 'v2',
}

// 'agent-byo-llm' -> 'BYO LLM'. The kicker already names the product, so drop its prefix.
export function soonTitle(id: string): string {
  let words = id.split('-')
  if (['agent', 'tts', 'stt'].includes(words[0]) && words.length > 1) words = words.slice(1)
  const out = words.map((w) => UPPER[w] ?? w)
  out[0] = out[0][0].toUpperCase() + out[0].slice(1)
  return out.join(' ').replaceAll('flux', 'Flux')
}

// Throws on data that would render wrong; the build should stop on a typo, not ship it.
export function validate(demos: DemoEntry[], soon: SoonEntry[]): void {
  const seen = new Set<string>()
  for (const d of demos) {
    if (seen.has(d.id)) throw new Error(`index/demos.json: ${d.id} is listed twice`)
    seen.add(d.id)
    if (!PRODUCTS.includes(d.platform)) throw new Error(`index/demos.json ${d.id}: unknown platform ${JSON.stringify(d.platform)}; add it to PRODUCTS in index/render.ts`)
    if (!(d.flux in FLUX)) throw new Error(`index/demos.json ${d.id}: unknown flux value ${JSON.stringify(d.flux)}; add it to FLUX in index/render.ts`)
  }
  for (const s of soon) {
    if (!PRODUCTS.includes(s.platform)) throw new Error(`index/coming-soon.json ${s.id}: unknown platform ${JSON.stringify(s.platform)}`)
  }
}

export interface RenderOptions {
  // Demos this build serves. An entry outside it gets no tile.
  built: string[]
  readMeta: (id: string) => DemoMeta
  // Called once per demos.json entry that has no folder under demos/ yet.
  warn?: (msg: string) => void
  demosOnDisk?: string[]
  demos?: DemoEntry[]
  soon?: SoonEntry[]
}

export function renderIndex(html: string, opts: RenderOptions): string {
  const all = opts.demos ?? readDemoEntries()
  const soonAll = opts.soon ?? readSoonEntries()
  validate(all, soonAll)
  const built = new Set(opts.built)
  const onDisk = new Set(opts.demosOnDisk ?? opts.built)
  for (const d of all) {
    if (!onDisk.has(d.id)) opts.warn?.(`index/demos.json: ${d.id} has no demos/${d.id}/ yet, so / leaves it out`)
  }
  const demos = all.filter((d) => built.has(d.id))

  const tiles = demos.map((d) => {
    const meta = opts.readMeta(d.id)
    const name = meta.title.replace(/ \| Deepgram$/, '')
    let [models, modelsTitle] = FLUX[d.flux]
    if (d.flux_note) models = models.replace('Flux partly', `Flux ${d.flux_note}`)
    const headline = d.headline ?? ''
    const hook = headline ? `\n          <p class="tile__hook">${esc(headline)}</p>` : ''
    const search = [name, headline, d.param, models, meta.description].join(' ').toLowerCase()
    return `      <a class="tile" href="/demos/${esc(d.id)}/" data-product="${esc(d.platform)}" data-search="${esc(search)}">
        <img src="/demos/${esc(d.id)}/og.png" alt="" width="1200" height="630" loading="lazy" />
        <div class="tile__body">
          <span class="tile__kicker">${esc(d.platform)}</span>
          <h2>${esc(name)}</h2>${hook}
          <p class="tile__desc">${esc(meta.description)}</p>
          <div class="tile__meta">
            <code>${esc(d.param)}</code>
            <span class="tile__models" title="${esc(modelsTitle)}">${esc(models)}</span>
          </div>
        </div>
      </a>`
  })

  // Backlog tiles: anything not marked built and not already live.
  const live = new Set(demos.map((d) => d.id))
  const order = (p: string) => PRODUCTS.indexOf(p)
  const soon = soonAll
    .filter((s) => !s.built && !live.has(s.id))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => order(a.s.platform) - order(b.s.platform) || a.i - b.i)
    .map(({ s }) => s)
  const soonTiles = soon.map((s) => {
    const showModels = s.models && s.models !== 'n/a'
    const early = s.models && s.models.split(';').every((m) => m.includes('Early Access'))
    const search = [s.id, s.param, s.what, s.platform].join(' ').toLowerCase()
    return `      <a class="tile tile--soon" href="${esc(s.docs)}" target="_blank" rel="noopener" data-product="${esc(s.platform)}" data-search="${esc(search)}">
        <div class="tile__body">
          <span class="tile__kicker">${esc(s.platform)}</span>
          <h2>${esc(soonTitle(s.id))}</h2>
          <p class="tile__desc">${esc(s.what)}</p>
          <div class="tile__meta">
            <code>${esc(s.param)}</code>
            ${showModels ? `<span class="tile__models">${esc(s.models!)}</span>` : ''}
          </div>
          <div class="tile__status">${early ? '<span class="ea">Early Access</span>' : '<span class="live">Live in the API</span>'}<span>Demo page coming soon</span><span class="docs">Read the docs →</span></div>
        </div>
      </a>`
  })

  const buttons = [
    `        <button type="button" class="chip" data-product="" aria-pressed="true">All <span>${demos.length}</span></button>`,
  ]
  for (const p of PRODUCTS) {
    const n = demos.filter((d) => d.platform === p).length
    const hasSoon = soon.some((s) => s.platform === p)
    const label = n ? `<span>${n}</span>` : '<span>soon</span>'
    const off = n || hasSoon ? '' : ' disabled'
    buttons.push(`        <button type="button" class="chip" data-product="${esc(p)}" aria-pressed="false"${off}>${esc(p)} ${label}</button>`)
  }

  return html
    .replace('<!-- FILTERS -->', buttons.join('\n'))
    .replace('<!-- TILES -->', tiles.join('\n'))
    .replace('<!-- SOON -->', soonTiles.join('\n'))
    .replaceAll('%SOON%', String(soon.length))
    .replaceAll('%COUNT%', String(demos.length))
}
