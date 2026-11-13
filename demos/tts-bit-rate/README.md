# Text-to-speech bit rate

**How small can the file get?** Press Speak, then pick MP3 or Opus and one of five bit rates: the line starts over at that size. Each run shows the real bytes Deepgram sent back, the last two side by side, so you can hear what a smaller file costs in sound.

- **Live:** https://dg-devrel-demos.fly.dev/demos/tts-bit-rate/
- **Kind:** Text-to-speech
- **Docs:** https://developers.deepgram.com/docs/tts-bit-rate

## Run it

From the repo root, after the one-time setup in the [main README](../../README.md#quick-start):

```bash
FEATURE=tts-bit-rate pnpm dev
```

## Verified live

From the top of `index.tsx`:

```text
Bit rate. Verified live 2026-11-13 with curl, on POST /v2/speak flux-wes-en and POST /v1/speak
aura-2-thalia-en, the same 98-character line (bytes are Flux, then Aura-2):
  encoding=mp3&bit_rate=8000|16000|24000|32000|48000   200 audio/mpeg
    8000 -> 4,680 / 5,760   16000 -> 10,440 / 10,584   24000 -> 15,120 / 16,632
    32000 -> 21,734 / 20,062   48000 -> 31,536 / 35,568 (no bit_rate is 48000)
    bit_rate=64000 is a 400 on both: "`bit_rate` must be 8000, 16000, 24000, 32000, 40000, or
    48000 when `encoding=mp3`". The docs table lists 32000 and 48000 only; the API takes all six.
    ffprobe: the encoder also drops the sample rate as the bit rate falls: 48k -> 24 kHz,
    32k -> 22.05 kHz, 24k and 16k -> 16 kHz, 8k -> 8 kHz. container=none with mp3 is a 400.
  encoding=opus&container=ogg&bit_rate=4000|8000|12000|32000|64000   200 audio/ogg;codecs=opus
    4000 -> 3,043 / 3,554   8000 -> 5,258 / 7,088   12000 -> 8,634 / 9,529
    32000 -> 24,503 / 21,047   64000 -> 40,481 / 44,050. 3000 is a 400 ("between 4000 and
    650000"); 650000 is a 200 at 185,714 bytes. container=none with opus is a 400.
    Sizes move by up to about 15% between identical calls (the speech itself varies).
  The same line as linear16 24 kHz container=wav: 230,444 / 245,804 bytes, about 5 s of audio.
/v2/speak answers 400 INVALID_QUERY_PARAMETER for an unknown param, so its 200s prove Flux takes
bit_rate. Picking a button stops the line and speaks it again at that bit rate.
Voices: Flux first on POST /v2/speak, Aura-2 after on /v1/speak. flux-wes-en is the default:
same line 3 times on 2026-11-11, it had the smallest loudness spread (0.2 dB) and duration
spread (0.08 s) of 14 Flux voices tried.
```
