import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createDirectorDocument, createStageObject } from '../model'
import { createRenderWorld, createShotCamera, outputDimensions, readCameraTransform, registerCameraGroup, type StagePalette } from './world'
import { focalToVerticalFov } from '../../scene/director-shot'

const palette: StagePalette = { background: 'black', grid: 'gray', foreground: 'white', illumination: 'white', accent: 'green', objectColors: ['gray'] }

describe('director render world', () => {
  it('updates character materials in the shared preview/capture world without recoloring other objects', () => {
    const document = createDirectorDocument()
    const second = createStageObject(document, 'mannequin')
    document.objects.push(second)
    const world = createRenderWorld(document, palette)
    const secondRoot = world.objects.get(second.id)
    const materialColors = (id: string) => {
      const colors: string[] = []
      world.objects.get(id)!.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) colors.push(child.material.color.getHexString())
      })
      return colors
    }
    const original = materialColors(document.objects[0].id)
    world.update({ ...document, objects: document.objects.map((object, index) => index === 0 ? { ...object, color: '#12abef' } : object) })
    expect(new Set(materialColors(document.objects[0].id))).toEqual(new Set(['12abef']))
    expect(world.objects.get(second.id)).toBe(secondRoot)
    world.update(document)
    expect(materialColors(document.objects[0].id)).toEqual(original)
    world.dispose()
  })
  it.each([
    { background: 'white', foreground: 'black' },
    { background: 'black', foreground: 'white' },
  ])('keeps neutral illumination with $background UI background and $foreground text', (theme) => {
    const world = createRenderWorld(createDirectorDocument(), { ...palette, ...theme })
    const lights = world.scene.children.filter((child): child is THREE.Light => child instanceof THREE.Light)
    expect(lights).toHaveLength(3)
    for (const light of lights) {
      expect(light.color.equals(new THREE.Color('white'))).toBe(true)
      expect(light.intensity).toBeGreaterThan(0)
    }
    expect(world.scene.background).toEqual(new THREE.Color(theme.background))
    world.dispose()
  })

  it('preserves the legacy filming FOV and applies real camera roll', () => {
    const source = createDirectorDocument().cameras[0]
    const plain = createShotCamera(source, 16 / 9)
    const rolled = createShotCamera({ ...source, roll: Math.PI / 2 }, 16 / 9)
    expect(plain.fov).toBe(focalToVerticalFov(source.focalLength, 16 / 9))
    expect(plain.position.toArray()).toEqual(source.position)
    expect(plain.getWorldDirection(new THREE.Vector3()).distanceTo(rolled.getWorldDirection(new THREE.Vector3()))).toBeLessThan(1e-10)
    expect(plain.quaternion.angleTo(rolled.quaternion)).toBeCloseTo(Math.PI / 2)
  })

  it('projects the default head/feet inside NDC and target to center despite editor matrix defaults', () => {
    const matrixAuto = THREE.Object3D.DEFAULT_MATRIX_AUTO_UPDATE
    const worldAuto = THREE.Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE
    try {
      THREE.Object3D.DEFAULT_MATRIX_AUTO_UPDATE = false
      THREE.Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = false
      const source = createDirectorDocument().cameras[0]
      const camera = createShotCamera(source, 16 / 9)
      const center = new THREE.Vector3(...source.target).project(camera)
      expect(center.x).toBeCloseTo(0)
      expect(center.y).toBeCloseTo(0)
      for (const y of [0, 1.75]) {
        const projected = new THREE.Vector3(0, y, 0).project(camera)
        expect(Math.abs(projected.x)).toBeLessThan(1)
        expect(Math.abs(projected.y)).toBeLessThan(1)
        expect(Math.abs(projected.z)).toBeLessThan(1)
      }
    } finally {
      THREE.Object3D.DEFAULT_MATRIX_AUTO_UPDATE = matrixAuto
      THREE.Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = worldAuto
    }
  })

  it('round-trips a rotated camera gizmo with radians roll and unchanged aim distance', () => {
    const source = { ...createDirectorDocument().cameras[0], roll: 0.7 }
    const helper = new THREE.Group()
    const camera = createShotCamera(source, 16 / 9)
    helper.position.copy(camera.position).add(new THREE.Vector3(2, 0, -1))
    helper.quaternion.copy(camera.quaternion)
    helper.rotateY(0.25)
    const next = readCameraTransform(source, helper, 16 / 9)
    const restored = createShotCamera({ ...source, ...next }, 16 / 9)
    expect(restored.quaternion.angleTo(helper.quaternion)).toBeLessThan(1e-7)
    expect(new THREE.Vector3(...next.position).distanceTo(new THREE.Vector3(...next.target))).toBeCloseTo(new THREE.Vector3(...source.position).distanceTo(new THREE.Vector3(...source.target)))
    expect(Math.abs(next.roll)).toBeLessThan(Math.PI)
  })

  it('registers initial helpers immediately and ignores stale cleanup after replacement', () => {
    const registry = new Map<string, THREE.Group>()
    const first = new THREE.Group()
    const second = new THREE.Group()
    const disposeFirst = registerCameraGroup(registry, 'camera_1', first)
    expect(registry.get('camera_1')).toBe(first)
    const disposeSecond = registerCameraGroup(registry, 'camera_1', second)
    disposeFirst()
    expect(registry.get('camera_1')).toBe(second)
    disposeSecond()
    expect(registry.has('camera_1')).toBe(false)
  })

  it('updates transforms, visibility and poses without recreating geometry each frame', () => {
    const document = createDirectorDocument()
    const world = createRenderWorld(document, palette)
    const object = document.objects[0]
    const original = world.objects.get(object.id)!
    let mesh: THREE.Mesh | undefined
    original.traverse((child) => { if (!mesh && child instanceof THREE.Mesh) mesh = child })
    const geometry = mesh!.geometry
    world.update({ ...document, objects: [{ ...object, position: [2, 3, 4], pose: 'wave', visible: false }] })
    expect(world.objects.get(object.id)).toBe(original)
    expect(mesh!.geometry).toBe(geometry)
    expect(original.position.toArray()).toEqual([2, 3, 4])
    expect(original.visible).toBe(false)
    world.dispose()
  })

  it('renders catalog props and disposes removed object resources', () => {
    const document = createDirectorDocument()
    const object = createStageObject(document, 'box', 'chair')
    document.objects.push(object)
    const world = createRenderWorld(document, palette)
    const root = world.objects.get(object.id)!
    const mesh = root.children[0] as THREE.Mesh
    const dispose = vi.spyOn(mesh.geometry, 'dispose')
    world.update({ ...document, objects: document.objects.filter((item) => item.id !== object.id) })
    expect(dispose).toHaveBeenCalledOnce()
    expect(world.objects.has(object.id)).toBe(false)
    expect(world.scene.children.some((item) => item instanceof THREE.GridHelper || item instanceof THREE.CameraHelper)).toBe(false)
    world.dispose()
  })

  it('disposes replaced materials/geometries once and adds new objects incrementally', () => {
    const document = createDirectorDocument()
    const world = createRenderWorld(document, palette)
    const root = world.objects.get(document.objects[0].id)!
    let mesh: THREE.Mesh | undefined
    root.traverse((child) => { if (!mesh && child instanceof THREE.Mesh) mesh = child })
    const disposeMaterial = vi.spyOn(mesh!.material as THREE.Material, 'dispose')
    const disposeGeometry = vi.spyOn(mesh!.geometry, 'dispose')
    const prop = createStageObject(document, 'box', 'chair')
    world.update({ ...document, objects: [{ ...document.objects[0], build: 'heavy' }, prop] })
    expect(world.objects.get(prop.id)).toBeDefined()
    expect(world.objects.get(document.objects[0].id)).not.toBe(root)
    expect(disposeMaterial).toHaveBeenCalledOnce()
    expect(disposeGeometry).toHaveBeenCalledOnce()
    world.dispose()
    expect(disposeMaterial).toHaveBeenCalledOnce()
  })

  it('bounds resolution and preserves landscape and portrait ratios', () => {
    const document = createDirectorDocument()
    expect(outputDimensions({ ...document, ratio: '16:9' })).toEqual({ width: 1920, height: 1080 })
    expect(outputDimensions({ ...document, ratio: '9:16' }, 720)).toEqual({ width: 720, height: 1280 })
    expect(outputDimensions(document, Infinity, NaN)).toEqual({ width: 1280, height: 1280 })
  })
})
