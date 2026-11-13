// What a text-to-speech demo plugs into the TTS shell. Same idea as shared/common/feature.ts: one
// feature folder exports one of these, and vite.config.ts picks the folder.
import type { FC, ReactNode } from 'react'
import type { Params } from '../common/feature'

export interface TtsFeature<S> {
  kind: 'tts'
  copy: {
    headline: string
    lede: string
    ctaTitle: string
    ctaBody: ReactNode
  }
  links: { docs: string; changelog?: string }
  // Voice model names, Flux first (POST /v2/speak), then Aura-2 to fill in (POST /v1/speak).
  // The first is the default; the page offers the rest in a picker, grouped by family.
  voices: string[]
  // Only for a demo that is Aura-2 only on purpose: a feature Flux does not have, or the Aura-2
  // voice tour. Every voice is Aura-2, and this note, shown under the voice picker and repeated in
  // prompt.md, starts "Aura-2 only." and says why and what Flux offers instead.
  auraOnly?: string
  initialState: S
  // Every setting the page can be in, for the pre-deploy checks (each is requested live).
  variants: S[]
  // The query for POST /v2/speak or /v1/speak, besides model. Must include encoding, sample_rate, and
  // container: the shell plays container=none as it arrives and waits for the file otherwise.
  // Compressed files are the exception: encoding=mp3 or opus with bit_rate, no sample_rate, and
  // container=ogg for opus only (tests/features.test.ts holds the rules).
  params(state: S): Params
  // Params marked on the Request card.
  highlight: string[]
  // Names a run: "phone line, 8 kHz".
  runLabel(state: S): string
  // Lines to try. The first fills the text box.
  phrases: string[]
  // The setting prompt.md shows. Defaults to the last variant.
  promptState?: S
  // Draw the 4 kHz line on the spectrum, where phone-line audio stops.
  phoneMark?: boolean
  Controls: FC<{ state: S; setState(next: S): void; busy: boolean }>
  // Picking a setting stops what is playing and speaks the line again with it, so the controls stay
  // usable while it talks. Pairs with Steps (shared/tts/Steps.tsx).
  restartOnPick?: boolean
  // A Flux socket session (shared/tts/session.ts): the line goes out as turns, one sentence (or,
  // with 'phrase', one comma-sized piece) each, and the run card lists every turn's speech_id,
  // audio length and billable characters. configure(state) is sent as Configure before the next
  // turn whenever it changes, so a pick mid-line lands on the next turn with no reconnect and no
  // restart. Flux voices only.
  // With close (below), the page sends Close after the last turn's SpeechMetadata and waits for
  // SessionMetadata, the session's totals, before the socket shuts.
  session?: {
    split: 'sentence' | 'phrase'
    configure?(state: S): Record<string, number>
  }
  // A reply that arrives like LLM output, a token every tokenMs, spoken on one Flux socket
  // (shared/tts/tokens.ts). mode(state) picks how: the whole reply then Flush, each token as it
  // comes then Flush, or each token with Flush sent late. Flux voices only.
  tokens?: {
    tokenMs: number
    mode(state: S): 'whole' | 'stream' | 'late'
  }
  // A lineup (shared/tts/lineup.ts): one press speaks the line in every voice in `voices`, back to
  // back, and the run card lists each voice's peak and speech level, plus the spread between the
  // loudest and quietest. The voice picker hides. POST only, linear16 with container=none.
  lineup?: boolean
  // A voice browser: the voice comes from the state, and the shell's voice picker hides. Every voice
  // it can return must be in voices, which the checks request one by one.
  voiceFrom?(state: S): string
  // A line of its own per setting (the same words in each language). When a pick changes it, the
  // text box takes the new line.
  textFor?(state: S): string
  // How the page ends the socket (shared/tts/close.ts). One concept, two places to use it:
  //   afterMs set (close mode): the line goes out as one Speak with no Flush and, afterMs later,
  //     the socket is closed while the audio is still coming, the way an app hangs up after its
  //     last line. params() gives encoding and sample_rate only, as in socket mode.
  //   with session (no afterMs): Close goes out once the last turn's audio is in, and the page
  //     shows SessionMetadata, the session's totals, next to the sum of the turns. Flux only.
  // graceful(state) picks how: send {"type":"Close"} and let Deepgram finish (the default), or
  // close the socket from the client and lose what had not arrived. A session always sends Close.
  close?: {
    afterMs?: number
    graceful?(state: S): boolean
  }
  // Callback mode (shared/tts/callback.ts): POST with `callback`, Deepgram answers a request_id at
  // once and delivers the audio to the demo server's webhook, which the page polls. params() puts
  // CALLBACK_SHOWN where the callback URL goes; each run swaps in its own slot. With priority=low
  // the body is {"url"} (where Deepgram fetches the text) instead of {"text"}. fluxOnly(state):
  // the setting works on Flux voices only, so the picker offers no Aura-2 voice while it is on.
  callback?: {
    fluxOnly?(state: S): boolean
  }
  // Socket mode: the page speaks over wss://.../v2/speak (Flux) or /v1/speak (Aura-2) instead of
  // POST, and shows a Cut in button while the line plays, like a caller talking over the agent.
  // params() then gives encoding and sample_rate only: the socket streams raw audio, no container.
  cutIn?: {
    // What the page says after the cut, as the agent's answer.
    reply: string
    // Whether this variant tells Deepgram to stop: Interrupt with playback_offset on /v2/speak,
    // Clear on /v1/speak. If not, the page only stops playing and the rest of the line keeps coming.
    interrupt(state: S): boolean
    // Also cut in when the listener starts talking: the mic streams to Flux speech-to-text and
    // StartOfTurn cuts in (shared/tts/listen.ts). The button stays for no mic or no permission.
    listen?: boolean
    // Break the run card down by where the old line's audio was at the cut: heard, already in the
    // browser but not yet played, and arriving after the cut. Plus how long the ack took.
    buffer?: boolean
  }
}

export const defineTtsFeature = <S,>(f: TtsFeature<S>): TtsFeature<S> => f
