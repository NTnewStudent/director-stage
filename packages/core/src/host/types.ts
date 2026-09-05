import type { CSSProperties, Ref } from 'react'
import type { DirectorDocument } from '../studio/model'

/** Supported UI languages. */
export type Locale = 'zh-CN' | 'en-US' | 'ja-JP'

/** Workbench color theme. Tokens stay scoped to the component root. */
export type Theme = 'dark' | 'light'

/** Metadata passed to a custom image store after a clean capture. */
export interface CaptureMeta {
  key: string
  cameraId: string
  mimeType: string
  width: number
  height: number
}

/** Metadata passed to a custom video store after a real encode. */
export interface RecordMeta {
  key: string
  cameraId: string
  mimeType: string
  extension: string
  duration: number
  width: number
  height: number
}

/** Encoded video plus the actual container the browser produced. */
export interface RecordingResult {
  blob: Blob
  mimeType: string
  extension: string
}

/** Screenshot delivered to an embedding parent after a successful capture. */
export interface ImageCaptureResult extends CaptureMeta {
  blob: Blob
  frame: number
}

/** Encoded video delivered to an embedding parent after a successful export. */
export interface VideoExportResult extends RecordMeta {
  blob: Blob
}

/** Required document persistence. */
export interface DirectorDocumentStore {
  load(key: string): Promise<DirectorDocument | null>
  save(key: string, document: DirectorDocument): Promise<void>
}

/** Optional media persistence after capture/record. */
export interface DirectorMediaStore {
  saveImage?(blob: Blob, meta: CaptureMeta): Promise<void>
  saveVideo?(blob: Blob, meta: RecordMeta): Promise<void>
}

/** Host produced by DirectorHostFactory. */
export interface DirectorHost {
  documents: DirectorDocumentStore
  media?: DirectorMediaStore
  /** Chinese camera-language prompt for Seedance / Kling / Omni. Optional. */
  onShotText?(text: string): void | Promise<void>
}

/** Public React component props. `documentKey` is the storage key, not a React list key. */
export interface DirectorStageProps {
  documentKey: string
  host: DirectorHost
  locale?: Locale
  defaultLocale?: Locale
  theme?: Theme
  defaultTheme?: Theme
  defaultDocument?: DirectorDocument
  className?: string
  style?: CSSProperties
  onChange?: (document: DirectorDocument) => void
  onSave?: (document: DirectorDocument) => void
  onLoad?: (document: DirectorDocument) => void
  onCapture?: (blob: Blob, meta: CaptureMeta) => void
  onRecord?: (result: RecordingResult, meta: RecordMeta) => void
  onImageCapture?: (result: ImageCaptureResult) => void
  onVideoExport?: (result: VideoExportResult) => void
  onThemeChange?: (theme: Theme) => void
  onLocaleChange?: (locale: Locale) => void
  onError?: (error: import('./errors').DirectorStageError) => void
}

/** Imperative handle exposed on the component ref. */
export interface DirectorStageHandle {
  getDocument(): DirectorDocument
  setDocument(document: DirectorDocument): void
  save(): Promise<void>
  load(documentKey?: string): Promise<DirectorDocument | null>
  capture(options?: { cameraId?: string; frame?: number }): Promise<Blob>
  record(options?: { signal?: AbortSignal }): Promise<RecordingResult>
  getShotText(): string
  writeShotText(): Promise<void>
  getTheme(): Theme
  setTheme(theme: Theme): void
  getLocale(): Locale
  setLocale(locale: Locale): void
}

/** Convenience alias for ref objects. */
export type DirectorStageRef = Ref<DirectorStageHandle>
