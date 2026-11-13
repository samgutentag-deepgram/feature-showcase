// A feature's prompt.md is generated from its index.tsx (shared/common/prompt.ts) and must match it, so
// the prompt cannot drift from what the page sends. Regenerate after changing a feature:
//
//   UPDATE_PROMPTS=1 pnpm test prompt
//
// A folder without prompt.md is skipped until one is generated for it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { agentPrompt, promptRequests, sttPrompt } from '../shared/common/prompt'
import { ttsPrompt, ttsPromptRequests } from '../shared/tts/prompt'
import { readMeta } from '../vite.config'

const names = readdirSync('demos', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

export async function buildPrompt(name: string): Promise<string | undefined> {
  const feature = (await import(`../demos/${name}/index.tsx`)).default
  const meta = readMeta(name)
  if (feature.kind === 'agent') return agentPrompt(feature, meta)
  if (feature.kind === 'tts') return ttsPrompt(feature, meta)
  return sttPrompt(feature, meta)
}

describe.each(names)('prompt for %s', (name) => {
  const file = path.join('demos', name, 'prompt.md')
  it('matches what the feature sends', async () => {
    const built = await buildPrompt(name)
    if (!built) return
    if (process.env.UPDATE_PROMPTS === '1') writeFileSync(file, built)
    if (!existsSync(file)) return
    expect(readFileSync(file, 'utf8')).toBe(built)
    const { urls, settings } = promptRequests(built)
    const tts = ttsPromptRequests(built)
    expect(urls.length + settings.length + tts.posts.length).toBeGreaterThan(0)
  })
})
