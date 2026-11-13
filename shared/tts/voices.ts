// Voice lineups shared by the text-to-speech demos. Flux first, Aura-2 after to fill in.
// flux-wes-en is the default everywhere: the steadiest of 14 Flux voices across repeat calls
// (2026-11-11). features.test.ts refuses flux-marcus-en and flux-brittany-en as a default.
export const DEFAULT_VOICE = 'flux-wes-en'

// Four steady English Flux voices, two women and two men.
export const FLUX_STEADY = [DEFAULT_VOICE, 'flux-cole-en', 'flux-meghan-en', 'flux-drew-en']

// Aura-2 voices that fill in after Flux on /v1/speak demos.
export const AURA_FILL = ['aura-2-thalia-en', 'aura-2-apollo-en']

// The usual lineup for a demo that works on both /v2/speak (Flux) and /v1/speak (Aura-2).
export const FLUX_THEN_AURA = [...FLUX_STEADY, ...AURA_FILL]

// Six Flux voices for socket session demos (Flux only: Configure, turns, token streaming).
export const FLUX_SESSION = [DEFAULT_VOICE, 'flux-cole-en', 'flux-hannah-en', 'flux-kit-en', 'flux-meghan-en', 'flux-drew-en']

// Six Flux voices checked for inline markup (pause markers, IPA pronunciation overrides).
export const FLUX_INLINE = [DEFAULT_VOICE, 'flux-hannah-en', 'flux-cole-en', 'flux-kit-en', 'flux-alexis-en', 'flux-drew-en']
