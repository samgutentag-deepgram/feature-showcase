import { describe, expect, it } from 'vitest'
import feature from '.'
import { describeRequest, requestParams } from '../../shared/common/config'

const model = feature.models.find((m) => m.id === 'nova-3')!
const ctx = { model, mode: feature.modes[0], busy: false }

describe('smart-format', () => {
  it('always says which setting ran, the forms verified live', () => {
    expect(describeRequest(model, feature.params({ on: true }, ctx))).toBe('/v1/listen?model=nova-3&smart_format=true')
    expect(describeRequest(model, feature.params({ on: false }, ctx))).toBe('/v1/listen?model=nova-3&smart_format=false')
  })

  it('sends nothing that would override the setting being shown', () => {
    expect(requestParams(model, feature.params({ on: false }, ctx))).toMatchObject({ smart_format: 'false' })
  })

  it('shows the last final transcript verbatim', () => {
    const msg = { type: 'Results', is_final: true, channel: { alternatives: [{ transcript: 'Call (555) 212-8899.' }] } }
    expect(feature.echo?.(msg, model)).toBe('Call (555) 212-8899.')
    expect(feature.echo?.({ ...msg, is_final: false }, model)).toBeUndefined()
  })

  it('suggests a phrase with a number, a date, a price, and a phone number', () => {
    const [line] = feature.phrases?.({ on: false }, ctx) ?? []
    expect(line).toMatch(/4815/)
    expect(line).toMatch(/March 3rd, 2026/)
    expect(line).toMatch(/\$129\.99/)
    expect(line).toMatch(/555-212-8899/)
  })
})
