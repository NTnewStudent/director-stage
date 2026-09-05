import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls, Html, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import type { DirectorDocument, StageCamera } from '../model'
import { ratioToAspect, type Vec3 } from '../../scene/director-scene'
import { captureDirectorFrame, createPixelSurface, type CaptureOptions } from './capture'
import { recordDirectorVideo, type RecordOptions, type RecordingResult } from './recorder'
import { createRenderWorld, createShotCamera, disposeTree, readStagePalette, readCameraTransform, registerCameraGroup } from './world'
import { useEntityLabel } from '../text'

/** Available object manipulation modes. */
export type GizmoMode = 'translate' | 'rotate' | 'scale'

/** One completed gizmo gesture; cameras additionally supply their transformed aim target. */
export interface StageTransform { position: Vec3; rotation: Vec3; scale: Vec3; target?: Vec3; roll?: number }

/** Independent editor camera; can seed a new saved filming camera. */
export type EditorCamera = Pick<StageCamera, 'position' | 'target' | 'focalLength' | 'roll'>

/** Public viewport controls. Every media call rejects when cancelled/unavailable; no graph mutation occurs here. */
export interface DirectorViewportHandle {
  /** Read the current editor view. @returns Camera state; no exceptions. */
  getEditorCamera: () => EditorCamera
  /** Restore the default editor view without touching filming cameras. */
  resetView: () => void
  /** Focus the current selection without editing the document. */
  focusSelection: () => void
  /** Navigate editor view to a saved camera. @param camera Desired view. */
  setEditorCamera: (camera: EditorCamera) => void
  /** Capture a frozen camera frame. @param options Shot request. @returns PNG; rejects on browser failure/cancel. @see docs/api-contracts/client/director-stage.md#RULE_DIRECTOR_OUTPUT */
  capture: (options: CaptureOptions) => Promise<Blob>
  /** Record a frozen scene. @param options Export request. @returns Actual encoded video; rejects on failure/cancel. @see docs/api-contracts/client/director-stage.md#RULE_DIRECTOR_OUTPUT */
  record: (options: RecordOptions) => Promise<RecordingResult>
}

/** Controlled viewport input; scene is already sampled by the editor timeline. */
export interface DirectorViewportProps {
  scene: DirectorDocument
  selectedId: string | null
  mode: GizmoMode
  theme?: import('../../host/types').Theme
  onSelect: (id: string | null) => void
  onTransform: (id: string, transform: StageTransform) => void
  previewElement?: HTMLElement | null
  disabled?: boolean
}

function CameraEntity({ camera, selected, aspect, onSelect, onReady, theme }: {
  camera: StageCamera; selected: boolean; aspect: number; theme?: import('../../host/types').Theme
  onSelect: (id: string) => void; onReady: (id: string, group: THREE.Group) => () => void
}) {
  const palette = useMemo(() => readStagePalette(document.querySelector('[data-director-stage-theme]')), [theme])
  const lifecycle = useRef(new Map<THREE.Group, number>())
  const group = useMemo(() => {
    const root = new THREE.Group()
    const color = new THREE.Color(palette.foreground)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.18), new THREE.MeshBasicMaterial({ color, wireframe: true }))
    root.add(body)
    const geometry = new THREE.BufferGeometry()
    const x = 0.24 * aspect
    const vertices = [-x, -0.24, -0.6, x, -0.24, -0.6, x, 0.24, -0.6, -x, 0.24, -0.6]
    const segments: number[] = []
    for (let corner = 0; corner < 4; corner++) {
      segments.push(0, 0, 0, ...vertices.slice(corner * 3, corner * 3 + 3))
      segments.push(...vertices.slice(corner * 3, corner * 3 + 3), ...vertices.slice(((corner + 1) % 4) * 3, ((corner + 1) % 4) * 3 + 3))
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3))
    root.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color })))
    return root
  }, [palette, aspect])
  useLayoutEffect(() => {
    const shot = createShotCamera(camera, aspect)
    group.position.copy(shot.position)
    group.quaternion.copy(shot.quaternion)
    // This is an owned Three object, not React state; visibility updates are imperative by design.
    // eslint-disable-next-line react-hooks/immutability
    group.visible = camera.visible
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        const material = child.material as THREE.MeshBasicMaterial
        material.color.set(selected ? palette.accent : palette.foreground)
      }
    })
    return onReady(camera.id, group)
  }, [camera, selected, group, aspect, palette, onReady])
  useEffect(() => {
    const generations = lifecycle.current
    const generation = (generations.get(group) ?? 0) + 1
    generations.set(group, generation)
    return () => {
      // StrictMode re-registers the same helper before this microtask; replaced groups still dispose.
      queueMicrotask(() => {
        if (generations.get(group) === generation) { generations.delete(group); disposeTree(group) }
      })
    }
  }, [group])
  return <primitive object={group} onPointerDown={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onSelect(camera.id) }} />
}

const Runtime = forwardRef<DirectorViewportHandle, DirectorViewportProps>(function Runtime(props, ref) {
  const { scene, selectedId, mode, theme, onSelect, onTransform, previewElement, disabled } = props
  const entityLabel = useEntityLabel()
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const palette = useMemo(() => readStagePalette(document.querySelector('[data-director-stage-theme]')), [theme])
  const [world] = useState(() => createRenderWorld(scene, palette))
  const controls = useRef<CameraControls>(null)
  const cameraGroups = useRef(new Map<string, THREE.Group>())
  const [selectedGroup, setSelectedGroup] = useState<THREE.Group | null>(null)
  const exports = useRef(new Set<AbortController>())
  const busy = useRef(false)
  const dragging = useRef(false)
  const lifecycle = useRef(0)
  const preview = useRef<ReturnType<typeof createPixelSurface> | null>(null)
  const lastPreview = useRef(0)
  const aspect = ratioToAspect(scene.ratio)
  const selectedEntity = scene.objects.find((object) => object.id === selectedId) ?? scene.cameras.find((item) => item.id === selectedId)
  const registerCamera = useMemo(() => (id: string, group: THREE.Group) => registerCameraGroup(cameraGroups.current, id, group), [])

  useLayoutEffect(() => {
    if (!dragging.current) world.update(scene)
    setSelectedGroup(selectedId ? world.objects.get(selectedId) ?? cameraGroups.current.get(selectedId) ?? null : null)
  }, [scene, world, selectedId])

  useEffect(() => {
    const controller = controls.current
    void controller?.setLookAt(6, 4, 7, 0, 0.9, 0, false)
  }, [])

  useEffect(() => {
    if (!previewElement) return
    const width = 480
    const surface = createPixelSurface(gl, width, Math.max(2, Math.round(width / aspect)))
    surface.canvas.style.width = '100%'
    surface.canvas.style.height = '100%'
    surface.canvas.style.objectFit = 'contain'
    previewElement.appendChild(surface.canvas)
    preview.current = surface
    return () => { preview.current = null; surface.canvas.remove(); surface.dispose() }
  }, [gl, previewElement, aspect])

  useEffect(() => {
    const generation = ++lifecycle.current
    const activeExports = exports.current
    const isFinalUnmount = () => lifecycle.current === generation
    return () => {
      activeExports.forEach((controller) => controller.abort())
      // StrictMode replays effects; only final unmount disposes this owned world.
      queueMicrotask(() => { if (isFinalUnmount()) world.dispose() })
      // R3F releases its renderer/context after root unmount; do not destroy it during effect replay.
    }
  }, [world])

  useFrame(({ clock }) => {
    if (!preview.current || clock.elapsedTime - lastPreview.current < 1 / 24) return
    const active = scene.cameras.find((item) => item.id === scene.activeCameraId)
    if (!active) return
    preview.current.render(world.scene, createShotCamera(active, aspect))
    lastPreview.current = clock.elapsedTime
  })

  useImperativeHandle(ref, () => {
    const setEditorCamera = (next: EditorCamera) => {
      camera.fov = createShotCamera({ ...scene.cameras[0], ...next }, camera.aspect).fov
      camera.updateProjectionMatrix()
      void controls.current?.setLookAt(...next.position, ...next.target, false)
    }
    const withExport = async <T,>(signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>) => {
      if (busy.current) throw new Error('DIRECTOR_EXPORT_BUSY') // ERR_DIRECTOR_EXPORT_BUSY: shared renderer supports one export at a time.
      const controller = new AbortController()
      const abort = () => controller.abort()
      if (signal?.aborted) controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      exports.current.add(controller)
      busy.current = true
      try { return await run(controller.signal) }
      finally { busy.current = false; signal?.removeEventListener('abort', abort); exports.current.delete(controller) }
    }
    return {
      getEditorCamera: () => ({ position: camera.position.toArray() as Vec3, target: (controls.current?.getTarget(new THREE.Vector3()) ?? new THREE.Vector3()).toArray() as Vec3, focalLength: camera.getFocalLength(), roll: 0 }),
      setEditorCamera,
      resetView: () => { camera.fov = 45; camera.updateProjectionMatrix(); void controls.current?.setLookAt(6, 4, 7, 0, 0.9, 0, true) },
      focusSelection: () => { if (selectedGroup) void controls.current?.fitToBox(selectedGroup, true, { paddingTop: 0.5, paddingBottom: 0.5, paddingLeft: 0.5, paddingRight: 0.5 }) },
      capture: (options) => withExport(options.signal, (signal) => captureDirectorFrame(gl, palette, { ...options, signal })),
      record: (options) => withExport(options.signal, (signal) => recordDirectorVideo(gl, palette, { ...options, signal })),
    }
  }, [camera, scene.cameras, selectedGroup, gl, palette])

  const finishTransform = () => {
    dragging.current = false
    if (!selectedGroup || !selectedId || !selectedEntity || selectedEntity.locked || disabled) return
    const change: StageTransform = {
      position: selectedGroup.position.toArray() as Vec3,
      rotation: [selectedGroup.rotation.x, selectedGroup.rotation.y, selectedGroup.rotation.z],
      scale: selectedGroup.scale.toArray() as Vec3,
    }
    const filmingCamera = scene.cameras.find((item) => item.id === selectedId)
    if (filmingCamera) {
      Object.assign(change, readCameraTransform(filmingCamera, selectedGroup, aspect))
    }
    onTransform(selectedId, change)
  }

  return <>
    <color attach="background" args={[palette.background]} />
    <CameraControls ref={controls} makeDefault minDistance={0.2} maxDistance={120} enabled={!disabled} />
    <primitive object={world.scene} onPointerDown={(event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      let object: THREE.Object3D | null = event.object
      while (object && !object.userData.entityId) object = object.parent
      if (object?.userData.entityId) onSelect(String(object.userData.entityId))
    }} />
    {scene.showGrid && <gridHelper args={[80, 160, palette.grid, palette.grid]} />}
    {scene.cameras.map((item) => <CameraEntity key={item.id} camera={item} aspect={aspect} theme={theme} selected={selectedId === item.id} onSelect={onSelect} onReady={registerCamera} />)}
    {scene.showLabels && scene.objects.filter((item) => item.visible).map((item) => (
      <Html
        key={item.id}
        position={[item.position[0], item.position[1] + 2 * item.scale[1], item.position[2]]}
        center
        sprite
        wrapperClass="ds-world-label-wrap"
        style={{ pointerEvents: 'none', writingMode: 'horizontal-tb', whiteSpace: 'nowrap' }}
      >
        <span className="ds-world-label">{entityLabel(item)}</span>
      </Html>
    ))}
    {selectedGroup && selectedEntity && !selectedEntity.locked && selectedEntity.visible && !disabled && <TransformControls object={selectedGroup} mode={'target' in selectedEntity && mode === 'scale' ? 'translate' : mode} size={0.85} onMouseDown={() => { dragging.current = true }} onMouseUp={finishTransform} />}
  </>
})

/** The director's only WebGL context: independent editor camera plus FBO-backed filming preview. @param props Sampled document and editing callbacks. @param ref Media/navigation controls. @returns Lazy-loaded Canvas; WebGL errors bubble to the editor boundary. */
const DirectorViewport = forwardRef<DirectorViewportHandle, DirectorViewportProps>(function DirectorViewport(props, ref) {
  return <Canvas key={props.theme ?? 'dark'} camera={{ position: [6, 4, 7], fov: 45, near: 0.05, far: 500 }} dpr={[1, 1.5]} gl={{ antialias: true }} onPointerMissed={() => props.onSelect(null)}>
    <Runtime {...props} ref={ref} />
  </Canvas>
})

export default DirectorViewport
