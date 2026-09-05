import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDirectorDocument } from './model'
import { addClip, sampleDirectorFrame, upsertKeyframe } from './animation'
import { useModelKeyboardMove } from './useModelKeyboardMove'

let now: number
let callbacks: Map<number, FrameRequestCallback>
beforeEach(() => {
  now = 0; callbacks = new Map()
  let id = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id })
  vi.stubGlobal('cancelAnimationFrame', (key: number) => callbacks.delete(key))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const tick = (milliseconds = 50) => act(() => { now += milliseconds; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach((callback) => callback(now)) })
const setup = () => {
  const document = createDirectorDocument()
  const options = { document, sampled: document, frame: 0, selectedId: document.objects[0].id as string | null, disabled: false, onPreview: vi.fn(), onCommit: vi.fn() }
  return { options, ...renderHook((props) => useModelKeyboardMove(props), { initialProps: options }) }
}
const position = (options: ReturnType<typeof setup>['options']) => options.onPreview.mock.calls.filter(([value]) => value).at(-1)![0].objects[0].position as number[]

describe('model keyboard gesture', () => {
  it.each([['w', 2, -.05], ['s', 2, .05], ['a', 0, -.05], ['d', 0, .05], ['e', 1, .05], ['q', 1, -.05]] as const)('moves %s with a short tap', (key, axis, delta) => {
    const { options } = setup()
    fireEvent.keyDown(window, { key }); fireEvent.keyUp(window, { key })
    expect(position(options)[axis]).toBeCloseTo(options.document.objects[0].position[axis] + delta)
    expect(options.onCommit).toHaveBeenCalledTimes(1)
  })
  it('uses elapsed time, normalizes diagonal velocity, and commits a hold only once', () => {
    const { options } = setup()
    fireEvent.keyDown(window, { key: 'w' }); fireEvent.keyDown(window, { key: 'd' })
    tick(50); tick(50)
    const actual = position(options)
    expect(actual[0]).toBeCloseTo(.2 / Math.sqrt(2))
    expect(actual[2]).toBeCloseTo(-.05 - .2 / Math.sqrt(2))
    fireEvent.keyDown(window, { key: 'w', repeat: true })
    expect(options.onCommit).not.toHaveBeenCalled()
    fireEvent.keyUp(window, { key: 'w' }); fireEvent.keyUp(window, { key: 'd' })
    expect(options.onCommit).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(0)
  })
  it('moves the same distance at different rendering rates', () => {
    const first = setup()
    fireEvent.keyDown(window, { key: 'd' })
    for (let index = 0; index < 10; index++) tick(10)
    fireEvent.keyUp(window, { key: 'd' })
    const fast = position(first.options)[0]
    first.unmount()
    const second = setup()
    fireEvent.keyDown(window, { key: 'd' })
    tick(100)
    fireEvent.keyUp(window, { key: 'd' })
    expect(position(second.options)[0]).toBeCloseTo(fast)
  })
  it.each(['disabled', 'locked', 'camera', 'none', 'ctrlKey', 'metaKey', 'altKey'] as const)('does not move with %s', (gate) => {
    const { options, rerender } = setup()
    if (gate === 'disabled') options.disabled = true
    if (gate === 'locked') options.document.objects[0].locked = true
    if (gate === 'camera') options.selectedId = options.document.activeCameraId
    if (gate === 'none') options.selectedId = null
    rerender({ ...options })
    const event = new KeyboardEvent('keydown', { key: 'w', cancelable: true, ...(['ctrlKey', 'metaKey', 'altKey'].includes(gate) ? { [gate]: true } : {}) })
    act(() => window.dispatchEvent(event))
    expect(options.onPreview).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
  it.each(['blur', 'visibility', 'selection', 'unmount', 'focus'] as const)('stops and clears pressed keys on %s', (reason) => {
    const { options, rerender, unmount } = setup()
    fireEvent.keyDown(window, { key: 'w' }); tick()
    let input: HTMLInputElement | undefined
    if (reason === 'blur') fireEvent.blur(window)
    if (reason === 'visibility') { vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); fireEvent(document, new Event('visibilitychange')) }
    if (reason === 'selection') rerender({ ...options, selectedId: options.document.activeCameraId })
    if (reason === 'unmount') unmount()
    if (reason === 'focus') { input = document.createElement('input'); document.body.append(input); act(() => input!.focus()) }
    expect(options.onCommit).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(0)
    tick()
    expect(options.onCommit).toHaveBeenCalledTimes(1)
    input?.remove()
  })
  it('ignores editable event targets including inherited contenteditable', () => {
    const { options } = setup()
    const parent = document.createElement('div'), child = document.createElement('span')
    parent.setAttribute('contenteditable', ''); parent.append(child); document.body.append(parent)
    fireEvent.keyDown(child, { key: 'd' })
    expect(options.onPreview).not.toHaveBeenCalled()
    parent.remove()
  })
  it('patches the current animation frame without baking its sampled position into base', () => {
    const { options, rerender, result } = setup()
    const id = options.selectedId!
    const keyed = upsertKeyframe(upsertKeyframe(options.document, { targetId: id, channel: 'position', frame: 0, value: [0, 0, 0] }), { targetId: id, channel: 'position', frame: 100, value: [10, 0, 0] })
    rerender({ ...options, document: keyed, sampled: sampleDirectorFrame(keyed, 50), frame: 50 })
    fireEvent.keyDown(window, { key: 'd' }); tick(); tick()
    act(() => {
      const saved = result.current()
      expect(saved.objects[0].position).toEqual([0, 0, 0])
      expect((saved.keyframes.find((key) => key.frame === 50)?.value as number[])[0]).toBeCloseTo(5.25)
    })
    expect(options.onCommit).toHaveBeenCalledTimes(1)
  })
  it('overrides a path clip once without repeatedly adding its sampled offset', () => {
    const { options, rerender, result } = setup()
    const authored = addClip(options.document, { targetId: options.selectedId!, presetId: 'path-forward', startFrame: 0, endFrame: 100, amount: 2, loop: false })
    const sampled = sampleDirectorFrame(authored, 50)
    rerender({ ...options, document: authored, sampled, frame: 50 })
    fireEvent.keyDown(window, { key: 'w' }); tick(); tick()
    act(() => {
      const saved = result.current()
      expect(saved.objects[0].position).toEqual(authored.objects[0].position)
      expect(sampleDirectorFrame(saved, 50).objects[0].position[2]).toBeCloseTo(sampled.objects[0].position[2] - .25)
      expect(saved.keyframes.filter((key) => key.channel === 'position')).toHaveLength(2)
    })
    expect(options.onCommit.mock.calls[0][1]).toBe(true)
  })
})
