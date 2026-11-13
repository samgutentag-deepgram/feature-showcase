import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/app.css'
import { Shell } from './stt/Shell'
import { TtsShell } from './tts/TtsShell'
import { AgentShell } from './agent/AgentShell'
// Resolves to demos/<FEATURE>/ in vite.config.ts.
import feature from '@feature'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {feature.kind === 'tts' ? (
      <TtsShell feature={feature} />
    ) : feature.kind === 'agent' ? (
      <AgentShell feature={feature} />
    ) : (
      <Shell feature={feature} />
    )}
  </StrictMode>,
)
