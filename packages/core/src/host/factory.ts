import { DirectorStageError } from './errors'
import type { CaptureMeta, DirectorHost, RecordMeta } from './types'
import type { DirectorDocument } from '../studio/model'
import { normalizeDirectorDocument } from '../studio/model'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function assertHost(host: DirectorHost): DirectorHost {
  if (typeof host?.documents?.load !== 'function' || typeof host?.documents?.save !== 'function') {
    throw new DirectorStageError('INVALID_HOST', 'DirectorHost.documents.load/save are required')
  }
  return host
}

/** Factory for default browser storage or a validated custom host.
 * @description `browser()` writes JSON to localStorage and downloads media. `create()` only validates shape.
 */
export const DirectorHostFactory = {
  /** localStorage document store plus download-based media.
   * @param options Optional key prefix.
   * @returns Ready-to-use host.
   */
  browser(options?: { prefix?: string }): DirectorHost {
    const prefix = options?.prefix ?? 'director-stage'
    const storageKey = (key: string) => `${prefix}:${key}`
    return {
      documents: {
        async load(key: string) {
          const raw = localStorage.getItem(storageKey(key))
          if (!raw) return null
          return normalizeDirectorDocument(JSON.parse(raw) as unknown)
        },
        async save(key: string, document: DirectorDocument) {
          localStorage.setItem(storageKey(key), JSON.stringify(document))
        },
      },
      media: {
        async saveImage(blob: Blob, meta: CaptureMeta) {
          downloadBlob(blob, `director_${meta.cameraId}.${meta.mimeType.includes('png') ? 'png' : 'jpg'}`)
        },
        async saveVideo(blob: Blob, meta: RecordMeta) {
          downloadBlob(blob, `director_${Date.now()}.${meta.extension}`)
        },
      },
    }
  },
  /** Validate and return a caller-supplied host.
   * @param host Custom persistence.
   * @returns The same host after validation.
   * @throws DirectorStageError INVALID_HOST when load/save are missing.
   */
  create(host: DirectorHost): DirectorHost {
    return assertHost(host)
  },
}
