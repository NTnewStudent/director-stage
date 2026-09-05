import { beforeEach, describe, expect, it } from 'vitest'
import { DirectorHostFactory } from './factory'
import { DirectorStageError } from './errors'
import { createDirectorDocument } from '../studio/model'

describe('DirectorHostFactory', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a document through browser() localStorage', async () => {
    const host = DirectorHostFactory.browser({ prefix: 'test' })
    const document = createDirectorDocument()
    document.duration = 8
    await host.documents.save('demo', document)
    const loaded = await host.documents.load('demo')
    expect(loaded?.duration).toBe(8)
    expect(await host.documents.load('missing')).toBeNull()
  })

  it('rejects a host without documents.load/save', () => {
    expect(() => DirectorHostFactory.create({ documents: { load: async () => null } as never })).toThrow(DirectorStageError)
    try {
      DirectorHostFactory.create({ documents: { load: async () => null } as never })
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_HOST' })
    }
  })
})
