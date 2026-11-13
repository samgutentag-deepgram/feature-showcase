import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

// One site, one page per demo: every folder under demos/ builds to dist/demos/<id>/index.html with
// its own title, description, and og.png from its meta.json, served at SITE/demos/<id>/.
export const SITE = 'https://dg-devrel-demos.fly.dev'

// Optional. FEATURE=<id> pnpm dev opens that demo (/ redirects to it); FEATURE=<id> pnpm build
// builds only that page, which is quicker for a check. Unset, every demo is built and served.
export const FEATURE = process.env.FEATURE || undefined

const ROOT = path.resolve('.')
export const featureDir = (name: string) => path.join(ROOT, 'demos', name)

// A demo is any folder under demos/ with an index.tsx. Nothing else to register.
export function listDemos(): string[] {
  return readdirSync(path.join(ROOT, 'demos'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(ROOT, 'demos', d.name, 'index.tsx')))
    .map((d) => d.name)
    .sort()
}

export interface Meta {
  title: string
  description: string
  // The public URL of the page, SITE/demos/<id>/, for canonical, og:url and an absolute og:image.
  url: string
}

export function readMeta(name: string): Meta {
  return JSON.parse(readFileSync(path.join(featureDir(name), 'meta.json'), 'utf8'))
}

export const demoUrl = (name: string) => `${SITE}/demos/${name}/`
export const promptFile = (name: string) => path.join(featureDir(name), 'prompt.md')

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// The page file and entry module for each demo exist only here, never on disk.
const pageId = (name: string) => path.join(featureDir(name), 'index.html')
const entryId = (name: string) => path.join(featureDir(name), '__entry.tsx')
const PAGE_RE = /\/demos\/([a-z0-9-]+)\/(index\.html|__entry\.tsx)$/

function pageHtml(name: string): string {
  const meta = readMeta(name)
  return readFileSync(path.join(ROOT, 'shared/page.html'), 'utf8')
    .replaceAll('%TITLE%', escape(meta.title))
    .replaceAll('%DESCRIPTION%', escape(meta.description))
    .replaceAll('%URL%', escape(meta.url))
    .replaceAll('%ENTRY%', `/demos/${name}/__entry.tsx`)
}

function entryCode(name: string): string {
  const info = { folder: name, hasPrompt: existsSync(promptFile(name)) }
  return [
    `import { mount } from '/shared/main.tsx'`,
    `import feature from '/demos/${name}/index.tsx'`,
    `mount(feature, ${JSON.stringify(info)})`,
  ].join('\n')
}

function listHtml(html: string, names: string[]): string {
  const items = names.map((n) => {
    const m = readMeta(n)
    const title = m.title.replace(/\s*\|\s*Deepgram$/, '')
    return `<li><a href="/demos/${n}/">${escape(title)}</a><p>${escape(m.description)}</p></li>`
  })
  return html.replace('<!--DEMOS-->', items.join('\n        '))
}

function demoPages(names: string[]): Plugin {
  const known = new Set(names)
  const match = (id: string) => {
    const m = id.split('?')[0].match(PAGE_RE)
    return m && known.has(m[1]) ? { name: m[1], file: m[2] } : null
  }
  return {
    name: 'demo-pages',
    enforce: 'pre',
    config: () => ({
      build: {
        rollupOptions: {
          input: Object.fromEntries([
            ['index', path.join(ROOT, 'index.html')],
            ...names.map((n) => [`demos/${n}`, pageId(n)]),
          ]),
        },
      },
    }),
    resolveId(source) {
      const hit = match(source)
      if (!hit) return null
      return hit.file === 'index.html' ? pageId(hit.name) : entryId(hit.name)
    },
    load(id) {
      const hit = match(id)
      if (!hit) return null
      return hit.file === 'index.html' ? pageHtml(hit.name) : entryCode(hit.name)
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => (ctx.path === '/index.html' ? listHtml(html, names) : html),
    },
    configureServer(server) {
      const send = (res: ServerResponse, type: string, body: string | Buffer) => {
        res.setHeader('content-type', type)
        res.end(body)
      }
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = (req.url ?? '/').split('?')[0]
        if (url === '/' && FEATURE) return void (res.writeHead(302, { location: `/demos/${FEATURE}/` }), res.end())
        const m = url.match(/^\/demos\/([a-z0-9-]+)(\/.*)?$/)
        if (!m || !known.has(m[1])) return next()
        const [, name, rest = ''] = m
        if (rest === '') return void (res.writeHead(301, { location: `/demos/${name}/` }), res.end())
        if (rest === '/' || rest === '/index.html') {
          return send(res, 'text/html', await server.transformIndexHtml(`/demos/${name}/`, pageHtml(name)))
        }
        if (rest === '/og.png') return send(res, 'image/png', readFileSync(path.join(featureDir(name), 'og.png')))
        if (rest === '/prompt.md' && existsSync(promptFile(name))) {
          return send(res, 'text/markdown; charset=utf-8', readFileSync(promptFile(name)))
        }
        next()
      })
    },
    // Each page's share card and build prompt sit next to it: /demos/<id>/og.png, /demos/<id>/prompt.md.
    generateBundle() {
      for (const n of names) {
        this.emitFile({ type: 'asset', fileName: `demos/${n}/og.png`, source: readFileSync(path.join(featureDir(n), 'og.png')) })
        if (existsSync(promptFile(n))) {
          this.emitFile({ type: 'asset', fileName: `demos/${n}/prompt.md`, source: readFileSync(promptFile(n)) })
        }
      }
    },
  }
}

const demos = FEATURE ? [FEATURE] : listDemos()
if (FEATURE && !listDemos().includes(FEATURE)) throw new Error(`FEATURE=${FEATURE}: no demos/${FEATURE}/index.tsx`)

export default defineConfig({
  plugins: [react(), demoPages(demos)],
  // The mic worklet ships as its own file, never a data: URL, so the CSP can say script-src 'self'.
  build: { assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined) },
  server: {
    port: Number(process.env.VITE_PORT) || 8080,
    // /api for tokens, /demos/<id>/api/ for a demo's own routes (demos/<id>/server.js).
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT || 8081}`,
      '^/demos/[^/]+/api/': `http://localhost:${process.env.API_PORT || 8081}`,
    },
  },
  test: { environment: 'node' },
})
