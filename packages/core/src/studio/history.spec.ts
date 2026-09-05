import { describe, expect, it } from 'vitest'
import { createDirectorDocument } from './model'
import { createHistory, pushHistory, undoHistory, redoHistory } from './history'

describe('document-only history', () => {
  it('undoes/redoes completed edits and invalidates a redo branch', () => {
    const doc = createDirectorDocument()
    let history = createHistory(doc)
    history = pushHistory(history, { ...doc, duration: 10 })
    expect(history.past).toHaveLength(1)
    history = undoHistory(history)
    expect(history.present.duration).toBe(5)
    expect(redoHistory(history).present.duration).toBe(10)
    history = pushHistory(history, { ...doc, duration: 15 })
    expect(history.future).toEqual([])
    expect(history.present.duration).toBe(15)
  })

  it('ignores no-op commits and does nothing at undo/redo boundaries', () => {
    const doc = createDirectorDocument()
    const history = createHistory(doc)
    expect(pushHistory(history, doc)).toBe(history)
    expect(undoHistory(history)).toBe(history)
    expect(redoHistory(history)).toBe(history)
  })

  it('detaches external documents and bounds undo memory to 80 edits', () => {
    const doc = createDirectorDocument()
    let history = createHistory(doc)
    doc.objects[0].position[0] = 22
    expect(history.present.objects[0].position[0]).toBe(0)
    for (let i = 0; i < 100; i += 1) history = pushHistory(history, { ...history.present, duration: i + 1 })
    expect(history.past).toHaveLength(80)
    const next = { ...history.present, objects: [] }
    history = pushHistory(history, next)
    next.duration = 200
    expect(history.present.duration).toBe(100)
  })
})
