import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Vec3 } from '../scene/director-scene'
import { applyEntityPatch } from './editing'
import type { DirectorDocument } from './model'

const DIRECTIONS: Record<string, Vec3> = { w: [0, 0, -1], s: [0, 0, 1], a: [-1, 0, 0], d: [1, 0, 0], e: [0, 1, 0], q: [0, -1, 0] }
const editable = (target: EventTarget | null) => target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
interface Options {
  document: DirectorDocument
  sampled: DirectorDocument
  selectedId: string | null
  frame: number
  disabled: boolean
  onPreview: (document: DirectorDocument | null) => void
  onCommit: (document: DirectorDocument, overridesClip: boolean) => void
}

/** Moves the selected model in world space as one undoable keyboard gesture.
 * @param options Current authored/render documents, selection, gates and preview/commit callbacks.
 * @returns A synchronous flush function returning the last preview, for save/close and other edits.
 * @throws Never for normalized director documents.
 * @see docs/api-contracts/client/director-stage.md#RULE_DIRECTOR_MODEL_KEYBOARD_MOVE
 */
export function useModelKeyboardMove(options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => { latest.current = options })
  const gesture = useRef<{ source: Options; position: Vec3; next: DirectorDocument; overridesClip: boolean } | null>(null)
  const keys = useRef(new Set<string>())
  const request = useRef(0)
  const flush = useCallback(() => {
    cancelAnimationFrame(request.current)
    request.current = 0
    keys.current.clear()
    const current = gesture.current
    gesture.current = null
    if (current) {
      latest.current.onCommit(current.next, current.overridesClip)
      latest.current.onPreview(null)
    }
    return current?.next ?? latest.current.document
  }, [])
  useEffect(() => {
    let previous = 0
    const valid = () => {
      const current = latest.current
      return !current.disabled && !document.hidden && !editable(document.activeElement)
        && current.document.objects.some((object) => object.id === current.selectedId && !object.locked)
    }
    const advance = (seconds: number) => {
      const current = gesture.current
      if (!current) return
      const direction = [0, 0, 0]
      for (const key of keys.current) DIRECTIONS[key].forEach((value, axis) => { direction[axis] += value })
      const length = Math.hypot(...direction)
      if (!length) return
      current.position = current.position.map((value, axis) => value + direction[axis] / length * seconds * 2) as Vec3
      const result = applyEntityPatch(current.source.document, current.source.sampled, current.source.selectedId!, { position: current.position }, current.source.frame)
      current.next = result.document
      current.overridesClip = result.overridesClip
      latest.current.onPreview(current.next)
    }
    const tick = (now: number) => {
      if (!valid()) { flush(); return }
      advance(Math.min(.1, Math.max(0, (now - previous) / 1000)))
      previous = now
      request.current = requestAnimationFrame(tick)
    }
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || editable(event.target) || !valid()) { flush(); return }
      const key = event.key.toLowerCase()
      if (!DIRECTIONS[key]) { flush(); return }
      event.preventDefault(); event.stopPropagation()
      if (event.repeat || keys.current.has(key)) return
      keys.current.add(key)
      if (!gesture.current) {
        const source = latest.current
        const object = source.sampled.objects.find((item) => item.id === source.selectedId)!
        gesture.current = { source, position: [...object.position], next: source.document, overridesClip: false }
        advance(.025)
        previous = performance.now()
        request.current = requestAnimationFrame(tick)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (!keys.current.delete(event.key.toLowerCase())) return
      event.preventDefault(); event.stopPropagation()
      if (!keys.current.size) flush()
    }
    const focus = (event: FocusEvent) => { if (editable(event.target)) flush() }
    const visibility = () => { if (document.hidden) flush() }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', flush)
    window.addEventListener('pointerdown', flush, true)
    window.addEventListener('focusin', focus)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      flush()
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', flush)
      window.removeEventListener('pointerdown', flush, true)
      window.removeEventListener('focusin', focus)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [flush])
  useLayoutEffect(() => { flush() }, [options.selectedId, options.disabled, options.frame, flush])
  return flush
}
