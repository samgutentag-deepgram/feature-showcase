// '@feature' is the folder vite.config.ts picks. Each feature checks against Feature<its own state>
// in its own file; here the state type is erased because the shell never looks inside it.
declare module '@feature' {
  const feature: import('./common/feature').Feature<any> | import('./tts/feature').TtsFeature<any> | import('./agent/feature').AgentFeature<any>
  export default feature
}

// The demo's id (its Fly app name, e.g. dg-devrel-keyterm), set by vite.config.ts from meta.json.
declare const __DEMO_ID__: string

// True when the feature folder has a prompt.md; vite.config.ts then ships it as /prompt.md.
declare const __HAS_PROMPT__: boolean
