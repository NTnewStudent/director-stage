/** Versioned, renderer-independent studio document. @see docs/api-contracts/client/director-stage.md#ENT_DIRECTOR_DOCUMENT */
import {
  createDefaultDirectorScene, normalizeDirectorScene,
  type DirectorScene, type DirectorObject, type DirectorObjectKind, type Vec3,
} from '../scene/director-scene'
import { DIRECTOR_CAMERA_PRESETS, type DirectorCameraPresetKey } from '../scene/director-camera-presets'
import { DIRECTOR_PROP_CATALOG, DIRECTOR_ACTION_CATALOG, DIRECTOR_MOTION_CATALOG } from './catalog'
import { normalizeCharacterColor } from './character-color'
import { defaultCameraName, defaultCopyName, defaultObjectName } from './labels'

/** A legacy-compatible object plus editor metadata. */
export interface StageObject extends DirectorObject {
  visible: boolean
  locked: boolean
  colorIndex: number
  /** Optional user-authored mannequin material color; not a UI design token. */
  color?: string
  propId?: string
}

/** A persisted output camera; the editor navigation camera is deliberately separate. */
export interface StageCamera {
  id: string
  name: string
  position: Vec3
  target: Vec3
  focalLength: number
  roll: number
  visible: boolean
  locked: boolean
  lookAtObjectId?: string
}

/** Numeric channels supported by the deterministic sampler. */
export type StageChannel = 'position' | 'rotation' | 'scale' | 'target' | 'focalLength' | 'roll'
/** Interpolation from this keyframe to the next. */
export type StageInterpolation = 'linear' | 'hold' | 'ease'
/** One property key at an integer timeline frame. */
export interface StageKeyframe {
  id: string
  targetId: string
  channel: StageChannel
  frame: number
  value: number | Vec3
  interpolation: StageInterpolation
}
/** A procedural action, path, or camera motion evaluated relative to the authored base. */
export interface StageClip {
  id: string
  targetId: string
  presetId: string
  startFrame: number
  endFrame: number
  amount: number
  loop: boolean
}
/** Scene v2 preserves the v1 camera projection for existing canvas consumers. */
export interface DirectorDocument extends Omit<DirectorScene, 'objects'> {
  version: 2
  objects: StageObject[]
  cameras: StageCamera[]
  activeCameraId: string
  duration: number
  fps: 30
  keyframes: StageKeyframe[]
  clips: StageClip[]
  showGrid: boolean
  showLabels: boolean
}

const CHANNELS: StageChannel[] = ['position', 'rotation', 'scale', 'target', 'focalLength', 'roll']
const INTERPOLATIONS: StageInterpolation[] = ['linear', 'hold', 'ease']
const rec = (raw: unknown): Record<string, unknown> => raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
const list = (raw: unknown): unknown[] => Array.isArray(raw) ? raw : []
const finite = (raw: unknown, fallback: number, min: number, max: number) => typeof raw === 'number' && Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : fallback
const vector = (raw: unknown, fallback: Vec3, min = -10000, max = 10000): Vec3 => [0, 1, 2].map((i) => finite(list(raw)[i], fallback[i], min, max)) as Vec3
const label = (raw: unknown, fallback: string) => typeof raw === 'string' && raw.trim() ? raw.slice(0, 200) : fallback

/** Allocate a collision-free ID without global counters. @param used Existing IDs. @param prefix Namespace. @returns Fresh ID. @throws Never. */
export function nextStageId(used: Iterable<string>, prefix = 'obj'): string {
  const ids = new Set(used)
  let index = 1
  while (ids.has(`${prefix}_${index}`)) index += 1
  return `${prefix}_${index}`
}

function uniqueId(raw: unknown, ids: Set<string>, prefix: string): string {
  const requested = typeof raw === 'string' && raw.length ? raw : ''
  const id = requested && !ids.has(requested) ? requested : nextStageId(ids, prefix)
  ids.add(id)
  return id
}

/** Return the current output camera (documents always contain one). @param doc Normalized document. @returns Camera. @throws Never for normalized input. */
export function getActiveCamera(doc: DirectorDocument): StageCamera {
  return doc.cameras.find((camera) => camera.id === doc.activeCameraId) ?? doc.cameras[0]
}

/** Rebuild the legacy projection from its sole source, the selected camera. @param doc Document. @returns New document. @throws Never for normalized input. */
export function syncActiveCamera(doc: DirectorDocument): DirectorDocument {
  const active = getActiveCamera(doc)
  return { ...doc, activeCameraId: active.id, camera: { position: [...active.position], target: [...active.target] }, focalLength: active.focalLength }
}

/** Migrate and validate untrusted graph JSON without changing legacy lens composition.
 * @param raw Graph scene data; v1, v2, or absent.
 * @returns A detached valid v2 document.
 * @throws Error for future versions, preventing destructive silent downgrade.
 * @see docs/api-contracts/client/director-stage.md#ENT_DIRECTOR_DOCUMENT
 */
export function normalizeDirectorDocument(raw: unknown): DirectorDocument {
  const source = rec(raw)
  if (typeof source.version === 'number' && source.version > 2) {
    // ERR_DIRECTOR_FUTURE_VERSION: a newer schema must never be rewritten by this client.
    throw new Error('DIRECTOR_FUTURE_VERSION')
  }
  const legacy = normalizeDirectorScene(raw)
  const rawObjects = list(source.objects).filter((entry) => ['mannequin', 'box', 'cylinder', 'plane'].includes(String(rec(entry).kind)))
  const ids = new Set<string>()
  let characterCount = 0
  let propCount = 0
  const objects = legacy.objects.map((object, index): StageObject => {
    const original = rec(rawObjects[index])
    const prop = DIRECTOR_PROP_CATALOG.find((entry) => entry.id === original.propId)
    if (object.kind === 'mannequin') characterCount += 1
    else propCount += 1
    const fallbackName = defaultObjectName(object.kind, object.kind === 'mannequin' ? characterCount : propCount, prop?.id)
    const color = object.kind === 'mannequin' ? normalizeCharacterColor(original.color) : undefined
    return {
      ...object, id: uniqueId(object.id, ids, 'obj'),
      name: object.name.trim() ? object.name : fallbackName,
      position: vector(object.position, [0, 0, 0]), rotation: vector(object.rotation, [0, 0, 0], -Math.PI * 100, Math.PI * 100),
      visible: original.visible !== false, locked: original.locked === true,
      colorIndex: Math.round(finite(original.colorIndex, index % 6, 0, 5)),
      ...(color ? { color } : {}),
      ...(prop ? { propId: prop.id } : {}),
    }
  })
  const cameras = list(source.cameras).map((item, index): StageCamera => {
    const camera = rec(item)
    return {
      id: uniqueId(camera.id, ids, 'camera'), name: label(camera.name, defaultCameraName(index + 1)),
      position: vector(camera.position, legacy.camera.position), target: vector(camera.target, legacy.camera.target),
      focalLength: finite(camera.focalLength, legacy.focalLength, 14, 200), roll: finite(camera.roll, 0, -Math.PI * 2, Math.PI * 2),
      visible: camera.visible !== false, locked: camera.locked === true,
      ...(typeof camera.lookAtObjectId === 'string' && objects.some((object) => object.id === camera.lookAtObjectId) ? { lookAtObjectId: camera.lookAtObjectId } : {}),
    }
  })
  if (!cameras.length) cameras.push({
    id: uniqueId('camera_1', ids, 'camera'), name: defaultCameraName(1),
    position: [...legacy.camera.position], target: [...legacy.camera.target],
    // Use the original finite focal value, not the legacy normalizer's rounding.
    focalLength: finite(source.focalLength, legacy.focalLength, 14, 200), roll: 0, visible: true, locked: false,
  })
  const duration = finite(source.duration, 5, 1, 30)
  const lastFrame = Math.round(duration * 30)
  const cameraIds = new Set(cameras.map((camera) => camera.id))
  const objectIds = new Set(objects.map((object) => object.id))
  const keySlots = new Map<string, StageKeyframe>()
  for (const item of list(source.keyframes)) {
    const key = rec(item)
    if (typeof key.targetId !== 'string' || (!cameraIds.has(key.targetId) && !objectIds.has(key.targetId)) || !CHANNELS.includes(key.channel as StageChannel)) continue
    const channel = key.channel as StageChannel
    if (cameraIds.has(key.targetId) ? ['rotation', 'scale'].includes(channel) : ['target', 'focalLength', 'roll'].includes(channel)) continue
    const scalar = channel === 'focalLength' || channel === 'roll'
    if (scalar ? typeof key.value !== 'number' || !Number.isFinite(key.value) : !Array.isArray(key.value) || key.value.length !== 3 || !key.value.every((v) => typeof v === 'number' && Number.isFinite(v))) continue
    const frame = Math.round(finite(key.frame, 0, 0, lastFrame))
    const value = scalar ? finite(key.value, 0, channel === 'focalLength' ? 14 : -Math.PI * 2, channel === 'focalLength' ? 200 : Math.PI * 2) : vector(key.value, [0, 0, 0], channel === 'scale' ? 0.05 : -10000, channel === 'scale' ? 100 : 10000)
    keySlots.set(`${key.targetId}:${channel}:${frame}`, { id: uniqueId(key.id, ids, 'key'), targetId: key.targetId, channel, frame, value, interpolation: INTERPOLATIONS.includes(key.interpolation as StageInterpolation) ? key.interpolation as StageInterpolation : 'linear' })
  }
  const clips: StageClip[] = []
  for (const item of list(source.clips)) {
    const clip = rec(item)
    if (typeof clip.targetId !== 'string' || typeof clip.presetId !== 'string') continue
    const catalog = cameraIds.has(clip.targetId) ? DIRECTOR_MOTION_CATALOG : objectIds.has(clip.targetId) && objects.find((o) => o.id === clip.targetId)?.kind === 'mannequin' ? DIRECTOR_ACTION_CATALOG : []
    if (!catalog.some((preset) => preset.id === clip.presetId)) continue
    const startFrame = Math.round(finite(clip.startFrame, 0, 0, lastFrame - 1))
    clips.push({ id: uniqueId(clip.id, ids, 'clip'), targetId: clip.targetId, presetId: clip.presetId, startFrame, endFrame: Math.round(finite(clip.endFrame, Math.min(startFrame + 60, lastFrame), startFrame + 1, lastFrame)), amount: finite(clip.amount, 1, -10, 10), loop: clip.loop === true })
  }
  return syncActiveCamera({ ...legacy, version: 2, objects, cameras, activeCameraId: typeof source.activeCameraId === 'string' && cameraIds.has(source.activeCameraId) ? source.activeCameraId : cameras[0].id, duration, fps: 30, keyframes: [...keySlots.values()].sort((a, b) => a.frame - b.frame), clips, showGrid: source.showGrid !== false, showLabels: source.showLabels !== false })
}

/** Create the default standalone studio document. @returns Fresh v2 scene. @throws Never. */
export function createDirectorDocument(): DirectorDocument {
  return normalizeDirectorDocument(createDefaultDirectorScene())
}

/** Create an unattached object ready to append to a document. @param doc Current document. @param kind Legacy object kind. @param propId Optional procedural model. @returns New object. @throws Never. */
export function createStageObject(doc: DirectorDocument, kind: DirectorObjectKind, propId?: string): StageObject {
  const prop = DIRECTOR_PROP_CATALOG.find((entry) => entry.id === propId)
  const id = nextStageId([...doc.objects, ...doc.cameras].map((entry) => entry.id))
  return { id, kind, name: defaultObjectName(kind, kind === 'mannequin' ? doc.objects.filter((o) => o.kind === 'mannequin').length + 1 : doc.objects.filter((o) => o.kind !== 'mannequin').length + 1, propId), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false, colorIndex: doc.objects.length % 6, ...(prop ? { propId: prop.id } : {}), ...(kind === 'mannequin' ? { build: 'standard' as const, pose: 'stand' as const } : {}) }
}

/** Append and activate an independently editable camera. @param doc Document. @param presetKey Existing preset key. @param camera Optional current-view coordinates. @returns New document. @throws Never for normalized input. */
export function addCamera(doc: DirectorDocument, presetKey: DirectorCameraPresetKey = 'current', camera?: Partial<StageCamera>): DirectorDocument {
  const preset = DIRECTOR_CAMERA_PRESETS.find((entry) => entry.key === presetKey) ?? DIRECTOR_CAMERA_PRESETS[0]
  const id = nextStageId([...doc.objects, ...doc.cameras].map((entry) => entry.id), 'camera')
  const next: StageCamera = { id, name: defaultCameraName(doc.cameras.length + 1, presetKey, doc.cameras.map((item) => item.name)), position: [...preset.position], target: [...preset.target], focalLength: preset.focalLength, roll: presetKey === 'dutchAngle' ? Math.PI / 12 : 0, visible: true, locked: false, ...camera }
  return normalizeDirectorDocument({ ...doc, cameras: [...doc.cameras, { ...next, id }], activeCameraId: id })
}

/** Remove an unlocked entity and dependent animation/target references; retain the last camera. @param doc Document. @param id Entity ID. @returns Updated document or unchanged input. @throws Never for normalized input. */
export function removeEntity(doc: DirectorDocument, id: string): DirectorDocument {
  const entity = [...doc.objects, ...doc.cameras].find((entry) => entry.id === id)
  if (!entity || entity.locked || (doc.cameras.some((c) => c.id === id) && doc.cameras.length === 1)) return doc
  return normalizeDirectorDocument({ ...doc, objects: doc.objects.filter((o) => o.id !== id), cameras: doc.cameras.filter((c) => c.id !== id).map((c) => c.lookAtObjectId === id ? { ...c, lookAtObjectId: undefined } : c), keyframes: doc.keyframes.filter((key) => key.targetId !== id), clips: doc.clips.filter((clip) => clip.targetId !== id) })
}

/** Duplicate entity geometry and animation into independent IDs. @param doc Document. @param id Source ID. @returns Updated document; duplicate is last in its list. @throws Never for normalized input. */
export function duplicateEntity(doc: DirectorDocument, id: string): DirectorDocument {
  const object = doc.objects.find((entry) => entry.id === id)
  const camera = doc.cameras.find((entry) => entry.id === id)
  const source = object ?? camera
  if (!source || source.locked) return doc
  const duplicateId = nextStageId([...doc.objects, ...doc.cameras].map((entry) => entry.id), object ? 'obj' : 'camera')
  const duplicate = { ...source, id: duplicateId, name: defaultCopyName(source.name) }
  return normalizeDirectorDocument({ ...doc, objects: object ? [...doc.objects, duplicate] : doc.objects, cameras: camera ? [...doc.cameras, duplicate] : doc.cameras, activeCameraId: camera ? duplicateId : doc.activeCameraId, keyframes: [...doc.keyframes, ...doc.keyframes.filter((key) => key.targetId === id).map((key) => ({ ...key, id: '', targetId: duplicateId }))], clips: [...doc.clips, ...doc.clips.filter((clip) => clip.targetId === id).map((clip) => ({ ...clip, id: '', targetId: duplicateId }))] })
}
