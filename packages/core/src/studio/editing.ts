import { sampleDirectorFrame, upsertKeyframe } from './animation'
import type { DirectorDocument, StageCamera, StageChannel, StageObject } from './model'

const CLIP_CHANNELS: Record<string, readonly StageChannel[]> = {
  'path-forward': ['position'], 'path-side': ['position'], 'path-circle': ['position', 'rotation'], turn: ['rotation'],
  push: ['position'], pull: ['position'], orbit: ['position'], pan: ['target'],
  rise: ['position', 'target'], fall: ['position', 'target'], truck: ['position', 'target'],
  'zoom-in': ['focalLength'], 'zoom-out': ['focalLength'], crane: ['position'], roll: ['roll'], handheld: ['position'],
}

/** Applies an inspector/gizmo commit without baking sampled motion into the authored base.
 * @param document Authored history document.
 * @param sampled Current render document.
 * @param id Entity to edit.
 * @param patch Completed field values (pose controls must come from the authored pose).
 * @param frame Current frame.
 * @returns Updated document and whether a preset channel was explicitly overridden by keys.
 * @throws Never for normalized documents.
 */
export function applyEntityPatch(document: DirectorDocument, sampled: DirectorDocument, id: string, patch: Partial<StageObject & StageCamera>, frame: number) {
  const entity = [...document.objects, ...document.cameras].find((item) => item.id === id)
  const rendered = [...sampled.objects, ...sampled.cameras].find((item) => item.id === id)
  if (!entity || !rendered || (entity.locked && patch.locked !== false)) return { document, overridesClip: false }
  let next = document
  const basePatch = { ...patch }
  let overridesClip = false
  for (const channel of ['position', 'rotation', 'scale', 'target', 'focalLength', 'roll'] as StageChannel[]) {
    const value = patch[channel]
    if (value === undefined) continue
    const currentValue = (rendered as unknown as Record<string, unknown>)[channel]
    if (JSON.stringify(currentValue) === JSON.stringify(value)) { delete basePatch[channel]; continue }
    const keyed = document.keyframes.some((key) => key.targetId === id && key.channel === channel)
    const clipped = document.clips.some((clip) => clip.targetId === id && CLIP_CHANNELS[clip.presetId]?.includes(channel))
    if (!keyed && !clipped) continue
    delete basePatch[channel]
    if (!keyed && clipped) {
      const first = sampleDirectorFrame(document, 0)
      const initial = [...first.objects, ...first.cameras].find((item) => item.id === id)!
      const initialValue = (initial as unknown as Record<string, unknown>)[channel] as typeof value
      if (frame > 0) next = upsertKeyframe(next, { targetId: id, channel, frame: 0, value: initialValue, interpolation: 'linear' })
      overridesClip = true
    }
    next = upsertKeyframe(next, { targetId: id, channel, frame, value })
  }
  return { document: { ...next,
    objects: next.objects.map((object) => object.id === id ? { ...object, ...basePatch } : object),
    cameras: next.cameras.map((camera) => camera.id === id ? { ...camera, ...basePatch } : camera),
  }, overridesClip }
}
