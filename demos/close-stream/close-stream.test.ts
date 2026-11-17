import { describe, expect, it } from 'vitest'
import feature, { summarize } from '.'
import type { SttEvent, Word } from '../../shared/common/feature'

const flux = feature.models[0]
const nova = feature.models[1]
const ctx = (model: typeof flux) => ({ model, mode: feature.modes[0], busy: false })
const words = (s: string): Word[] => s.split(' ').map((text) => ({ text, lang: 'en' }))
const results = (t: string, final: boolean) => ({
  type: 'Results',
  is_final: final,
  speech_final: final,
  channel: { alternatives: [{ transcript: t, words: t.split(' ').map((word) => ({ word })) }] },
})

describe('close-stream', () => {
  it('opens on Flux, with ForceEndTurn before CloseStream, and Nova-3 waits for Metadata', () => {
    expect(flux.endpoint).toBe('v2')
    expect(feature.actions?.({}, ctx(flux)).map((a) => a.label)).toEqual(['ForceEndTurn', 'CloseStream', 'Hang up (close socket)'])
    const [close, hangUp] = feature.actions?.({}, ctx(nova)) ?? []
    expect(close).toMatchObject({ message: { type: 'CloseStream' }, ack: ['Metadata'], ends: true })
    // Hang up sends nothing: the page drops the socket.
    expect(hangUp.message).toBeUndefined()
    expect(hangUp.ends).toBe(true)
  })

  it('keeps the flushed final after CloseStream, with its Metadata', () => {
    const events: SttEvent[] = [
      { ms: 3000, name: 'CloseStream', sent: true },
      { ms: 3050, name: 'Results speech_final', msg: results('please ship it on tuesday', true) },
      { ms: 3051, name: 'Metadata', msg: { type: 'Metadata', request_id: 'r', duration: 3.5 } },
    ]
    const s = summarize(events, words('please ship it on tuesday'), false)
    expect(s.how).toBe('close')
    expect(s.kept).toHaveLength(5)
    expect(s.rest).toHaveLength(0)
    expect(s.metadata?.duration).toBe(3.5)
    expect(s.after.map((e) => e.name)).toEqual(['Results speech_final', 'Metadata'])
  })

  it('marks interim-only words lost when the socket is dropped', () => {
    const events: SttEvent[] = [
      { ms: 1000, name: 'Results speech_final', msg: results('please ship', true) },
      { ms: 3000, name: 'audio paused', sent: true },
    ]
    const s = summarize(events, words('please ship it on tuesday'), false)
    expect(s.how).toBe('hangup')
    expect(s.kept.map((w) => w.text)).toEqual(['please', 'ship'])
    expect(s.rest.map((w) => w.text)).toEqual(['it', 'on', 'tuesday'])
    expect(s.after).toEqual([])
    expect(s.metadata).toBeUndefined()
  })

  it('counts a Flux turn as kept only once EndOfTurn arrives', () => {
    const open = summarize([{ ms: 3000, name: 'CloseStream', sent: true }], words('please ship it'), true)
    expect(open.rest).toHaveLength(3)
    const ended = summarize(
      [
        { ms: 2900, name: 'ForceEndTurn', sent: true },
        { ms: 2950, name: 'EndOfTurn', msg: { type: 'TurnInfo', event: 'EndOfTurn', transcript: 'please ship it' } },
        { ms: 3000, name: 'CloseStream', sent: true },
      ],
      words('please ship it'),
      true,
    )
    expect(ended.kept).toHaveLength(3)
  })

  it('shows only the Metadata summary on the Response card', () => {
    expect(feature.echo?.({ type: 'Metadata', duration: 1 }, nova)).toMatchObject({ duration: 1 })
    expect(feature.echo?.(results('hi', true), nova)).toBeUndefined()
  })
})
