// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createDirectorDocument } from '../model'
import { captureDirectorFrame, createPixelSurface } from './capture'
import { getRecordingFormat, recordDirectorVideo } from './recorder'
import { createShotCamera, type StagePalette } from './world'

const palette: StagePalette = { background: 'black', grid: 'gray', foreground: 'white', illumination: 'white', accent: 'green', objectColors: ['gray'] }

function fakeRenderer() {
  const originalTarget = new THREE.WebGLRenderTarget(2, 2)
  const render = vi.fn()
  const renderer = {
    autoClear: false,
    getRenderTarget: () => originalTarget,
    getViewport: (value: THREE.Vector4) => value.set(1, 2, 3, 4),
    getScissor: (value: THREE.Vector4) => value.set(5, 6, 7, 8),
    getScissorTest: () => true,
    setRenderTarget: vi.fn(), setViewport: vi.fn(), setScissor: vi.fn(), setScissorTest: vi.fn(), render,
    readRenderTargetPixels: (_target: unknown, _x: number, _y: number, _w: number, _h: number, pixels: Uint8Array) => pixels.fill(255),
  }
  return { gl: renderer as unknown as THREE.WebGLRenderer, renderer, render, originalTarget }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })))
})

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream') })

describe('clean capture', () => {
  it('restores renderer target/viewport/scissor even when rendering throws', () => {
    const { gl, renderer, render, originalTarget } = fakeRenderer()
    const surface = createPixelSurface(gl, 2, 2)
    render.mockImplementation(() => { throw new Error('device lost') }) // Simulate context loss during an offscreen render.
    expect(() => surface.render(new THREE.Scene(), new THREE.Camera())).toThrow('device lost')
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(originalTarget)
    expect(renderer.setViewport).not.toHaveBeenCalled()
    expect(renderer.setScissor).not.toHaveBeenCalled()
    expect(renderer.setScissorTest).not.toHaveBeenCalled()
    expect(renderer.autoClear).toBe(false)
    surface.dispose()
  })

  it.each([1, 1.5, 2])('keeps a physical-pixel framing viewport at editor DPR %s', (dpr) => {
    const { gl, renderer, render } = fakeRenderer()
    const physicalViewport = new THREE.Vector4()
    renderer.setRenderTarget.mockImplementation((target: THREE.WebGLRenderTarget) => { physicalViewport.copy(target.viewport) })
    // Faithfully model Three r185: setViewport always multiplies logical values by DPR,
    // even while a physical-pixel FBO is bound. This catches the observed Retina crop.
    renderer.setViewport.mockImplementation((x: number, y: number, width: number, height: number) => { physicalViewport.set(x, y, width, height).multiplyScalar(dpr) })
    const camera = createShotCamera(createDirectorDocument().cameras[0], 16 / 9)
    const head = new THREE.Vector3(0, 1.75, 0).project(camera)
    const feet = new THREE.Vector3(0, 0, 0).project(camera)
    render.mockImplementation(() => {
      expect(physicalViewport.toArray()).toEqual([0, 0, 1280, 720])
      for (const point of [head, feet]) {
        const x = (point.x + 1) / 2 * physicalViewport.z
        const y = (point.y + 1) / 2 * physicalViewport.w
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThan(1280)
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(720)
      }
    })
    const surface = createPixelSurface(gl, 1280, 720)
    surface.render(new THREE.Scene(), camera)
    surface.dispose()
  })

  it('uses the requested snapshot camera and excludes editor helpers', async () => {
    const { gl, render } = fakeRenderer()
    const snapshot = createDirectorDocument()
    snapshot.cameras.push({ ...snapshot.cameras[0], id: 'camera_2', position: [8, 7, 6] })
    snapshot.keyframes = [
      { id: 'key_1', targetId: snapshot.objects[0].id, channel: 'position', frame: 0, value: [0, 0, 0], interpolation: 'linear' },
      { id: 'key_2', targetId: snapshot.objects[0].id, channel: 'position', frame: 30, value: [4, 0, 0], interpolation: 'linear' },
    ]
    const saved = structuredClone(snapshot)
    render.mockImplementation((world: THREE.Scene, camera: THREE.Camera) => {
      expect(camera.position.toArray()).toEqual(saved.cameras[1].position)
      expect(world.children.some((child) => child instanceof THREE.GridHelper || child instanceof THREE.CameraHelper)).toBe(false)
      expect(world.children.find((child) => child.userData.entityId === saved.objects[0].id)?.position.x).toBe(2)
    })
    const blob = await captureDirectorFrame(gl, palette, { snapshot, cameraId: 'camera_2', frame: 15, width: 4, height: 4 })
    expect(snapshot).toEqual(saved)
    expect(blob.type).toBe('image/png')
  })

  it('refuses missing cameras and aborts without rendering', async () => {
    const { gl, render } = fakeRenderer()
    const snapshot = createDirectorDocument()
    await expect(captureDirectorFrame(gl, palette, { snapshot, cameraId: 'missing' })).rejects.toThrow('DIRECTOR_CAMERA_MISSING')
    await expect(captureDirectorFrame(gl, palette, { snapshot, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' })
    expect(render).not.toHaveBeenCalled()
  })

  it('disposes target on PNG failure', async () => {
    const { gl } = fakeRenderer()
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null))
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    await expect(captureDirectorFrame(gl, palette, { snapshot: createDirectorDocument(), width: 4, height: 4 })).rejects.toThrow('DIRECTOR_PNG_ENCODING_FAILED')
    expect(dispose).toHaveBeenCalledOnce()
  })
})

describe('browser video recording', () => {
  it('negotiates real MIME support without disguising WebM as MP4', () => {
    expect(getRecordingFormat((mime) => mime === 'video/mp4')).toEqual({ mimeType: 'video/mp4', extension: 'mp4' })
    expect(getRecordingFormat((mime) => mime.includes('vp8'))).toEqual({ mimeType: 'video/webm;codecs=vp8', extension: 'webm' })
    expect(getRecordingFormat(() => false)).toBeNull()
  })

  function recorderEnvironment(mode?: 'start-error' | 'encoder-error' | 'stop-stall' | 'empty') {
    const stop = vi.fn()
    const captureStream = vi.fn(() => ({ getTracks: () => [{ stop }] }))
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: captureStream })
    class FakeRecorder {
      static isTypeSupported(mime: string) { return mime === 'video/webm' }
      state = 'inactive'
      mimeType = 'video/webm'
      onstop?: () => void
      ondataavailable?: (event: { data: Blob }) => void
      onerror?: () => void
      start() {
        if (mode === 'start-error') throw new Error('encoder start failed') // Simulate a browser rejecting a format after capability negotiation.
        this.state = 'recording'
        if (mode === 'encoder-error') this.onerror?.()
      }
      stop() {
        this.state = 'inactive'
        if (mode === 'stop-stall') return
        if (mode !== 'empty') this.ondataavailable?.({ data: new Blob(['video']) })
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    return { stop }
  }

  it('returns a real negotiated-format blob and releases tracks after success', async () => {
    vi.useFakeTimers()
    const { stop } = recorderEnvironment()
    const { gl, render } = fakeRenderer()
    const snapshot = { ...createDirectorDocument(), duration: 1 }
    const originalPosition = [...snapshot.cameras[0].position]
    render.mockImplementation((_world: THREE.Scene, camera: THREE.Camera) => expect(camera.position.toArray()).toEqual(originalPosition))
    const promise = recordDirectorVideo(gl, palette, { snapshot, width: 4, height: 4 })
    snapshot.cameras[0].position = [50, 50, 50]
    await vi.advanceTimersByTimeAsync(1100)
    const result = await promise
    expect(result.extension).toBe('webm')
    expect(result.blob.type).toBe('video/webm')
    expect(result.blob.size).toBeGreaterThan(0)
    expect(stop).toHaveBeenCalledOnce()
    expect(render.mock.calls.length).toBeGreaterThan(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels in-flight recording and disposes framebuffer and stream', async () => {
    vi.useFakeTimers()
    const { stop } = recorderEnvironment()
    const { gl } = fakeRenderer()
    const controller = new AbortController()
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    const promise = recordDirectorVideo(gl, palette, { snapshot: createDirectorDocument(), width: 4, height: 4, signal: controller.signal })
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(stop).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['start-error', 'encoder-error'] as const)('releases tracks and framebuffer when %s occurs', async (mode) => {
    const { stop } = recorderEnvironment(mode)
    const { gl } = fakeRenderer()
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    await expect(recordDirectorVideo(gl, palette, { snapshot: createDirectorDocument(), width: 4, height: 4 })).rejects.toThrow(mode === 'start-error' ? 'encoder start failed' : 'DIRECTOR_RECORDING_FAILED')
    expect(stop).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('rejects an empty encoder output instead of returning a successful file', async () => {
    vi.useFakeTimers()
    const { stop } = recorderEnvironment('empty')
    const { gl } = fakeRenderer()
    const promise = recordDirectorVideo(gl, palette, { snapshot: { ...createDirectorDocument(), duration: 1 }, width: 4, height: 4 })
    const rejected = expect(promise).rejects.toThrow('DIRECTOR_RECORDING_EMPTY')
    await vi.advanceTimersByTimeAsync(1100)
    await rejected
    expect(stop).toHaveBeenCalledOnce()
  })

  it('allows cancellation during the encoder final flush', async () => {
    vi.useFakeTimers()
    const { stop } = recorderEnvironment('stop-stall')
    const { gl } = fakeRenderer()
    const controller = new AbortController()
    const promise = recordDirectorVideo(gl, palette, { snapshot: { ...createDirectorDocument(), duration: 1 }, width: 4, height: 4, signal: controller.signal })
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(1100)
    controller.abort()
    await rejected
    expect(stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out stalled finalization and releases resources', async () => {
    vi.useFakeTimers()
    const { stop } = recorderEnvironment('stop-stall')
    const { gl } = fakeRenderer()
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    const promise = recordDirectorVideo(gl, palette, { snapshot: { ...createDirectorDocument(), duration: 1 }, width: 4, height: 4 })
    const rejected = expect(promise).rejects.toThrow('DIRECTOR_RECORDING_STOP_TIMEOUT')
    await vi.advanceTimersByTimeAsync(12_000)
    await rejected
    expect(stop).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
