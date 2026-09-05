export { DirectorStage } from './DirectorStage'
export { DirectorHostFactory } from './host/factory'
export { DirectorStageError } from './host/errors'
import { createDirectorDocument, type DirectorDocument as DirectorDocumentModel } from './studio/model'

/** Scene JSON type; value namespace is {@link DirectorDocument.create}. */
export type DirectorDocument = DirectorDocumentModel

/** Named factory matching the public API docs. */
export const DirectorDocument = {
  /** @returns A fresh default v2 scene (one character, one camera). */
  create: createDirectorDocument,
}

export type {
  CaptureMeta,
  DirectorDocumentStore,
  DirectorHost,
  DirectorMediaStore,
  DirectorStageHandle,
  DirectorStageProps,
  ImageCaptureResult,
  Locale,
  RecordMeta,
  RecordingResult,
  Theme,
  VideoExportResult,
} from './host/types'
