import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAMPAIGN, LINKS, dgLink } from '../shared/common/links'
import { FEATURE, demoId, readMeta } from '../vite.config'

const tags = (href: string) => Object.fromEntries(new URL(href).searchParams)

describe('outbound links', () => {
  it('name the demo, the family, and the advocate on every Deepgram link', () => {
    for (const href of [LINKS.signup, LINKS.playground, LINKS.sales, 'https://developers.deepgram.com/docs/x']) {
      expect(tags(dgLink(href, 'cta', 'docs', 'dg-devrel-keyterm'))).toEqual({
        utm_source: 'dg-devrel-keyterm',
        utm_medium: 'demo',
        utm_campaign: 'devrel-demos',
        utm_content: 'sam_gutentag_cta_docs',
      })
    }
  })

  it('default the source to the demo this build serves', () => {
    expect(tags(dgLink(LINKS.signup, 'header', 'signup')).utm_source).toBe(demoId(readMeta()))
    expect(CAMPAIGN).toBe('devrel-demos')
  })

  it('name the exact button: who built it, where it sits, which one', () => {
    expect(tags(dgLink(LINKS.signup, 'header', 'signup')).utm_content).toBe('sam_gutentag_header_signup')
    expect(tags(dgLink(LINKS.signup, 'footer', 'signup')).utm_content).toBe('sam_gutentag_footer_signup')
    expect(tags(dgLink(LINKS.sales, 'cta', 'sales')).utm_content).toBe('sam_gutentag_cta_sales')
  })

  it('leave non-Deepgram hosts alone', () => {
    expect(dgLink(LINKS.discord, 'footer', 'docs')).toBe(LINKS.discord)
  })

  it('keep the destination path intact', () => {
    const docs = 'https://developers.deepgram.com/docs/nova-3-language-prompting'
    const url = new URL(dgLink(docs, 'cta', 'docs'))
    expect(`${url.origin}${url.pathname}`).toBe(docs)
  })
})

describe('the demo id', () => {
  // utm_source, the public URL, and the Fly app must agree, or traffic is credited to the wrong demo.
  // The Fly app is dg-devrel-<folder> by construction (scripts/deploy.sh), so the folder is the check.
  const names = readdirSync('demos', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  it.each(names)('%s: matches the feature folder and the public URL', (name) => {
    const meta = readMeta(name)
    expect(demoId(meta)).toBe(`dg-devrel-${name}`)
    expect(meta.url).toMatch(new RegExp(`^https://dg-devrel-${name}\\.fly\\.dev/?$`))
  })

  it('the build serves one of them', () => {
    expect(names).toContain(FEATURE)
  })

  it('fly.toml names no app, so one config serves every demo', () => {
    expect(readFileSync('fly.toml', 'utf8')).not.toMatch(/^app\s*=/m)
  })
})

describe('the page', () => {
  // Every tagged link on the page must be unique, or two buttons would count as one.
  it('gives every Deepgram link its own placement and button', async () => {
    const src = (await import('node:fs')).readFileSync('shared/stt/Shell.tsx', 'utf8')
    const calls = [...src.matchAll(/link\([^,]+, '([a-z]+)', '([a-z]+)'\)/g)].map((m) => `${m[1]}_${m[2]}`)
    expect(calls.length).toBeGreaterThanOrEqual(9)
    expect(new Set(calls).size).toBe(calls.length)
  })
})
