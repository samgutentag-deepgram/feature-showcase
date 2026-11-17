// The think (LLM) models this page offers, by provider, Deepgram's own first. Every model here was
// checked live on 2026-11-16 with this key and no third-party key: one session each, Settings with
// that agent.think.provider, then InjectUserMessage, and each came back SettingsApplied, a spoken
// reply, and a LatencyReport total_latency. See the top of index.tsx for what failed and why.

export interface Provider {
  type: string
  label: string
  // Shown next to the provider name, e.g. Early Access.
  tag?: string
  models: Array<{ id: string; name: string }>
}

export const PROVIDERS: Provider[] = [
  {
    type: 'deepgram',
    label: 'Deepgram',
    tag: 'Early Access',
    models: [
      { id: 'think-fast', name: 'Think-Fast' },
      { id: 'phonellm-mini-alpha-2-fp8', name: 'PhoneLLM mini alpha 2' },
    ],
  },
  {
    type: 'open_ai',
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-5-nano', name: 'GPT-5 nano' },
      { id: 'gpt-5-mini', name: 'GPT-5 mini' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-5.1', name: 'GPT-5.1' },
      { id: 'gpt-5.2', name: 'GPT-5.2' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 nano' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.5', name: 'GPT-5.5' },
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
      { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
    ],
  },
  {
    type: 'anthropic',
    label: 'Anthropic',
    models: [
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
    ],
  },
  {
    type: 'google',
    label: 'Google',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    ],
  },
  {
    type: 'groq',
    label: 'Groq',
    models: [{ id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B' }],
  },
  {
    type: 'nvidia',
    label: 'NVIDIA',
    models: [{ id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Nemotron 3.5 Lightning 30B' }],
  },
]

export const providerOf = (type: string): Provider => PROVIDERS.find((p) => p.type === type) ?? PROVIDERS[0]

export const modelName = (type: string, id: string): string => providerOf(type).models.find((m) => m.id === id)?.name ?? id
