import { describe, expect, it } from 'vitest'
import { createDefaultDirectorScene, normalizeDirectorScene } from '../scene/director-scene'
import { createDirectorDocument, normalizeDirectorDocument, getActiveCamera, syncActiveCamera, addCamera, removeEntity, duplicateEntity, createStageObject } from './model'
import { addClip, upsertKeyframe } from './animation'
import { DIRECTOR_PROP_CATALOG, DIRECTOR_CAMERA_PRESETS } from './catalog'

describe('director v2 migration', () => {
  it('preserves every v1 authored field including fractional focal length and pose controls', () => {
    const legacy = createDefaultDirectorScene()
    legacy.camera = { position: [-2, 4.2, 6.1], target: [0.3, 0.6, -0.2] }
    legacy.focalLength = 45.7
    legacy.objects[0].name = '已命名角色'
    legacy.objects[0].pose = 'crossArms'
    legacy.objects[0].poseControls = { 'head.yaw': 22, 'body.offsetY': -0.4 }
    const migrated = normalizeDirectorDocument(legacy)
    expect(migrated).toMatchObject({ ...legacy, version: 2 })
    expect(migrated.cameras).toHaveLength(1)
    expect(getActiveCamera(migrated)).toMatchObject({ ...legacy.camera, focalLength: 45.7 })
    expect(normalizeDirectorDocument(migrated)).toEqual(migrated)
  })

  it('gives legacy empty names stable defaults without changing composition or pose', () => {
    const legacy = createDefaultDirectorScene()
    const result = normalizeDirectorDocument({ ...legacy, objects: [
      legacy.objects[0],
      { ...legacy.objects[0], id: 'obj_2', name: '  \t ', pose: 'sit' },
      { ...legacy.objects[0], id: 'obj_3', name: '  保留用户名称  ' },
      { id: 'obj_4', kind: 'box', name: '', position: [2, 0, 1] },
      { id: 'obj_5', kind: 'box', propId: 'chair', name: ' ' },
    ], cameras: [{ id: 'camera_1', name: ' ' }] })
    expect(result.objects.map((object) => object.name)).toEqual(['角色 1', '角色 2', '  保留用户名称  ', '道具 1', '木椅'])
    expect(result.cameras[0].name).toBe('机位 1')
    expect(result.objects[0]).toMatchObject({ position: legacy.objects[0].position, rotation: legacy.objects[0].rotation, pose: legacy.objects[0].pose })
    expect(result.objects[1].pose).toBe('sit')
    expect(result.camera).toEqual(legacy.camera)
    expect(result.focalLength).toBe(legacy.focalLength)
    expect(normalizeDirectorDocument(result)).toEqual(result)
  })

  it('round-trips every v2 field with props, animation, camera metadata and 3:4 ratio', () => {
    let doc = addCamera(createDirectorDocument(), 'dutchAngle')
    const prop = createStageObject(doc, 'box', 'sofa')
    doc = { ...doc, objects: [...doc.objects, { ...prop, visible: false, locked: true, colorIndex: 4 }], ratio: '3:4', showGrid: false, showLabels: false }
    doc.cameras[1].lookAtObjectId = doc.objects[0].id
    doc = addClip(doc, { targetId: doc.cameras[1].id, presetId: 'orbit', startFrame: 10, endFrame: 120 })
    doc = upsertKeyframe(doc, { targetId: doc.objects[0].id, channel: 'position', frame: 25, value: [1, 2, 3], interpolation: 'ease' })
    expect(normalizeDirectorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
    expect(normalizeDirectorScene(doc).ratio).toBe('3:4')
  })

  it('refuses a future schema instead of destroying it', () => {
    expect(() => normalizeDirectorDocument({ version: 3 })).toThrow('DIRECTOR_FUTURE_VERSION')
  })

  it.each([undefined, null, [], 42, 'invalid'])('creates safe default from %s', (raw) => {
    const doc = normalizeDirectorDocument(raw)
    expect(doc).toEqual(createDirectorDocument())
  })

  it('deduplicates IDs globally while retaining each duplicate object metadata', () => {
    const base = createDirectorDocument()
    const doc = normalizeDirectorDocument({ ...base, objects: [base.objects[0], { ...base.objects[0], visible: false, propId: 'cube', colorIndex: 5 }], cameras: [{ ...base.cameras[0], id: 'obj_1' }] })
    const ids = [...doc.objects, ...doc.cameras].map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(doc.objects[1]).toMatchObject({ visible: false, colorIndex: 5, propId: 'cube' })
    expect(normalizeDirectorDocument(doc)).toEqual(doc)
  })

  it('filters unknown geometry, invalid channels, dangling references and unsupported clips', () => {
    const base = createDirectorDocument()
    const doc = normalizeDirectorDocument({ ...base, objects: [{ id: 'invalid', kind: 'unknown' }, { ...base.objects[0], visible: false }], cameras: [{ ...base.cameras[0], lookAtObjectId: 'missing' }], keyframes: [
      { id: 'key_1', targetId: 'missing', channel: 'position', frame: 0, value: [0, 0, 0] },
      { id: 'key_2', targetId: base.objects[0].id, channel: 'focalLength', frame: 0, value: 35 },
      { id: 'key_3', targetId: base.cameras[0].id, channel: 'rotation', frame: 0, value: [0, 0, 0] },
    ], clips: [{ targetId: base.objects[0].id, presetId: 'orbit' }] })
    expect(doc.objects).toHaveLength(1)
    expect(doc.objects[0].visible).toBe(false)
    expect(doc.cameras[0].lookAtObjectId).toBeUndefined()
    expect(doc.keyframes).toEqual([])
    expect(doc.clips).toEqual([])
  })

  it('clamps finite numbers and drops malformed keyframe values', () => {
    const base = createDirectorDocument()
    const doc = normalizeDirectorDocument({ ...base, duration: 999, cameras: [{ ...base.cameras[0], focalLength: Infinity, position: [NaN, 999999, -999999], roll: 999 }], objects: [{ ...base.objects[0], position: [Infinity, -Infinity, NaN], scale: [0, -9, 999] }], keyframes: [
      { targetId: base.objects[0].id, channel: 'position', frame: 0, value: [Infinity, 2, 3] },
      { targetId: base.objects[0].id, channel: 'scale', frame: 9999, value: [-1, 0, 999] },
    ] })
    expect(doc.duration).toBe(30)
    expect(doc.cameras[0].position).toEqual([base.camera.position[0], 10000, -10000])
    expect(doc.objects[0].position).toEqual([0, 0, 0])
    expect(doc.objects[0].scale).toEqual([1, 9, 100])
    expect(doc.keyframes).toHaveLength(1)
    expect(doc.keyframes[0]).toMatchObject({ frame: 900, value: [0.05, 0.05, 100] })
  })

  it('ignores the stale legacy projection when v2 cameras exist', () => {
    const doc = createDirectorDocument()
    const updated = normalizeDirectorDocument({ ...doc, camera: { position: [99, 99, 99], target: [99, 99, 99] }, focalLength: 200 })
    expect(updated.camera).toEqual(doc.camera)
    expect(updated.focalLength).toBe(doc.focalLength)
  })
})

describe('director entities and library', () => {
  it('provides 36 unique geometry-backed props and 15 camera presets', () => {
    expect(DIRECTOR_PROP_CATALOG.length).toBeGreaterThanOrEqual(30)
    expect(new Set(DIRECTOR_PROP_CATALOG.map((prop) => prop.id)).size).toBe(DIRECTOR_PROP_CATALOG.length)
    for (const prop of DIRECTOR_PROP_CATALOG) {
      expect(prop.parts.length).toBeGreaterThan(0)
      for (const part of prop.parts) expect(part.scale.every((value) => Number.isFinite(value) && value > 0)).toBe(true)
    }
    expect(DIRECTOR_CAMERA_PRESETS).toHaveLength(15)
  })

  it('makes independent cameras and keeps the last one', () => {
    const base = createDirectorDocument()
    expect(removeEntity(base, base.activeCameraId)).toBe(base)
    const doc = addCamera(base, 'frontClose')
    expect(doc.cameras).toHaveLength(2)
    expect(doc.focalLength).toBe(55)
    expect(doc.activeCameraId).not.toBe(base.activeCameraId)
    const removed = removeEntity(doc, doc.activeCameraId)
    expect(removed.cameras).toHaveLength(1)
    expect(removed.activeCameraId).toBe(base.activeCameraId)
    expect(syncActiveCamera(removed).camera).toEqual(base.camera)
  })

  it('removes animation and look-at references with an object', () => {
    let doc = createDirectorDocument()
    const id = doc.objects[0].id
    doc.cameras[0].lookAtObjectId = id
    doc = addClip(doc, { targetId: id, presetId: 'walk', startFrame: 0, endFrame: 60 })
    doc = upsertKeyframe(doc, { targetId: id, channel: 'position', frame: 0, value: [0, 0, 0] })
    const result = removeEntity(doc, id)
    expect(result.objects).toEqual([])
    expect(result.keyframes).toEqual([])
    expect(result.clips).toEqual([])
    expect(result.cameras[0].lookAtObjectId).toBeUndefined()
  })

  it('duplicates geometry, keys and clips with independent references', () => {
    let doc = createDirectorDocument()
    doc = addClip(doc, { targetId: doc.objects[0].id, presetId: 'wave', startFrame: 0, endFrame: 60 })
    doc = upsertKeyframe(doc, { targetId: doc.objects[0].id, channel: 'position', frame: 0, value: [1, 0, 0] })
    const result = duplicateEntity(doc, doc.objects[0].id)
    expect(result.objects).toHaveLength(2)
    expect(result.clips[1].targetId).toBe(result.objects[1].id)
    expect(result.keyframes[1].targetId).toBe(result.objects[1].id)
    result.objects[1].position[0] = 9
    expect(result.objects[0].position[0]).toBe(0)
  })

  it('respects locked entity edits and deletion', () => {
    const doc = createDirectorDocument()
    doc.objects[0].locked = true
    expect(removeEntity(doc, doc.objects[0].id)).toBe(doc)
    expect(duplicateEntity(doc, doc.objects[0].id)).toBe(doc)
    expect(addClip(doc, { targetId: doc.objects[0].id, presetId: 'walk', startFrame: 0, endFrame: 30 })).toBe(doc)
  })
})
