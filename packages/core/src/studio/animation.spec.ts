import { describe, expect, it } from 'vitest'
import { addClip, removeClip, removeKeyframe, sampleDirectorFrame, upsertKeyframe } from './animation'
import { addCamera, createDirectorDocument, normalizeDirectorDocument } from './model'
import { DIRECTOR_ACTION_CATALOG, DIRECTOR_MOTION_CATALOG } from './catalog'

describe('deterministic timeline channels', () => {
  it.each(['linear', 'hold', 'ease'] as const)('interpolates %s and honors exact keys', (interpolation) => {
    let doc = createDirectorDocument()
    const targetId = doc.objects[0].id
    doc = upsertKeyframe(doc, { targetId, channel: 'position', frame: 0, value: [0, 0, 0], interpolation })
    doc = upsertKeyframe(doc, { targetId, channel: 'position', frame: 100, value: [10, 20, -10] })
    const t = interpolation === 'linear' ? 0.25 : interpolation === 'hold' ? 0 : 0.15625
    expect(sampleDirectorFrame(doc, 25).objects[0].position).toEqual([10 * t, 20 * t, -10 * t || 0])
    expect(sampleDirectorFrame(doc, 100).objects[0].position).toEqual([10, 20, -10])
    expect(sampleDirectorFrame(doc, 150).objects[0].position).toEqual([10, 20, -10])
  })

  it('samples scalar lens/roll channels and synchronizes the legacy projection', () => {
    let doc = createDirectorDocument()
    const targetId = doc.activeCameraId
    doc = upsertKeyframe(doc, { targetId, channel: 'focalLength', frame: 0, value: 35 })
    doc = upsertKeyframe(doc, { targetId, channel: 'focalLength', frame: 60, value: 85 })
    doc = upsertKeyframe(doc, { targetId, channel: 'roll', frame: 0, value: 0 })
    doc = upsertKeyframe(doc, { targetId, channel: 'roll', frame: 60, value: Math.PI / 2 })
    const sampled = sampleDirectorFrame(doc, 30)
    expect(sampled.focalLength).toBe(60)
    expect(sampled.cameras[0].focalLength).toBe(60)
    expect(sampled.cameras[0].roll).toBeCloseTo(Math.PI / 4)
  })

  it('upserts one key per frame and channel without duplicating it', () => {
    let doc = createDirectorDocument()
    const key = { targetId: doc.objects[0].id, channel: 'position' as const, frame: 14.8, value: [0, 0, 0] as [number, number, number] }
    doc = upsertKeyframe(doc, key)
    const id = doc.keyframes[0].id
    doc = upsertKeyframe(doc, { ...key, value: [1, 2, 3] })
    expect(doc.keyframes).toHaveLength(1)
    expect(doc.keyframes[0]).toMatchObject({ id, frame: 15, value: [1, 2, 3] })
    expect(removeKeyframe(doc, id).keyframes).toEqual([])
  })

  it('clamps frame range and leaves authored data untouched', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.activeCameraId, presetId: 'orbit', startFrame: 0, endFrame: 150 })
    const snapshot = JSON.stringify(doc)
    const end = sampleDirectorFrame(doc, 150)
    expect(sampleDirectorFrame(doc, 9999)).toEqual(end)
    expect(sampleDirectorFrame(doc, -50)).toEqual(sampleDirectorFrame(doc, 0))
    expect(sampleDirectorFrame(doc, NaN)).toEqual(sampleDirectorFrame(doc, 0))
    sampleDirectorFrame(doc, 31)
    expect(sampleDirectorFrame(doc, 150)).toEqual(end)
    expect(JSON.stringify(doc)).toBe(snapshot)
  })

  it('authored position keys override motion without cancelling lens motion', () => {
    let doc = createDirectorDocument()
    const targetId = doc.activeCameraId
    doc = addClip(doc, { targetId, presetId: 'push', startFrame: 0, endFrame: 60 })
    doc = addClip(doc, { targetId, presetId: 'zoom-in', startFrame: 0, endFrame: 60 })
    doc = upsertKeyframe(doc, { targetId, channel: 'position', frame: 0, value: [4, 5, 6] })
    const sampled = sampleDirectorFrame(doc, 30)
    expect(sampled.camera.position).toEqual([4, 5, 6])
    expect(sampled.focalLength).toBe(50)
  })

  it('does not accept animation targeting a previously created key ID', () => {
    const doc = createDirectorDocument()
    const valid = { id: 'key_1', targetId: doc.objects[0].id, channel: 'position', frame: 0, value: [0, 0, 0] }
    const dirty = normalizeDirectorDocument({ ...doc, keyframes: [valid, { ...valid, id: 'key_2', targetId: 'key_1' }] })
    expect(dirty.keyframes).toHaveLength(1)
  })
})

describe('procedural character actions and paths', () => {
  it.each(DIRECTOR_ACTION_CATALOG)('$id has a real sampled effect', ({ id }) => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.objects[0].id, presetId: id, startFrame: 0, endFrame: 90 })
    expect(sampleDirectorFrame(doc, 17).objects[0]).not.toEqual(doc.objects[0])
    expect(sampleDirectorFrame(doc, 17)).toEqual(sampleDirectorFrame(doc, 17))
  })

  it('movement starts at its assigned frame and holds its final position', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.objects[0].id, presetId: 'path-forward', startFrame: 30, endFrame: 90, amount: 3 })
    expect(sampleDirectorFrame(doc, 29).objects[0].position).toEqual([0, 0, 0])
    expect(sampleDirectorFrame(doc, 60).objects[0].position).toEqual([0, 0, 1.5])
    expect(sampleDirectorFrame(doc, 120).objects[0].position).toEqual([0, 0, 3])
  })

  it('combines walking with a path and stops the gait at clip end', () => {
    let doc = createDirectorDocument()
    const targetId = doc.objects[0].id
    doc = addClip(doc, { targetId, presetId: 'walk', startFrame: 0, endFrame: 60 })
    doc = addClip(doc, { targetId, presetId: 'path-forward', startFrame: 0, endFrame: 60, amount: 2 })
    expect(sampleDirectorFrame(doc, 17).objects[0].poseControls?.['leftHip.pitch']).not.toBe(0)
    expect(sampleDirectorFrame(doc, 100).objects[0].position).toEqual([0, 0, 2])
    expect(sampleDirectorFrame(doc, 100).objects[0].poseControls).toBeUndefined()
  })

  it('adds non-overlapping movement clips cumulatively', () => {
    let doc = createDirectorDocument()
    const targetId = doc.objects[0].id
    doc = addClip(doc, { targetId, presetId: 'path-forward', startFrame: 0, endFrame: 30, amount: 1 })
    doc = addClip(doc, { targetId, presetId: 'path-forward', startFrame: 30, endFrame: 60, amount: 2 })
    expect(sampleDirectorFrame(doc, 60).objects[0].position).toEqual([0, 0, 3])
  })

  it('retains the seated pose after the transition', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.objects[0].id, presetId: 'sit', startFrame: 0, endFrame: 60 })
    expect(sampleDirectorFrame(doc, 90).objects[0].poseControls).toMatchObject({ 'leftHip.pitch': 90, 'body.offsetY': -0.48 })
  })

  it('looped path repeats at the explicit two-second period', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.objects[0].id, presetId: 'path-circle', startFrame: 0, endFrame: 150, loop: true })
    expect(sampleDirectorFrame(doc, 15).objects[0].position).toEqual(sampleDirectorFrame(doc, 75).objects[0].position)
  })

  it('holds a partial loop endpoint instead of jumping to a complete cycle', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.objects[0].id, presetId: 'path-circle', startFrame: 0, endFrame: 90, loop: true })
    const end = sampleDirectorFrame(doc, 90).objects[0].position
    expect(end[0]).toBeCloseTo(2)
    expect(end[2]).toBeCloseTo(0)
    expect(sampleDirectorFrame(doc, 120).objects[0].position).toEqual(end)
    const previous = sampleDirectorFrame(doc, 89).objects[0].position
    expect(Math.hypot(...previous.map((value, index) => value - end[index]))).toBeLessThan(0.11)
  })
})

describe('procedural camera moves', () => {
  it.each(DIRECTOR_MOTION_CATALOG)('$id has a real sampled effect', ({ id }) => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.activeCameraId, presetId: id, startFrame: 0, endFrame: 90 })
    expect(sampleDirectorFrame(doc, 17).cameras[0]).not.toEqual(doc.cameras[0])
  })

  it('push never crosses the target and orbit retains target distance', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.activeCameraId, presetId: 'push', startFrame: 0, endFrame: 30, amount: 10 })
    const pushed = sampleDirectorFrame(doc, 30).cameras[0]
    expect(Math.hypot(...pushed.position.map((v, i) => v - pushed.target[i]))).toBeCloseTo(0.15)
    doc = removeClip(doc, doc.clips[0].id)
    doc = addClip(doc, { targetId: doc.activeCameraId, presetId: 'orbit', startFrame: 0, endFrame: 30 })
    const orbited = sampleDirectorFrame(doc, 15).cameras[0]
    const distance = (p: number[], target: number[]) => Math.hypot(...p.map((v, i) => v - target[i]))
    expect(distance(orbited.position, orbited.target)).toBeCloseTo(distance(doc.camera.position, doc.camera.target))
  })

  it('negative pull also stops before crossing its look-at target', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.activeCameraId, presetId: 'pull', startFrame: 0, endFrame: 30, amount: -10 })
    const pulled = sampleDirectorFrame(doc, 30).cameras[0]
    const originalDirection = doc.camera.position.map((value, i) => value - doc.camera.target[i])
    const actualDirection = pulled.position.map((value, i) => value - pulled.target[i])
    expect(Math.hypot(...actualDirection)).toBeCloseTo(0.15)
    expect(actualDirection.reduce((dot, value, i) => dot + value * originalDirection[i], 0)).toBeGreaterThan(0)
  })

  it('resolves look-at after animated object movement', () => {
    let doc = createDirectorDocument()
    doc.cameras[0].lookAtObjectId = doc.objects[0].id
    doc = addClip(doc, { targetId: doc.objects[0].id, presetId: 'path-forward', startFrame: 0, endFrame: 60, amount: 4 })
    const frame = sampleDirectorFrame(doc, 30)
    expect(frame.camera.target).toEqual([0, 0.95, 2])
  })

  it('can truck a perfectly vertical top-down camera without a zero direction', () => {
    let doc = addCamera(createDirectorDocument(), 'topDownFull')
    doc = addClip(doc, { targetId: doc.activeCameraId, presetId: 'truck', startFrame: 0, endFrame: 60, amount: 2 })
    expect(sampleDirectorFrame(doc, 60).camera.position).toEqual([2, 4.5, 0])
  })

  it('locked entities keep animation but reject deleting their keys and clips', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.activeCameraId, presetId: 'push', startFrame: 0, endFrame: 60 })
    doc = upsertKeyframe(doc, { targetId: doc.activeCameraId, channel: 'roll', frame: 0, value: 0.3 })
    doc.cameras[0].locked = true
    expect(removeClip(doc, doc.clips[0].id)).toBe(doc)
    expect(removeKeyframe(doc, doc.keyframes[0].id)).toBe(doc)
    expect(sampleDirectorFrame(doc, 30).camera.position).not.toEqual(doc.camera.position)
  })
})
