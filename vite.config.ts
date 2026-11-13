import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Which folder under demos/ this build serves. Set it per command:
// FEATURE=smart-format pnpm dev, FEATURE=smart-format pnpm build. The default is only for a bare
// `pnpm dev`; deploys and scripts/build.sh always pass FEATURE explicitly.
export const FEATURE = process.env.FEATURE || 'language-hint'

export const featureDir = (name = FEATURE) => path.resolve('demos', name)

export interface Meta {
  title: string
  description: string
  // The public URL, for og:url and an absolute og:image.
  url: string
}

export function readMeta(name = FEATURE): Meta {
  return JSON.parse(readFileSync(path.join(featureDir(name), 'meta.json'), 'utf8'))
}

// The demo's id: the first label of its public host, which is also its Fly app name.
export const demoId = (meta: Meta) => new URL(meta.url).hostname.split('.')[0]

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Fills index.html's %TITLE%-style slots from meta.json, and ships the feature's og.png as /og.png
// so link previews have a picture.
export const promptFile = (name = FEATURE) => path.join(featureDir(name), 'prompt.md')

function featureMeta(): Plugin {
  const meta = readMeta()
  const og = path.join(featureDir(), 'og.png')
  const prompt = promptFile()
  return {
    name: 'feature-meta',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%TITLE%', escape(meta.title))
        .replaceAll('%DESCRIPTION%', escape(meta.description))
        .replaceAll('%URL%', escape(meta.url.replace(/\/$/, ''))),
    configureServer(server) {
      server.middlewares.use('/og.png', (_req, res) => {
        res.setHeader('content-type', 'image/png')
        res.end(readFileSync(og))
      })
      server.middlewares.use('/prompt.md', (_req, res) => {
        if (!existsSync(prompt)) return void (res.statusCode = 404, res.end())
        res.setHeader('content-type', 'text/markdown; charset=utf-8')
        res.end(readFileSync(prompt))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'og.png', source: readFileSync(og) })
      if (existsSync(prompt)) this.emitFile({ type: 'asset', fileName: 'prompt.md', source: readFileSync(prompt) })
    },
  }
}

export default defineConfig({
  plugins: [react(), featureMeta()],
  resolve: { alias: { '@feature': featureDir() } },
  // utm_source on every Deepgram link; see shared/common/links.ts.
  define: {
    __DEMO_ID__: JSON.stringify(demoId(readMeta())),
    __DEMO_FOLDER__: JSON.stringify(FEATURE),
    __HAS_PROMPT__: JSON.stringify(existsSync(promptFile())),
  },
  // The mic worklet ships as its own file, never a data: URL, so the CSP can say script-src 'self'.
  build: { assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined) },
  server: {
    port: Number(process.env.VITE_PORT) || 8080,
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 8081}` },
  },
  test: { environment: 'node' },
})
