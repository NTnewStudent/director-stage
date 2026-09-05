import type * as THREE from 'three'
import type { DirectorDocument } from '../model'
import { sampleDirectorFrame } from '../animation'
import { assertCaptureActive, createPixelSurface, type CaptureOptions, type PixelSurface } from './capture'
import { createRenderWorld, createShotCamera, outputDimensions, type StagePalette } from './world'

/** Browser-negotiated format, preserving MIME/container/extension agreement. */
export interface RecordingFormat { mimeType: string; extension: 'mp4' | 'webm' }

/** Real-time export options; onProgress receives a fraction in [0, 1]. */
export interface RecordOptions extends Omit<CaptureOptions, 'frame'> { onProgress?: (progress: number) => void }

/** Recorded video and the actual chosen browser format. */
export interface RecordingResult extends RecordingFormat { blob: Blob }

/** Negotiate actual encoding support; never rename WebM bytes to MP4. @param supports Capability predicate (injectable for tests). @returns Best available format, or null. */
export function getRecordingFormat(supports?: (mime: string) => boolean): RecordingFormat | null {
  const probe = supports ?? (typeof MediaRecorder !== 'undefined' ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : undefined)
  if (!probe) return null
  const choices: RecordingFormat[] = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ]
  return choices.find((format) => probe(format.mimeType)) ?? null
}

function waitFrame(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Director export cancelled', 'AbortError')) // User cancellation must release timers and stream tracks.
    }
    const timer = window.setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}

function waitForStop(stopped: Promise<void>, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
    const abort = () => {
      cleanup()
      reject(new DOMException('Director export cancelled', 'AbortError')) // Explicit cancel must also interrupt the encoder's final flush.
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('DIRECTOR_RECORDING_STOP_TIMEOUT')) // A stalled encoder must not keep targets/tracks alive forever.
    }, 10_000)
    signal?.addEventListener('abort', abort, { once: true })
    void stopped.then(() => { cleanup(); resolve() })
    if (signal?.aborted) abort()
  })
}

/** Record clean frames in real time using the existing WebGL context and frozen document. @param renderer Editor renderer. @param palette Token palette. @param options Camera/snapshot/size/progress/cancellation. @returns Real encoded video; WebM fallback is explicit. @throws Error if recording is unsupported, encoding fails, or cancelled. @see docs/api-contracts/client/director-stage.md#RULE_DIRECTOR_OUTPUT */
export async function recordDirectorVideo(renderer: THREE.WebGLRenderer, palette: StagePalette, options: RecordOptions): Promise<RecordingResult> {
  assertCaptureActive(options.signal)
  const format = getRecordingFormat()
  if (!format || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    throw new Error('DIRECTOR_RECORDING_UNSUPPORTED') // ERR_DIRECTOR_RECORDING: no supported browser encoder/canvas stream.
  }
  const frozen: DirectorDocument = structuredClone(options.snapshot)
  const cameraId = options.cameraId ?? frozen.activeCameraId
  if (!frozen.cameras.some((camera) => camera.id === cameraId)) {
    throw new Error('DIRECTOR_CAMERA_MISSING') // ERR_DIRECTOR_CAMERA: fail before recording the wrong camera.
  }
  const dimensions = outputDimensions(frozen, options.width, options.height)
  const world = createRenderWorld(sampleDirectorFrame(frozen, 0), palette)
  let surface: PixelSurface | undefined
  let stream: MediaStream | undefined
  let recorder: MediaRecorder | undefined
  try {
    surface = createPixelSurface(renderer, dimensions.width, dimensions.height)
    stream = surface.canvas.captureStream(frozen.fps)
    recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    let recordingError: Error | undefined
    let finish!: () => void
    const stopped = new Promise<void>((resolve) => { finish = resolve })
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => finish()
    recorder.onerror = () => { recordingError = new Error('DIRECTOR_RECORDING_FAILED'); finish() }
    const draw = (frame: number) => {
      const sampled = sampleDirectorFrame(frozen, frame)
      world.update(sampled)
      const camera = sampled.cameras.find((item) => item.id === cameraId)!
      surface!.render(world.scene, createShotCamera(camera, dimensions.width / dimensions.height))
    }
    draw(0)
    recorder.start(1000)
    const start = performance.now()
    options.onProgress?.(0)
    while (performance.now() - start < frozen.duration * 1000) {
      assertCaptureActive(options.signal)
      if (recordingError) throw recordingError // ERR_DIRECTOR_RECORDING: propagate browser encoder failure.
      const elapsed = performance.now() - start
      draw(Math.min(frozen.duration * frozen.fps, Math.floor(elapsed / 1000 * frozen.fps)))
      options.onProgress?.(Math.min(0.99, elapsed / (frozen.duration * 1000)))
      await waitFrame(1000 / frozen.fps, options.signal)
    }
    draw(frozen.duration * frozen.fps)
    if (recorder.state !== 'inactive') recorder.stop()
    await waitForStop(stopped, options.signal)
    assertCaptureActive(options.signal)
    if (recordingError) throw recordingError // ERR_DIRECTOR_RECORDING: stop can report a final encoding failure.
    if (!chunks.length) throw new Error('DIRECTOR_RECORDING_EMPTY') // ERR_DIRECTOR_RECORDING: never report an empty file as success.
    const mimeType = recorder.mimeType || format.mimeType
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
    options.onProgress?.(1)
    return { blob: new Blob(chunks, { type: mimeType }), mimeType, extension }
  } finally {
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } finally {
      if (recorder) { recorder.onstop = null; recorder.onerror = null; recorder.ondataavailable = null }
      stream?.getTracks().forEach((track) => track.stop())
      surface?.dispose()
      world.dispose()
    }
  }
}
