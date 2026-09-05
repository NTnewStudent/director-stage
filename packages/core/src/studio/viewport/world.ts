import * as THREE from 'three'
import type { DirectorDocument, StageCamera, StageObject } from '../model'
import { DIRECTOR_PROP_CATALOG, type PropPart } from '../catalog'
import { BUILD_WIDTH, resolvePose, type PoseSpec } from '../../scene/poses'
import { readObjectColors, objectColor } from '../../scene/object-colors'
import { resolveCharacterColor } from '../character-color'
import { ratioToAspect, type Vec3 } from '../../scene/director-scene'
import { focalToVerticalFov } from '../../scene/director-shot'

/** Token-derived renderer palette shared by viewport and clean output. */
export interface StagePalette {
  background: string
  grid: string
  foreground: string
  /** Neutral illumination stays bright in both UI themes; it is not a text color. */
  illumination: string
  accent: string
  objectColors: string[]
}

/** Read the active design tokens; no renderer-owned hardcoded colors. @param root Optional themed root; defaults to the director-stage host or documentElement. @returns Resolved palette. */
export function readStagePalette(root?: Element | null): StagePalette {
  const node = root ?? document.querySelector('[data-director-stage-theme]') ?? document.documentElement
  const style = getComputedStyle(node)
  const token = (key: string) => style.getPropertyValue(key).trim()
  return {
    background: token('--color-bg-base'), grid: token('--color-border-secondary'),
    foreground: token('--color-text-base'), illumination: token('--color-text-white'),
    accent: token('--color-brand'), objectColors: readObjectColors(),
  }
}

/** Build a filming camera using the established v1 focal-length convention. @param source Saved camera. @param aspect Output aspect. @returns Independent camera; does not mutate the document. */
export function createShotCamera(source: StageCamera, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(focalToVerticalFov(source.focalLength, aspect), aspect, 0.05, 500)
  // This detached output camera owns its matrices, independently of editor/global defaults.
  camera.matrixAutoUpdate = true
  camera.matrixWorldAutoUpdate = true
  camera.position.fromArray(source.position)
  camera.lookAt(new THREE.Vector3(...source.target))
  camera.rotateZ(source.roll)
  camera.updateMatrixWorld(true)
  return camera
}

/** Recover a filming camera from its gizmo transform. Rotation and roll use radians throughout. @param source Authored camera (provides aim distance). @param node Transformed helper. @param aspect Filming aspect. @returns Position, aim and optical-axis roll. @throws Never for finite normalized input. */
export function readCameraTransform(source: StageCamera, node: THREE.Object3D, aspect: number): Pick<StageCamera, 'position' | 'target' | 'roll'> {
  const position = node.position.toArray() as Vec3
  const distance = Math.max(0.001, new THREE.Vector3(...source.position).distanceTo(new THREE.Vector3(...source.target)))
  const target = new THREE.Vector3(0, 0, -1).applyQuaternion(node.quaternion).multiplyScalar(distance).add(node.position).toArray() as Vec3
  const noRoll = createShotCamera({ ...source, position, target, roll: 0 }, aspect)
  const relative = noRoll.quaternion.invert().multiply(node.quaternion)
  return { position, target, roll: new THREE.Euler().setFromQuaternion(relative).z }
}

/** Register a camera helper with instance-owned cleanup, so replaced helpers cannot unregister newer ones. @param registry Live helper map. @param id Camera ID. @param group Mounted helper. @returns Idempotent cleanup. @throws Never. */
export function registerCameraGroup(registry: Map<string, THREE.Group>, id: string, group: THREE.Group): () => void {
  registry.set(id, group)
  return () => { if (registry.get(id) === group) registry.delete(id) }
}

/** Dispose geometries, materials and owned textures exactly once. @param root Removed scene subtree. @returns Nothing. */
export function disposeTree(root: THREE.Object3D): void {
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>()
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
      resources.add(child.geometry)
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        resources.add(material)
        if ('map' in material && material.map instanceof THREE.Texture) resources.add(material.map)
      }
    }
  })
  resources.forEach((resource) => resource.dispose())
}

function addMesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: Vec3 = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.fromArray(position)
  parent.add(mesh)
  return mesh
}

function createCharacter(object: StageObject, material: THREE.Material) {
  const root = new THREE.Group()
  const joints = {} as Record<Exclude<keyof PoseSpec, 'rootY' | 'rootRotation'>, THREE.Group>
  const width = BUILD_WIDTH[object.build ?? 'standard'] ?? 1
  const hip = new THREE.Group()
  hip.position.y = 0.9
  root.add(hip)
  const joint = (parent: THREE.Object3D, name: keyof typeof joints, position: Vec3) => {
    const group = new THREE.Group()
    group.position.fromArray(position)
    parent.add(group)
    joints[name] = group
    return group
  }
  const limb = (parent: THREE.Object3D, length: number, radius: number) =>
    addMesh(parent, new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.01), 4, 10), material, [0, -length / 2, 0])
  const torso = joint(hip, 'torso', [0, 0, 0])
  torso.scale.set(width, 1, width)
  addMesh(torso, new THREE.CapsuleGeometry(0.15, 0.26, 4, 12), material, [0, 0.28, 0])
  const head = joint(torso, 'head', [0, 0.56, 0])
  addMesh(head, new THREE.CylinderGeometry(0.045, 0.05, 0.06, 10), material, [0, 0.03, 0])
  addMesh(head, new THREE.SphereGeometry(0.105, 18, 14), material, [0, 0.165, 0])
  addMesh(head, new THREE.ConeGeometry(0.022, 0.05, 10), material, [0, 0.165, 0.105 * 0.92])
  for (const side of ['Left', 'Right'] as const) {
    const sign = side === 'Left' ? 1 : -1
    const upperArm = joint(torso, `arm${side}Upper`, [sign * 0.19, 0.56 * 0.88, 0])
    limb(upperArm, 0.3, 0.05)
    limb(joint(upperArm, `arm${side}Lower`, [0, -0.3, 0]), 0.27, 0.05 * 0.88)
    const upperLeg = joint(hip, `leg${side}Upper`, [sign * 0.09 * width, 0, 0])
    limb(upperLeg, 0.44, 0.07 * width)
    limb(joint(upperLeg, `leg${side}Lower`, [0, -0.44, 0]), 0.42, 0.07 * 0.82 * width)
  }
  const update = (next: StageObject) => {
    const pose = resolvePose(next.pose ?? 'stand', next.poseControls)
    root.position.y = pose.rootY
    root.rotation.set(...pose.rootRotation)
    for (const key of Object.keys(joints) as Array<keyof typeof joints>) joints[key].rotation.set(...pose[key])
  }
  update(object)
  return { root, update }
}

function partGeometry(shape: PropPart['shape']) {
  if (shape === 'sphere') return new THREE.SphereGeometry(0.5, 20, 14)
  if (shape === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 24)
  if (shape === 'cone') return new THREE.ConeGeometry(0.5, 1, 24)
  return new THREE.BoxGeometry(1, 1, 1)
}

function createObject(object: StageObject, palette: StagePalette) {
  const group = new THREE.Group()
  group.userData.entityId = object.id
  const color = resolveCharacterColor(object, palette.objectColors) || palette.foreground
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 })
  let updatePose: ((next: StageObject) => void) | undefined
  if (object.kind === 'mannequin') {
    const character = createCharacter(object, material)
    group.add(character.root)
    updatePose = character.update
  } else {
    const prop = DIRECTOR_PROP_CATALOG.find((item) => item.id === object.propId)
    if (prop) {
      for (const part of prop.parts) {
        const partMaterial = part.colorIndex === undefined ? material : new THREE.MeshStandardMaterial({ color: objectColor(palette.objectColors, part.colorIndex), roughness: 0.85 })
        const mesh = addMesh(group, partGeometry(part.shape), partMaterial, part.position)
        mesh.scale.fromArray(part.scale)
        if (part.rotation) mesh.rotation.set(...part.rotation)
      }
      // Some catalogs color every part; release the unused base material.
      if (prop.parts.every((part) => part.colorIndex !== undefined)) material.dispose()
    } else {
      addMesh(group, object.kind === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24) : new THREE.BoxGeometry(1, 1, object.kind === 'plane' ? 0.02 : 1), material, [0, 0.5, 0])
    }
  }
  return { group, updatePose, signature: `${object.kind}/${object.build}/${object.propId}/${object.colorIndex}/${color}` }
}

/** Owned render world with incremental transforms/pose updates; helpers remain in the editor only. */
export interface RenderWorld {
  scene: THREE.Scene
  objects: Map<string, THREE.Group>
  /** Apply a sampled document without allocating new meshes for each frame. */
  update: (document: DirectorDocument) => void
  /** Release every owned GPU resource. */
  dispose: () => void
}

/** Create a scene shared by live rendering and frozen capture. @param document Initial sampled scene. @param palette Theme colors. @returns Owned world; call dispose after use. */
export function createRenderWorld(document: DirectorDocument, palette: StagePalette): RenderWorld {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(palette.background)
  // Light energy is independent of UI contrast: a light-theme dark text token would extinguish it.
  scene.add(new THREE.AmbientLight(palette.illumination, 0.65))
  const key = new THREE.DirectionalLight(palette.illumination, 1.5)
  key.position.set(4, 8, 5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(palette.illumination, 0.4)
  fill.position.set(-5, 3, -4)
  scene.add(fill)
  const entries = new Map<string, ReturnType<typeof createObject>>()
  const objects = new Map<string, THREE.Group>()
  const update = (next: DirectorDocument) => {
    const ids = new Set(next.objects.map((item) => item.id))
    for (const [id, entry] of entries) {
      if (!ids.has(id)) {
        scene.remove(entry.group)
        disposeTree(entry.group)
        entries.delete(id)
        objects.delete(id)
      }
    }
    for (const object of next.objects) {
      const signature = `${object.kind}/${object.build}/${object.propId}/${object.colorIndex}/${resolveCharacterColor(object, palette.objectColors) || palette.foreground}`
      let entry = entries.get(object.id)
      if (!entry || entry.signature !== signature) {
        if (entry) { scene.remove(entry.group); disposeTree(entry.group) }
        entry = createObject(object, palette)
        entries.set(object.id, entry)
        objects.set(object.id, entry.group)
        scene.add(entry.group)
      }
      entry.group.visible = object.visible
      entry.group.position.fromArray(object.position)
      entry.group.rotation.set(...object.rotation)
      entry.group.scale.fromArray(object.scale)
      entry.updatePose?.(object)
    }
    scene.updateMatrixWorld(true)
  }
  update(document)
  return { scene, objects, update, dispose: () => { disposeTree(scene); scene.clear(); entries.clear(); objects.clear() } }
}

/** Resolve bounded even output dimensions without distorting the scene ratio. @param document Scene ratio. @param width Optional requested width. @param height Optional requested height. @returns Width/height. */
export function outputDimensions(document: DirectorDocument, width?: number, height?: number): { width: number; height: number } {
  const aspect = ratioToAspect(document.ratio)
  const even = (value: number) => Math.max(2, Math.min(3840, Math.round((Number.isFinite(value) ? value : 1280) / 2) * 2))
  const targetWidth = width ?? (height ? height * aspect : Math.min(1920, 1080 * aspect))
  return { width: even(targetWidth), height: even(height ?? targetWidth / aspect) }
}
