import { describe, expect, it } from 'vitest'
import feature, { reported, VERSIONS } from '.'
import { describeRequest } from '../../shared/common/config'

const model = feature.models[0]
const ctx = { model, mode: feature.modes[0], busy: false }

describe('model-version-pin', () => {
  it('always says which build was asked for, the forms verified live', () => {
    expect(describeRequest(model, feature.params({ version: 'latest' }, ctx))).toBe('/v1/listen?model=nova-3&version=latest')
    expect(describeRequest(model, feature.params({ version: '2025-01-09.0' }, ctx))).toBe(
      '/v1/listen?model=nova-3&version=2025-01-09.0',
    )
  })

  it('covers every version as a variant', () => {
    expect(feature.variants?.map((v) => v.version)).toEqual([...VERSIONS])
  })

  it('reads the version and uuid Deepgram reports from a final result', () => {
    const msg = {
      type: 'Results',
      is_final: true,
      channel: { alternatives: [{ transcript: 'which one heard me better' }] },
      metadata: {
        request_id: 'x',
        model_info: { name: 'general-nova-3', version: '2025-01-09.0', arch: 'nova-3' },
        model_uuid: 'bf05427e-a1f1-4ced-a976-38b2f3533d8d',
      },
    }
    expect(reported(msg)).toEqual({
      name: 'general-nova-3',
      version: '2025-01-09.0',
      uuid: 'bf05427e-a1f1-4ced-a976-38b2f3533d8d',
      transcript: 'which one heard me better',
    })
    expect(reported({ ...msg, is_final: false })).toBeUndefined()
    expect(reported({ type: 'Metadata' })).toBeUndefined()
  })
})
