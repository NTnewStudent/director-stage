import * as THREE from 'three'
import type { DirectorDocument } from '../model'
import { sampleDirectorFrame } from '../animation'
import { createRenderWorld, createShotCamera, outputDimensions, type StagePalette } from './world'

/** Frozen-shot request. Exporting never changes the editor camera/document. */
export interface CaptureOptions {
  snapshot: DirectorDocument
  cameraId?: string
  frame?: number
  width?: number
  height?: number
  signal?: AbortSignal
}

/** An offscreen target and 2D transfer canvas backed by the existing WebGL renderer. */
export interface PixelSurface {
  canvas: HTMLCanvasElement
  /** Draw a world through the given camera, preserving the caller's WebGL state. */
  render: (scene: THREE.Scene, camera: THREE.Camera) => void
  /** Release framebuffer and transfer canvas memory. */
  dispose: () => void
}

/** Allocate a reusable capture surface, never another WebGL context. @param renderer Existing editor renderer. @param width Pixel width. @param height Pixel height. @returns Disposable pixel surface. @throws Error when 2D canvas is unavailable. */
export function createPixelSurface(renderer: THREE.WebGLRenderer, width: number, height: number): PixelSurface {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('DIRECTOR_CANVAS_UNAVAILABLE') // ERR_DIRECTOR_CANVAS: browser has no 2D transfer canvas.
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true })
  target.texture.colorSpace = THREE.SRGBColorSpace
  const pixels = new Uint8Array(width * height * 4)
  const bitmap = context.createImageData(width, height)
  return {
    canvas,
    render(scene, camera) {
      const previousTarget = renderer.getRenderTarget()
      const autoClear = renderer.autoClear
      try {
        // RenderTarget.viewport/scissor use physical pixels. setViewport() would multiply by
        // the editor DPR again, cropping exports and shifting the image center on Retina displays.
        renderer.setRenderTarget(target)
        renderer.autoClear = true
        renderer.render(scene, camera)
        renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)
        for (let row = 0; row < height; row++) {
          bitmap.data.set(pixels.subarray((height - row - 1) * width * 4, (height - row) * width * 4), row * width * 4)
        }
        context.putImageData(bitmap, 0, 0)
      } finally {
        // Restoring the target also restores its physical viewport/scissor; the default
        // framebuffer restores the renderer's untouched logical viewport with its own DPR.
        renderer.setRenderTarget(previousTarget)
        renderer.autoClear = autoClear
      }
    },
    dispose() { target.dispose(); canvas.width = 0; canvas.height = 0 },
  }
}

/** Reject already cancelled work before allocating resources. @param signal Optional cancellation. @returns Nothing. @throws AbortError when cancelled. */
export function assertCaptureActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Director export cancelled', 'AbortError') // ERR_DIRECTOR_CANCELLED: explicit user cancel/unmount.
}

/** Capture a clean PNG using a frozen sampled scene and the requested filming camera. @param renderer Existing WebGL renderer. @param palette Theme palette. @param options Snapshot/camera/frame/resolution. @returns PNG blob. @throws Error for missing camera, encoding failure or cancellation. @see docs/api-contracts/client/director-stage.md#RULE_DIRECTOR_OUTPUT */
export async function captureDirectorFrame(renderer: THREE.WebGLRenderer, palette: StagePalette, options: CaptureOptions): Promise<Blob> {
  assertCaptureActive(options.signal)
  const frozen = structuredClone(options.snapshot)
  const sampled = sampleDirectorFrame(frozen, options.frame ?? 0)
  const camera = sampled.cameras.find((item) => item.id === (options.cameraId ?? sampled.activeCameraId))
  if (!camera) throw new Error('DIRECTOR_CAMERA_MISSING') // ERR_DIRECTOR_CAMERA: deleted/stale requested camera cannot silently select another.
  const dimensions = outputDimensions(sampled, options.width, options.height)
  const world = createRenderWorld(sampled, palette)
  let surface: PixelSurface | undefined
  try {
    surface = createPixelSurface(renderer, dimensions.width, dimensions.height)
    surface.render(world.scene, createShotCamera(camera, dimensions.width / dimensions.height))
    const blob = await new Promise<Blob>((resolve, reject) => {
      surface!.canvas.toBlob((result) => result ? resolve(result) : reject(new Error('DIRECTOR_PNG_ENCODING_FAILED')), 'image/png')
    })
    assertCaptureActive(options.signal)
    return blob
  } finally {
    surface?.dispose()
    world.dispose()
  }
}
