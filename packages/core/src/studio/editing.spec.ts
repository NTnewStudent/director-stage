import { describe, expect, it } from 'vitest'
import { addClip, sampleDirectorFrame, upsertKeyframe } from './animation'
import { createDirectorDocument, normalizeDirectorDocument } from './model'
import { applyEntityPatch } from './editing'

describe('authored versus sampled field commits', () => {
  it('anchors clip-only movement before changing a sampled transform without doubling offsets', () => {
    let document = createDirectorDocument()
    const id = document.objects[0].id
    document = addClip(document, { targetId: id, presetId: 'path-forward', startFrame: 0, endFrame: 60, amount: 2 })
    const sampled = sampleDirectorFrame(document, 30)
    expect(sampled.objects[0].position).toEqual([0, 0, 1])
    const result = applyEntityPatch(document, sampled, id, { position: [1, 0, 1] }, 30)
    expect(result.overridesClip).toBe(true)
    expect(result.document.objects[0].position).toEqual([0, 0, 0])
    expect(result.document.keyframes.map((key) => key.frame)).toEqual([0, 30])
    expect(sampleDirectorFrame(result.document, 30).objects[0].position).toEqual([1, 0, 1])
    expect(sampleDirectorFrame(result.document, 0).objects[0].position).toEqual([0, 0, 0])
  })
  it('does not create artificial keys for untouched gizmo channels', () => {
    let document = createDirectorDocument()
    const id = document.objects[0].id
    document = addClip(document, { targetId: id, presetId: 'path-forward', startFrame: 0, endFrame: 60 })
    const sampled = sampleDirectorFrame(document, 30)
    const result = applyEntityPatch(document, sampled, id, { position: [1, 0, .5], rotation: sampled.objects[0].rotation, scale: sampled.objects[0].scale }, 30)
    expect(result.document.keyframes.every((key) => key.channel === 'position')).toBe(true)
  })
  it('keeps explicit pose edits independent of sampled procedural joints', () => {
    let document = createDirectorDocument()
    const id = document.objects[0].id
    document = addClip(document, { targetId: id, presetId: 'walk', startFrame: 0, endFrame: 60 })
    const sampled = sampleDirectorFrame(document, 15)
    const result = applyEntityPatch(document, sampled, id, { poseControls: { ...document.objects[0].poseControls, 'head.yaw': 20 } }, 15)
    expect(result.document.objects[0].poseControls).toEqual({ 'head.yaw': 20 })
    const stopped = normalizeDirectorDocument({ ...result.document, clips: [] })
    expect(stopped.objects[0].poseControls).toEqual({ 'head.yaw': 20 })
  })
  it('does not animate unrelated transforms when a clip only affects joints', () => {
    let document = createDirectorDocument()
    const id = document.objects[0].id
    document = addClip(document, { targetId: id, presetId: 'wave', startFrame: 0, endFrame: 60 })
    const sampled = sampleDirectorFrame(document, 30)
    const result = applyEntityPatch(document, sampled, id, { position: [1, 0, 0], scale: [2, 2, 2] }, 30)
    expect(result.document.keyframes).toEqual([])
    expect(result.document.objects[0].position).toEqual([1, 0, 0])
    expect(result.overridesClip).toBe(false)
  })
  it('preserves user-selected interpolation while editing an existing key', () => {
    let document = createDirectorDocument()
    const id = document.objects[0].id
    document = upsertKeyframe(document, { targetId: id, channel: 'position', frame: 30, value: [0, 0, 0], interpolation: 'hold' })
    const result = applyEntityPatch(document, sampleDirectorFrame(document, 30), id, { position: [1, 0, 0] }, 30)
    expect(result.document.keyframes[0].interpolation).toBe('hold')
  })
})
