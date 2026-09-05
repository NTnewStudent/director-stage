/** Deterministic frame sampling. Clips add relative motion; authored keys override channels; tracking resolves last. */
import { normalizePoseControls, type PoseControlValues, type Vec3 } from '../scene/director-scene'
import { normalizeDirectorDocument, syncActiveCamera, nextStageId, type DirectorDocument, type StageCamera, type StageObject, type StageClip, type StageKeyframe } from './model'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const smooth = (value: number) => value * value * (3 - 2 * value)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, scalar: number): Vec3 => [a[0] * scalar, a[1] * scalar, a[2] * scalar]
const rotateY = (a: Vec3, angle: number): Vec3 => [a[0] * Math.cos(angle) + a[2] * Math.sin(angle), a[1], a[2] * Math.cos(angle) - a[0] * Math.sin(angle)]

function sampleKeys(keys: StageKeyframe[], frame: number): number | Vec3 {
  const sorted = [...keys].sort((a, b) => a.frame - b.frame)
  if (frame <= sorted[0].frame) return sorted[0].value
  const nextIndex = sorted.findIndex((key) => key.frame > frame)
  if (nextIndex < 0) return sorted[sorted.length - 1].value
  const left = sorted[nextIndex - 1]
  const right = sorted[nextIndex]
  const progress = (frame - left.frame) / (right.frame - left.frame)
  const t = left.interpolation === 'hold' ? 0 : left.interpolation === 'ease' ? smooth(progress) : progress
  return typeof left.value === 'number' && typeof right.value === 'number'
    ? lerp(left.value, right.value, t)
    : (left.value as Vec3).map((value, i) => lerp(value, (right.value as Vec3)[i], t)) as Vec3
}

function applyCameraClip(camera: StageCamera, clip: StageClip, t: number, elapsed: number): void {
  const amount = clip.amount * t
  const delta: Vec3 = [camera.target[0] - camera.position[0], camera.target[1] - camera.position[1], camera.target[2] - camera.position[2]]
  const distance = Math.hypot(...delta)
  const forward: Vec3 = distance > 0.0001 ? scale(delta, 1 / distance) : [0, 0, -1]
  const horizontal = Math.hypot(forward[0], forward[2])
  const right: Vec3 = horizontal > 0.0001 ? [-forward[2] / horizontal, 0, forward[0] / horizontal] : [1, 0, 0]
  switch (clip.presetId) {
    case 'push':
    case 'pull': {
      const requested = clip.presetId === 'push' ? amount : -amount
      const offset = Math.min(requested, Math.max(0, distance - 0.15))
      camera.position = add(camera.position, scale(forward, offset))
      break
    }
    case 'orbit': camera.position = add(camera.target, rotateY(scale(delta, -1), amount * Math.PI / 2)); break
    case 'pan': camera.target = add(camera.position, rotateY(delta, amount * Math.PI / 4)); break
    case 'rise':
    case 'fall': {
      const offset: Vec3 = [0, amount * (clip.presetId === 'rise' ? 1 : -1), 0]
      camera.position = add(camera.position, offset)
      camera.target = add(camera.target, offset)
      break
    }
    case 'truck': camera.position = add(camera.position, scale(right, amount)); camera.target = add(camera.target, scale(right, amount)); break
    case 'zoom-in': camera.focalLength = clamp(camera.focalLength + amount * 30, 14, 200); break
    case 'zoom-out': camera.focalLength = clamp(camera.focalLength - amount * 30, 14, 200); break
    case 'crane': camera.position = add(add(camera.position, scale(forward, -amount)), [0, amount, 0]); break
    case 'roll': camera.roll += amount * Math.PI / 4; break
    case 'handheld': camera.position = add(camera.position, [Math.sin(elapsed * 3.7) * 0.025 * clip.amount, Math.sin(elapsed * 4.9) * 0.018 * clip.amount, Math.sin(elapsed * 2.3) * 0.015 * clip.amount]); break
  }
}

function applyObjectClip(object: StageObject, clip: StageClip, t: number, elapsed: number, active: boolean): void {
  const amount = clip.amount
  const angle = object.rotation[1]
  if (clip.presetId === 'path-forward' || clip.presetId === 'path-side') {
    const direction: Vec3 = clip.presetId === 'path-forward' ? [Math.sin(angle), 0, Math.cos(angle)] : [Math.cos(angle), 0, -Math.sin(angle)]
    object.position = add(object.position, scale(direction, amount * t))
    return
  }
  if (clip.presetId === 'path-circle') {
    const arc = t * Math.PI * 2
    object.position = add(object.position, rotateY([amount * (1 - Math.cos(arc)), 0, amount * Math.sin(arc)], angle))
    object.rotation = [object.rotation[0], angle + arc, object.rotation[2]]
    return
  }
  if (clip.presetId === 'turn') {
    object.rotation = [object.rotation[0], angle + t * Math.PI * amount, object.rotation[2]]
    return
  }
  // A sit is a transition into a held pose; cyclic actions stop when their clip ends.
  if (!active && clip.presetId !== 'sit') return
  const cycle = Math.sin(elapsed * Math.PI * 2 * (clip.presetId === 'run' ? 2.5 : 1.2))
  let controls: PoseControlValues = {}
  switch (clip.presetId) {
    case 'walk':
    case 'run': {
      const running = clip.presetId === 'run'
      const swing = cycle * (running ? 55 : 30) * amount
      controls = { 'leftHip.pitch': swing, 'rightHip.pitch': -swing, 'leftKnee.bend': Math.max(0, -cycle) * (running ? 95 : 40), 'rightKnee.bend': Math.max(0, cycle) * (running ? 95 : 40), 'leftShoulder.pitch': -swing * 0.8, 'rightShoulder.pitch': swing * 0.8, 'leftElbow.bend': running ? 85 : 15, 'rightElbow.bend': running ? 85 : 15, 'body.offsetY': Math.abs(cycle) * (running ? 0.1 : 0.025) }
      break
    }
    case 'wave': controls = { 'rightShoulder.spread': 120, 'rightElbow.bend': 45 + cycle * 30 * amount, 'rightShoulder.twist': cycle * 15 * amount }; break
    case 'sit': {
      const p = smooth(t)
      controls = { 'body.offsetY': -0.48 * p, 'leftHip.pitch': 90 * p, 'rightHip.pitch': 90 * p, 'leftKnee.bend': 90 * p, 'rightKnee.bend': 90 * p, 'torso.pitch': 5 * p }
      break
    }
    case 'nod': controls = { 'head.pitch': cycle * 18 * amount }; break
    case 'bow': controls = { 'body.pitch': Math.sin(t * Math.PI) * 50 * amount }; break
    case 'jump': controls = { 'body.offsetY': Math.sin(t * Math.PI) * 0.4 * amount, 'leftKnee.bend': Math.sin(t * Math.PI) * 25, 'rightKnee.bend': Math.sin(t * Math.PI) * 25 }; break
  }
  object.poseControls = normalizePoseControls({ ...object.poseControls, ...controls })
}

/** Sample a document at any frame without mutating it or accumulating frame-to-frame errors.
 * @param doc Normalized authored document, not a previously sampled output.
 * @param frame Absolute frame, clamped to duration; fractional frames are supported for rendering.
 * @returns Detached render scene. Movement clips retain their end state; explicit keys win per channel.
 * @throws Never for a normalized document.
 */
export function sampleDirectorFrame(doc: DirectorDocument, frame: number): DirectorDocument {
  const output = structuredClone(doc)
  const current = clamp(Number.isFinite(frame) ? frame : 0, 0, Math.round(doc.duration * doc.fps))
  const entities = new Map<string, StageObject | StageCamera>([...output.objects, ...output.cameras].map((entity) => [entity.id, entity]))
  for (const clip of [...doc.clips].sort((a, b) => a.startFrame - b.startFrame)) {
    if (current < clip.startFrame) continue
    const entity = entities.get(clip.targetId)
    if (!entity) continue
    const bounded = Math.min(current, clip.endFrame) - clip.startFrame
    const duration = Math.max(1, clip.endFrame - clip.startFrame)
    const period = Math.min(duration, doc.fps * 2)
    const loopFrame = bounded % period
    // A truncated loop holds its actual sampled endpoint instead of teleporting to a full cycle.
    const t = clip.loop ? (loopFrame === 0 && bounded > 0 ? 1 : loopFrame / period) : bounded / duration
    const elapsed = bounded / doc.fps
    if ('kind' in entity) applyObjectClip(entity, clip, t, elapsed, current <= clip.endFrame)
    else applyCameraClip(entity, clip, t, elapsed)
  }
  const tracks = new Map<string, StageKeyframe[]>()
  for (const key of doc.keyframes) {
    const trackId = `${key.targetId}:${key.channel}`
    tracks.set(trackId, [...(tracks.get(trackId) ?? []), key])
  }
  for (const keys of tracks.values()) {
    const entity = entities.get(keys[0].targetId)
    if (!entity) continue
    const channel = keys[0].channel
    const value = sampleKeys(keys, current)
    if (channel === 'position') entity.position = [...value as Vec3]
    else if ('kind' in entity) {
      if (channel === 'rotation') entity.rotation = [...value as Vec3]
      if (channel === 'scale') entity.scale = [...value as Vec3]
    } else {
      if (channel === 'target') entity.target = [...value as Vec3]
      if (channel === 'focalLength') entity.focalLength = value as number
      if (channel === 'roll') entity.roll = value as number
    }
  }
  for (const camera of output.cameras) {
    const target = camera.lookAtObjectId ? output.objects.find((object) => object.id === camera.lookAtObjectId) : undefined
    if (target) camera.target = add(target.position, [0, target.kind === 'mannequin' ? 0.95 * target.scale[1] : 0.5 * target.scale[1], 0])
  }
  return syncActiveCamera(output)
}

/** Add or replace one channel key at the same frame. @param doc Authored document. @param input Key properties. @returns Valid document; locked entities stay unchanged. @throws Never for normalized input. */
export function upsertKeyframe(doc: DirectorDocument, input: Omit<StageKeyframe, 'id' | 'interpolation'> & { interpolation?: StageKeyframe['interpolation'] }): DirectorDocument {
  const target = [...doc.objects, ...doc.cameras].find((entity) => entity.id === input.targetId)
  if (!target || target.locked) return doc
  const frame = Math.round(clamp(input.frame, 0, Math.round(doc.duration * doc.fps)))
  const existing = doc.keyframes.find((key) => key.targetId === input.targetId && key.channel === input.channel && key.frame === frame)
  const id = existing?.id ?? nextStageId(doc.keyframes.map((key) => key.id), 'key')
  return normalizeDirectorDocument({ ...doc, keyframes: [...doc.keyframes.filter((key) => key.id !== existing?.id), { ...input, id, frame, interpolation: input.interpolation ?? existing?.interpolation ?? 'linear' }] })
}

/** Delete one authored key unless its entity is locked. @param doc Document. @param id Key ID. @returns New document. @throws Never. */
export function removeKeyframe(doc: DirectorDocument, id: string): DirectorDocument {
  const key = doc.keyframes.find((entry) => entry.id === id)
  if (!key || [...doc.objects, ...doc.cameras].find((entity) => entity.id === key.targetId)?.locked) return doc
  return { ...doc, keyframes: doc.keyframes.filter((entry) => entry.id !== id) }
}

/** Append a validated procedural clip. @param doc Authored document. @param input Target, preset and interval. @returns New document; unsupported targets are ignored. @throws Never for normalized input. */
export function addClip(doc: DirectorDocument, input: Omit<StageClip, 'id' | 'amount' | 'loop'> & { amount?: number; loop?: boolean }): DirectorDocument {
  if ([...doc.objects, ...doc.cameras].find((entity) => entity.id === input.targetId)?.locked) return doc
  return normalizeDirectorDocument({ ...doc, clips: [...doc.clips, { ...input, id: nextStageId(doc.clips.map((clip) => clip.id), 'clip'), amount: input.amount ?? 1, loop: input.loop ?? false }] })
}

/** Delete a procedural clip unless its entity is locked. @param doc Document. @param id Clip ID. @returns New document. @throws Never. */
export function removeClip(doc: DirectorDocument, id: string): DirectorDocument {
  const clip = doc.clips.find((entry) => entry.id === id)
  if (!clip || [...doc.objects, ...doc.cameras].find((entity) => entity.id === clip.targetId)?.locked) return doc
  return { ...doc, clips: doc.clips.filter((entry) => entry.id !== id) }
}
