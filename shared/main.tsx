import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/app.css'
import { Shell } from './stt/Shell'
import { TtsShell } from './tts/TtsShell'
import { AgentShell } from './agent/AgentShell'
// LLM kind (Audio and Text Intelligence, /v1/think): shared/llm/.
import { LlmShell } from './llm/LlmShell'
import type { LlmFeature } from './llm/feature'
import { setDemo, type DemoInfo } from './common/demo'
import type { Feature } from './common/feature'
import type { TtsFeature } from './tts/feature'
import type { AgentFeature } from './agent/feature'

// The shell never looks inside a feature's state, so it is erased here.
export type AnyFeature = Feature<any> | TtsFeature<any> | AgentFeature<any> | LlmFeature<any>

// Each demo page's entry (generated in vite.config.ts) imports its own folder and calls this.
export function mount(feature: AnyFeature, info: DemoInfo) {
  setDemo(info)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {feature.kind === 'tts' ? (
        <TtsShell feature={feature} />
      ) : feature.kind === 'agent' ? (
        <AgentShell feature={feature} />
      ) : feature.kind === 'llm' ? (
        <LlmShell feature={feature} />
      ) : (
        <Shell feature={feature as Feature<any>} />
      )}
    </StrictMode>,
  )
}
