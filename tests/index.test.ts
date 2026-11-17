import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FLUX, PRODUCTS, readCollection, readDemoEntries, readSoonEntries, renderCollection, renderIndex, soonTitle, validate } from '../index/render'
import { listDemos, readMeta } from '../vite.config'

const entries = readDemoEntries()
const soon = readSoonEntries()
const template = readFileSync('index.html', 'utf8')

describe('index data', () => {
  it('names a known product and model badge on every entry, once each', () => {
    expect(() => validate(entries, soon)).not.toThrow()
    for (const d of entries) {
      expect(PRODUCTS).toContain(d.platform)
      expect(Object.keys(FLUX)).toContain(d.flux)
    }
  })

  // A demo folder with no entry would be live at /demos/<id>/ but missing from /.
  it.each(listDemos())('%s: has an entry in index/demos.json', (name) => {
    expect(entries.map((d) => d.id)).toContain(name)
  })

  it('links every coming-soon card to the docs', () => {
    for (const s of soon) expect(s.docs).toMatch(/^https:\/\//)
  })
})

describe('the index page', () => {
  const warnings: string[] = []
  const html = renderIndex(template, {
    built: listDemos(),
    demosOnDisk: listDemos(),
    readMeta,
    warn: (m) => warnings.push(m),
  })
  const live = entries.filter((d) => listDemos().includes(d.id))

  it('fills every slot', () => {
    expect(html).not.toMatch(/<!-- (FILTERS|TILES|SOON) -->|%COUNT%|%SOON%/)
  })

  it('shows one same-tab tile per live demo, in demos.json order, with its own og.png', () => {
    const hrefs = [...html.matchAll(/<a class="tile" href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(live.map((d) => `/demos/${d.id}/`))
    for (const d of live) expect(html).toContain(`<img src="/demos/${d.id}/og.png"`)
    expect(html).not.toMatch(/<a class="tile" [^>]*target=/)
  })

  it('warns about, and leaves out, entries whose folder does not exist yet', () => {
    const missing = entries.filter((d) => !listDemos().includes(d.id))
    expect(warnings).toHaveLength(missing.length)
    for (const d of missing) expect(html).not.toContain(`href="/demos/${d.id}/"`)
  })

  it('shows a coming-soon card only for features not built', () => {
    const cards = [...html.matchAll(/<a class="tile tile--soon"/g)].length
    expect(cards).toBe(soon.filter((s) => !s.built).length)
  })

  it('titles coming-soon cards without the product prefix', () => {
    expect(soonTitle('agent-byo-llm')).toBe('BYO LLM')
    expect(soonTitle('tts-ws-clear')).toBe('WebSocket clear')
    expect(soonTitle('flux-eager-eot')).toBe('Flux eager EOT')
  })
})

describe('the /flux-tts/ collection page', () => {
  const html = renderCollection(readFileSync('flux-tts/index.html', 'utf8'), readCollection('flux-tts'), {
    built: listDemos(),
    readMeta,
  })
  const ids = readCollection('flux-tts').sections.flatMap((s) => s.ids)

  it('lists only demos that are in demos.json, each once', () => {
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(entries.map((d) => d.id)).toContain(id)
  })

  it('fills every slot and shows one tile per demo, in collection order', () => {
    expect(html).not.toMatch(/<!-- SECTIONS -->|%COUNT%/)
    const hrefs = [...html.matchAll(/<a class="tile" href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(ids.filter((id) => listDemos().includes(id)).map((id) => `/demos/${id}/`))
  })

  it('is linked from /', () => {
    expect(template).toContain('href="/flux-tts/"')
  })
})
