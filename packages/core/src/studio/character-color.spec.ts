import { describe, expect, it } from 'vitest'
import { normalizeCharacterColor, resolveCharacterColor } from './character-color'
import { createDirectorDocument, createStageObject, duplicateEntity, normalizeDirectorDocument } from './model'
import { applyEntityPatch } from './editing'
import { createHistory, pushHistory, redoHistory, undoHistory } from './history'

describe('character material colors', () => {
  it.each(['#AABBCC', '#000000', '#ffffff'])('normalizes %s without changing its value', (color) => {
    expect(normalizeCharacterColor(color)).toBe(color.toLowerCase())
    const doc = createDirectorDocument()
    doc.objects[0].color = color
    expect(normalizeDirectorDocument(doc).objects[0].color).toBe(color.toLowerCase())
  })
  it.each(['#abc', '#12345678', 'red', ' #aabbcc', 'url(test)', '', null, 12, {}])('drops invalid color %j', (color) => {
    const doc = createDirectorDocument()
    expect(normalizeDirectorDocument({ ...doc, objects: [{ ...doc.objects[0], color }] }).objects[0]).not.toHaveProperty('color')
  })
  it('preserves legacy index five and ignores custom colors on props', () => {
    const doc = createDirectorDocument()
    const old = normalizeDirectorDocument({ ...doc, version: 1, objects: [{ ...doc.objects[0], colorIndex: 5 }] })
    expect(old.objects[0].colorIndex).toBe(5)
    expect(old.objects[0]).not.toHaveProperty('color')
    const colors = ['green', 'blue', 'orange', 'red', 'purple']
    expect(resolveCharacterColor(old.objects[0], colors)).toBe('green')
    expect(resolveCharacterColor({ ...old.objects[0], kind: 'box', color: '#123456' }, colors)).toBe('green')
  })
  it('changes only one character, supports preset switching, undo/redo and save/copy', () => {
    const doc = createDirectorDocument()
    doc.objects.push(createStageObject(doc, 'mannequin'))
    const original = structuredClone(doc)
    const edited = applyEntityPatch(doc, doc, doc.objects[0].id, { color: '#abcdef' }, 0).document
    expect(edited.objects[1]).toEqual(doc.objects[1])
    expect(doc).toEqual(original)
    const history = pushHistory(createHistory(doc), edited)
    expect(undoHistory(history).present).toEqual(doc)
    expect(redoHistory(undoHistory(history)).present).toEqual(edited)
    const copied = duplicateEntity(edited, doc.objects[0].id)
    const saved = normalizeDirectorDocument(JSON.parse(JSON.stringify(copied)))
    expect(saved.objects.at(-1)?.color).toBe('#abcdef')
    const preset = applyEntityPatch(edited, edited, doc.objects[0].id, { color: undefined, colorIndex: 2 }, 0).document
    expect(normalizeDirectorDocument(preset).objects[0]).not.toHaveProperty('color')
    expect(preset.objects[0].colorIndex).toBe(2)
  })
  it('does not alter locked characters', () => {
    const doc = createDirectorDocument()
    doc.objects[0].locked = true
    expect(applyEntityPatch(doc, doc, doc.objects[0].id, { color: '#abcdef' }, 0).document).toBe(doc)
  })
})
