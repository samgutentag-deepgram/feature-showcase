import { describe, expect, it } from 'vitest'
import feature, { LABEL, PHRASE } from '.'
import { describeRequest } from '../../shared/common/config'

const model = feature.models.find((m) => m.id === 'nova-3')!
const ctx = { model, mode: feature.modes[0], busy: false }

describe('redact', () => {
  it('sends one repeated param per kind, in a fixed order, the form verified live', () => {
    expect(describeRequest(model, feature.params({ kinds: ['ssn', 'pci'] }, ctx))).toBe(
      '/v1/listen?model=nova-3&smart_format=true&redact=pci&redact=ssn',
    )
  })

  it('sends no redact param when nothing is ticked', () => {
    expect(feature.params({ kinds: [] }, ctx)).toEqual({})
  })

  it('finds the labels Deepgram puts in place of a span', () => {
    const text = 'My card number is [CREDIT_CARD_1], It expires [CREDIT_CARD_EXPIRATION_1]. Code [SSN_1]'
    expect(text.split(LABEL).filter((_, i) => i % 2)).toEqual(['[CREDIT_CARD_1]', '[CREDIT_CARD_EXPIRATION_1]', '[SSN_1]'])
  })

  it('suggests a line for each ticked kind, and every line when none is', () => {
    expect(feature.phrases?.({ kinds: ['ssn'] }, ctx)).toEqual([PHRASE.ssn])
    expect(feature.phrases?.({ kinds: ['ssn', 'pci'] }, ctx)).toEqual([PHRASE.pci, PHRASE.ssn])
    expect(feature.phrases?.({ kinds: [] }, ctx)).toHaveLength(3)
  })
})
