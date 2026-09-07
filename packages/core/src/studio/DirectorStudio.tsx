import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Activity, Box, Camera, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Expand, Film, HelpCircle, Layers, Loader2, Moon, Move3d, Redo2, RotateCcw, RotateCw, Save, Scaling, Sun, Undo2, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { DIRECTOR_RATIOS, ratioToAspect, type DirectorRatio, type Vec3 } from '../scene/director-scene'
import { deriveShotLanguage } from '../scene/director-shot'
import type { DirectorCameraPresetKey } from '../scene/director-camera-presets'
import { addCamera, createStageObject, duplicateEntity, getActiveCamera, normalizeDirectorDocument, removeEntity, syncActiveCamera, type DirectorDocument, type StageCamera, type StageChannel, type StageObject } from './model'
import { addClip, sampleDirectorFrame, upsertKeyframe } from './animation'
import { createHistory, pushHistory, redoHistory, undoHistory } from './history'
import { LibraryPanel, type LibraryTab } from './LibraryPanel'
import { InspectorPanel } from './InspectorPanel'
import { TimelinePanel } from './TimelinePanel'
import DirectorViewport, { type DirectorViewportHandle, type GizmoMode } from './viewport/DirectorViewport'
import { getRecordingFormat } from './viewport/recorder'
import { ToolButton } from './ui'
import { useDirectorText, useEntityLabel } from './text'
import { applyEntityPatch } from './editing'
import { useModelKeyboardMove } from './useModelKeyboardMove'
import { wrapDirectorError } from '../host/errors'
import type { CaptureMeta, DirectorHost, DirectorStageHandle, ImageCaptureResult, Locale, RecordMeta, RecordingResult, Theme, VideoExportResult } from '../host/types'

const NAVIGATION = [
  ['objects', Layers], ['characters', User], ['props', Box],
  ['cameras', Camera], ['actions', Activity], ['motion', Film],
] as const

const LOCALES = [
  { id: 'zh-CN', mark: 'ZH', name: 'ZH' },
  { id: 'en-US', mark: 'EN', name: 'EN' },
  { id: 'ja-JP', mark: 'JP', name: 'JP' },
] as const

/** Internal workbench props; persistence always goes through Host. */
export interface StudioEditorProps {
  initial: DirectorDocument
  documentKey: string
  host: DirectorHost
  theme: Theme
  onThemeChange: (theme: Theme) => void
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  onChange?: (document: DirectorDocument) => void
  onSave?: (document: DirectorDocument) => void
  onCapture?: (blob: Blob, meta: CaptureMeta) => void
  onRecord?: (result: RecordingResult, meta: RecordMeta) => void
  onImageCapture?: (result: ImageCaptureResult) => void
  onVideoExport?: (result: VideoExportResult) => void
  onError?: (error: import('../host/errors').DirectorStageError) => void
}

/** Full director workbench. Canvas/upload coupling is intentionally absent.
 * @param props Host-backed document and optional UI callbacks.
 * @returns In-place studio (not a page portal).
 * @throws Host failures are wrapped as DirectorStageError after onError.
 */
export const StudioEditor = forwardRef<DirectorStageHandle, StudioEditorProps>(function StudioEditor({
  initial, documentKey, host, theme, onThemeChange, locale, onLocaleChange, onChange, onSave, onCapture, onRecord, onImageCapture, onVideoExport, onError,
}, ref) {
  const text = useDirectorText()
  const entityLabel = useEntityLabel()
  const [history, setHistory] = useState(() => createHistory(initial))
  const [keyboardPreview, setKeyboardPreview] = useState<DirectorDocument | null>(null)
  const [colorPreview, setColorPreview] = useState<{ base: DirectorDocument; id: string; color: string } | null>(null)
  const document = keyboardPreview ?? history.present
  const [selectedId, setSelectedId] = useState<string | null>(initial.objects[0]?.id ?? initial.activeCameraId)
  const [previewId, setPreviewId] = useState(history.present.activeCameraId)
  const [tab, setTab] = useState<LibraryTab>('objects')
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate')
  const [currentFrame, setFrame] = useState(0)
  const frame = Math.min(currentFrame, Math.round(document.duration * 30))
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [timelineOpen, setTimelineOpen] = useState(true)
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(310)
  const [timelineHeight, setTimelineHeight] = useState(230)
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [outputOpen, setOutputOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [savedDocument, setSavedDocument] = useState(JSON.stringify(initial))
  const viewport = useRef<DirectorViewportHandle>(null)
  const dialogElement = useRef<HTMLDivElement>(null)
  const abortController = useRef<AbortController | null>(null)
  const skipChange = useRef(true)
  const onCaptureRef = useRef(onCapture)
  const onRecordRef = useRef(onRecord)
  const onImageCaptureRef = useRef(onImageCapture)
  const onVideoExportRef = useRef(onVideoExport)
  onCaptureRef.current = onCapture
  onRecordRef.current = onRecord
  onImageCaptureRef.current = onImageCapture
  onVideoExportRef.current = onVideoExport
  const validPreviewId = document.cameras.some((camera) => camera.id === previewId) ? previewId : document.activeCameraId
  const snapshot = useMemo(() => syncActiveCamera({ ...document, activeCameraId: validPreviewId }), [document, validPreviewId])
  const activeColorPreview = colorPreview?.base === history.present && colorPreview.id === selectedId && !busy && !playing && document.objects.some((object) => object.id === selectedId && object.kind === 'mannequin' && !object.locked) ? colorPreview : null
  const sampled = useMemo(() => {
    const result = sampleDirectorFrame(snapshot, frame)
    return activeColorPreview ? { ...result, objects: result.objects.map((object) => object.id === activeColorPreview.id ? { ...object, color: activeColorPreview.color } : object) } : result
  }, [snapshot, frame, activeColorPreview])
  const dirty = JSON.stringify(snapshot) !== savedDocument
  const currentCamera = getActiveCamera(sampled)
  const lastFrame = Math.round(document.duration * 30)
  const flushKeyboardMove = useModelKeyboardMove({ document: history.present, sampled, selectedId, frame,
    disabled: busy || playing || helpOpen || outputOpen || !!activeColorPreview,
    onPreview: setKeyboardPreview,
    onCommit: (next, overridesClip) => {
      setHistory((current) => pushHistory(current, normalizeDirectorDocument(next)))
      if (overridesClip) toast.info(text('keyOverride'))
    },
  })

  const change = useCallback((next: DirectorDocument) => {
    flushKeyboardMove()
    setColorPreview(null)
    setPlaying(false)
    setHistory((current) => pushHistory(current, normalizeDirectorDocument(next)))
  }, [flushKeyboardMove])
  const authored = useCallback(() => {
    const moved = flushKeyboardMove()
    return syncActiveCamera({
      ...moved,
      activeCameraId: validPreviewId,
      objects: activeColorPreview ? moved.objects.map((object) => object.id === activeColorPreview.id ? { ...object, color: activeColorPreview.color } : object) : moved.objects,
    })
  }, [flushKeyboardMove, validPreviewId, activeColorPreview])
  const seek = useCallback((value: number) => { setPlaying(false); setFrame(Math.max(0, Math.min(Math.round(value), lastFrame))) }, [lastFrame])
  const select = (id: string | null) => {
    setSelectedId(id)
    if (document.cameras.some((camera) => camera.id === id)) {
      setPreviewId(id!)
      if (gizmoMode === 'scale') setGizmoMode('translate')
    }
  }
  const undo = useCallback(() => { flushKeyboardMove(); setColorPreview(null); setPlaying(false); setHistory(undoHistory) }, [flushKeyboardMove])
  const redo = useCallback(() => { flushKeyboardMove(); setColorPreview(null); setPlaying(false); setHistory(redoHistory) }, [flushKeyboardMove])
  const patchEntity = (id: string, patch: Partial<StageObject & StageCamera>) => {
    if (busy) return
    const result = applyEntityPatch(document, sampled, id, patch, frame)
    change(result.document)
    if (result.overridesClip) toast.info(text('keyOverride'))
  }
  const addKey = (channel: StageChannel) => {
    const entity = [...sampled.objects, ...sampled.cameras].find((item) => item.id === selectedId)
    if (!entity || entity.locked || busy) return
    const value = (entity as unknown as Record<string, unknown>)[channel]
    if (typeof value === 'number' || Array.isArray(value)) change(upsertKeyframe(document, { targetId: entity.id, channel, frame, value: value as number | Vec3 }))
  }
  const report = (code: 'SAVE_FAILED' | 'LOAD_FAILED' | 'CAPTURE_FAILED' | 'RECORD_FAILED' | 'RECORD_UNAVAILABLE' | 'NOT_MOUNTED', error: unknown): never => {
    const wrapped = wrapDirectorError(code, error)
    if (wrapped.code !== 'ABORTED') {
      onError?.(wrapped)
      toast.error(`${text('outputFailed')}: ${wrapped.message}`)
    }
    throw wrapped
  }
  const persist = async () => {
    const saved = authored()
    if (activeColorPreview) { setHistory((current) => pushHistory(current, saved)); setColorPreview(null) }
    try {
      await host.documents.save(documentKey, saved)
      setSavedDocument(JSON.stringify(saved))
      onSave?.(saved)
    } catch (error) {
      report('SAVE_FAILED', error)
    }
  }
  const duplicate = () => {
    if (!selectedId) return
    const next = duplicateEntity(document, selectedId)
    change(next)
    const id = next.objects.length > document.objects.length ? next.objects.at(-1)?.id : next.cameras.at(-1)?.id
    if (id) {
      setSelectedId(id)
      if (next.cameras.some((camera) => camera.id === id)) setPreviewId(id)
    }
  }
  const remove = () => { if (selectedId) { change(removeEntity(document, selectedId)); setSelectedId(null) } }
  const dimensions = () => {
    const aspect = ratioToAspect(snapshot.ratio)
    return { width: aspect >= 1 ? 1280 : Math.round(720 * aspect / 2) * 2, height: aspect >= 1 ? Math.round(1280 / aspect / 2) * 2 : 720 }
  }
  const emitImageCapture = (blob: Blob, meta: CaptureMeta, shotFrame: number) => {
    onCaptureRef.current?.(blob, meta)
    onImageCaptureRef.current?.({ blob, ...meta, frame: shotFrame })
  }
  const emitVideoExport = (video: RecordingResult, meta: RecordMeta) => {
    onRecordRef.current?.(video, meta)
    onVideoExportRef.current?.({ ...video, ...meta })
  }
  const captureShot = async (options?: { cameraId?: string; frame?: number }): Promise<Blob> => {
    if (!viewport.current) return report('NOT_MOUNTED', new Error('viewport missing'))
    setPlaying(false)
    const frozen = structuredClone(authored())
    const size = dimensions()
    const cameraId = options?.cameraId ?? getActiveCamera(frozen).id
    const shotFrame = options?.frame ?? frame
    try {
      const blob = await viewport.current.capture({ snapshot: frozen, cameraId, frame: shotFrame, ...size })
      const meta: CaptureMeta = { key: documentKey, cameraId, mimeType: blob.type || 'image/png', ...size }
      await host.media?.saveImage?.(blob, meta)
      emitImageCapture(blob, meta, shotFrame)
      return blob
    } catch (error) {
      return report('CAPTURE_FAILED', error)
    }
  }
  const recordShot = async (options?: { signal?: AbortSignal }): Promise<RecordingResult> => {
    if (!viewport.current) return report('NOT_MOUNTED', new Error('viewport missing'))
    if (!getRecordingFormat()) return report('RECORD_UNAVAILABLE', new Error('no recorder'))
    setPlaying(false); setBusy(true); setProgress(0)
    const controller = options?.signal ? undefined : new AbortController()
    abortController.current = controller ?? abortController.current
    const signal = options?.signal ?? controller!.signal
    const frozen = structuredClone(authored())
    const size = dimensions()
    try {
      const video = await viewport.current.record({ snapshot: frozen, ...size, signal, onProgress: setProgress })
      const meta: RecordMeta = { key: documentKey, cameraId: getActiveCamera(frozen).id, mimeType: video.mimeType, extension: video.extension, duration: frozen.duration, ...size }
      await host.media?.saveVideo?.(video.blob, meta)
      emitVideoExport(video, meta)
      return video
    } catch (error) {
      return report('RECORD_FAILED', error)
    } finally { setBusy(false); abortController.current = null }
  }
  const output = async (kind: 'capture' | 'all' | 'record') => {
    if (!viewport.current || busy) return
    setPlaying(false); setBusy(true); setProgress(0)
    const controller = new AbortController()
    abortController.current = controller
    const frozen = structuredClone(authored())
    const size = dimensions()
    try {
      if (kind === 'capture' || kind === 'all') {
        const cameras = kind === 'all' ? frozen.cameras : [getActiveCamera(frozen)]
        for (const [index, camera] of cameras.entries()) {
          if (controller.signal.aborted) break
          const blob = await viewport.current.capture({ snapshot: frozen, cameraId: camera.id, frame, ...size, signal: controller.signal })
          if (controller.signal.aborted) break
          const meta: CaptureMeta = { key: documentKey, cameraId: camera.id, mimeType: blob.type || 'image/png', ...size }
          await host.media?.saveImage?.(blob, meta)
          emitImageCapture(blob, meta, frame)
          setProgress((index + 1) / cameras.length)
        }
      } else {
        const video = await viewport.current.record({ snapshot: frozen, ...size, signal: controller.signal, onProgress: setProgress })
        const meta: RecordMeta = { key: documentKey, cameraId: getActiveCamera(frozen).id, mimeType: video.mimeType, extension: video.extension, duration: frozen.duration, ...size }
        await host.media?.saveVideo?.(video.blob, meta)
        emitVideoExport(video, meta)
      }
      if (!controller.signal.aborted) { await persist(); toast.success(text('exportDone')); setOutputOpen(false) }
    } catch (error) {
      if (!controller.signal.aborted) {
        const wrapped = wrapDirectorError(kind === 'record' ? 'RECORD_FAILED' : 'CAPTURE_FAILED', error)
        if (wrapped.code !== 'ABORTED') {
          onError?.(wrapped)
          toast.error(`${text('outputFailed')}: ${wrapped.message}`)
        }
      }
    } finally { setBusy(false); abortController.current = null }
  }
  const publishShotText = useCallback(async () => {
    const shot = deriveShotLanguage(sampled).text
    toast.success(shot)
    await host.onShotText?.(shot)
    try { await navigator.clipboard.writeText(shot) } catch { /* Clipboard may be missing or denied. */ }
  }, [host, sampled])

  useImperativeHandle(ref, () => ({
    getDocument: () => structuredClone(authored()),
    setDocument: (next) => change(next),
    save: persist,
    load: async (key) => {
      try {
        const loaded = await host.documents.load(key ?? documentKey)
        if (loaded) {
          const next = normalizeDirectorDocument(loaded)
          change(next)
          setSavedDocument(JSON.stringify(next))
        }
        return loaded
      } catch (error) {
        return report('LOAD_FAILED', error)
      }
    },
    capture: (options) => captureShot(options),
    record: (options) => recordShot(options),
    getShotText: () => deriveShotLanguage(sampled).text,
    writeShotText: publishShotText,
    getTheme: () => theme,
    setTheme: onThemeChange,
    getLocale: () => locale,
    setLocale: onLocaleChange,
  }), [authored, change, documentKey, host, locale, onLocaleChange, persist, publishShotText, sampled, theme, onThemeChange])

  useEffect(() => {
    if (skipChange.current) { skipChange.current = false; return }
    onChange?.(structuredClone(history.present))
  }, [history.present, onChange])
  useEffect(() => {
    if (!playing) return
    const start = performance.now()
    const startFrame = frame >= lastFrame ? 0 : frame
    let requestId = 0
    const tick = (now: number) => {
      const value = startFrame + Math.floor((now - start) * 30 / 1000)
      if (value > lastFrame && !loop) { setFrame(lastFrame); setPlaying(false); return }
      setFrame(loop ? value % (lastFrame + 1) : Math.min(lastFrame, value))
      requestId = requestAnimationFrame(tick)
    }
    requestId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(requestId)
    // Playback clock must not restart when the current frame ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loop, lastFrame])
  useEffect(() => () => abortController.current?.abort(), [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (busy || helpOpen || outputOpen || target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return
      const key = event.key.toLowerCase()
      if (['r', 'f'].includes(key) || event.code === 'Space' || ((event.metaKey || event.ctrlKey) && key === 'z')) event.stopPropagation()
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === 'Space') { event.preventDefault(); setPlaying((value) => !value) }
      if (event.key.toLowerCase() === 'r') setGizmoMode('scale')
      if (event.key.toLowerCase() === 'f') viewport.current?.focusSelection()
    }
    window.addEventListener('keydown', keydown, true)
    return () => window.removeEventListener('keydown', keydown, true)
  }, [busy, helpOpen, outputOpen, redo, undo])
  const resize = (event: PointerEvent<HTMLButtonElement>, side: 'left' | 'right' | 'timeline') => {
    event.preventDefault()
    const start = side === 'timeline' ? event.clientY : event.clientX
    const original = side === 'left' ? leftWidth : side === 'right' ? rightWidth : timelineHeight
    event.currentTarget.setPointerCapture(event.pointerId)
    const element = event.currentTarget
    const move = (moveEvent: globalThis.PointerEvent) => {
      const delta = (side === 'timeline' ? moveEvent.clientY : moveEvent.clientX) - start
      const value = Math.max(side === 'timeline' ? 150 : 180, Math.min(side === 'timeline' ? 420 : 440, original + delta * (side === 'left' ? 1 : -1)))
      if (side === 'left') setLeftWidth(value)
      else if (side === 'right') setRightWidth(value)
      else setTimelineHeight(value)
    }
    const finish = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', finish); element.removeEventListener('pointercancel', finish) }
    element.addEventListener('pointermove', move); element.addEventListener('pointerup', finish); element.addEventListener('pointercancel', finish)
  }
  return <div ref={dialogElement} className="director-studio nodrag nopan nowheel" role="application" aria-label={text('title')} data-testid="director-studio" onKeyDown={(event) => event.stopPropagation()}>
    <header className="ds-header">
      <Clapperboard size={22} /><div><div className="ds-title">{text('title')}</div><div className="ds-kicker">SCENE / MOTION / CAMERA</div></div>
      <div className="ds-header-switch">
        <div className="ds-seg" data-testid="director-theme-switch" role="group" aria-label={text('theme')}>
          <button type="button" className={theme === 'dark' ? 'is-active' : ''} aria-pressed={theme === 'dark'} aria-label={text('themeDark')} onClick={() => onThemeChange('dark')}><Moon size={16} /></button>
          <button type="button" className={theme === 'light' ? 'is-active' : ''} aria-pressed={theme === 'light'} aria-label={text('themeLight')} onClick={() => onThemeChange('light')}><Sun size={16} /></button>
        </div>
        <div className="ds-seg" data-testid="director-locale-switch" role="group" aria-label={text('language')}>
          {LOCALES.map((item) => <button key={item.id} type="button" className={locale === item.id ? 'is-active' : ''} aria-pressed={locale === item.id} aria-label={item.name} onClick={() => onLocaleChange(item.id)}>{item.mark}</button>)}
        </div>
      </div>
      <span className="ds-save-state">{text(dirty ? 'unsaved' : 'saved')}</span><span className="ds-spacer" />
      <div className="ds-header-actions">
        <ToolButton label={text('undo')} disabled={busy || !history.past.length} onClick={undo}><Undo2 size={16} /></ToolButton>
        <ToolButton label={text('redo')} disabled={busy || !history.future.length} onClick={redo}><Redo2 size={16} /></ToolButton>
        <select aria-label={text('ratio')} disabled={busy} value={document.ratio} onChange={(event) => change({ ...document, ratio: event.target.value as DirectorRatio })}>{DIRECTOR_RATIOS.map((ratio) => <option key={ratio}>{ratio}</option>)}</select>
        <ToolButton label={text('save')} disabled={busy} onClick={() => void persist()}><Save size={16} /></ToolButton>
        <button className="ds-secondary" disabled={busy} onClick={() => { void publishShotText() }}>{text('writeText')}</button>
        <button className="ds-primary" disabled={busy || !!activeColorPreview} onClick={() => setOutputOpen(true)}>{text('capture')} / {text('record')}</button>
        <ToolButton label={text('help')} onClick={() => setHelpOpen(true)}><HelpCircle size={16} /></ToolButton>
      </div>
    </header>
    <div className="ds-workspace">
      <nav className="ds-rail" aria-label={text('title')}>{NAVIGATION.map(([id, Icon]) => <button key={id} className={`ds-nav ${tab === id && leftOpen ? 'is-active' : ''}`} aria-label={text(id)} aria-pressed={tab === id && leftOpen} onClick={() => { setTab(id); setLeftOpen(true) }}><Icon size={19} /><span className="ds-nav-label">{text(id)}</span></button>)}</nav>
      {leftOpen && <><aside className="ds-library" style={{ width: leftWidth }}><LibraryPanel tab={tab} document={document} selectedId={selectedId} disabled={busy} onSelect={select} onChange={change} onAddCharacter={(count) => {
        let next = document
        for (let index = 0; index < count; index++) { const object = createStageObject(next, 'mannequin'); object.position = [(index - (count - 1) / 2) * .9, 0, 0]; next = { ...next, objects: [...next.objects, object] } }
        change(next); setSelectedId(next.objects.at(-1)!.id)
      }} onAddProp={(id) => { const object = createStageObject(document, 'box', id); change({ ...document, objects: [...document.objects, object] }); setSelectedId(object.id) }} onAddCamera={(key) => {
        const next = addCamera(document, key as DirectorCameraPresetKey, key === 'current' ? viewport.current?.getEditorCamera() : undefined)
        change(next); setPreviewId(next.activeCameraId); setSelectedId(next.activeCameraId)
      }} onAddClip={(presetId) => {
        const character = document.objects.find((object) => object.id === selectedId && object.kind === 'mannequin' && !object.locked)
        const camera = document.cameras.find((item) => item.id === selectedId && !item.locked)
        if (!(tab === 'actions' ? character : camera)) { toast.error(text(tab === 'actions' ? 'selectCharacter' : 'selectCamera')); return }
        change(addClip(document, { targetId: selectedId!, presetId, startFrame: Math.min(frame, lastFrame - 1), endFrame: Math.min(lastFrame, frame + 90), amount: 1, loop: false }))
      }} /></aside><button className="ds-resize" aria-label={text('resize')} onPointerDown={(event) => resize(event, 'left')} /></>}
      <main className="ds-center">
        <div className="ds-viewport">
          <DirectorViewport ref={viewport} theme={theme} scene={sampled} selectedId={selectedId} mode={gizmoMode} onSelect={select} onTransform={patchEntity} previewElement={previewElement} disabled={busy || playing} />
          <div className="ds-view-label">{text('editorView')} <span className="ds-muted">/ {frame.toString().padStart(4, '0')}</span></div>
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex' }}><ToolButton label={text('collapseLeft')} onClick={() => setLeftOpen(!leftOpen)}>{leftOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</ToolButton><ToolButton label={text('collapseRight')} onClick={() => setRightOpen(!rightOpen)}>{rightOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</ToolButton></div>
          <div className="ds-view-tools">{([['translate', Move3d, 'move'], ['rotate', RotateCw, 'rotate'], ['scale', Scaling, 'scale']] as const).map(([mode, Icon, label]) => <ToolButton key={mode} label={text(label)} disabled={busy || playing} active={gizmoMode === mode} onClick={() => setGizmoMode(mode)}><Icon size={17} /></ToolButton>)}<ToolButton label={text('focus')} onClick={() => viewport.current?.focusSelection()}><Expand size={16} /></ToolButton><ToolButton label={text('resetView')} onClick={() => viewport.current?.resetView()}><RotateCcw size={16} /></ToolButton><ToolButton label={text('collapseTimeline')} active={timelineOpen} onClick={() => setTimelineOpen(!timelineOpen)}><ChevronDown size={16} /></ToolButton></div>
        </div>
        {timelineOpen && <><button className="ds-resize ds-resize-horizontal" aria-label={text('resize')} onPointerDown={(event) => resize(event, 'timeline')} /><section className="ds-timeline" style={{ height: timelineHeight }}><TimelinePanel document={document} frame={frame} selectedId={selectedId} playing={playing} loop={loop} disabled={busy} onSeek={seek} onPlay={() => setPlaying(!playing)} onLoop={() => setLoop(!loop)} onSelect={select} onChange={change} /></section></>}
      </main>
      {rightOpen && <><button className="ds-resize" aria-label={text('resize')} onPointerDown={(event) => resize(event, 'right')} /><aside className="ds-right" style={{ width: rightWidth }}><div className="ds-panel-heading"><h2>{text('preview')}</h2><ToolButton label={text('locate')} onClick={() => viewport.current?.setEditorCamera(currentCamera)}><Expand size={15} /></ToolButton></div><div className="ds-panel-body"><select aria-label={text('preview')} value={validPreviewId} onChange={(event) => { setPreviewId(event.target.value); setSelectedId(event.target.value) }}>{document.cameras.map((camera) => <option value={camera.id} key={camera.id}>{entityLabel(camera)}</option>)}</select></div><div className="ds-preview" ref={setPreviewElement} style={{ aspectRatio: ratioToAspect(document.ratio), maxHeight: 220 }} data-testid="director-camera-preview" /><InspectorPanel key={selectedId} authoredDocument={document} document={{ ...sampled, keyframes: document.keyframes, clips: document.clips }} selectedId={selectedId} frame={frame} disabled={busy || playing} colorRevision={`${history.past.length}:${history.future.length}`} onPreviewColor={(color) => setColorPreview(color && selectedId ? { base: history.present, id: selectedId, color } : null)} onPatch={(patch) => { if (selectedId) patchEntity(selectedId, patch) }} onChange={(next) => change({ ...document, showGrid: next.showGrid, showLabels: next.showLabels, clips: next.clips })} onKey={addKey} onDuplicate={duplicate} onRemove={remove} /></aside></>}
    </div>
    <footer className="ds-status"><span>{document.objects.length} {text('objects')} / {document.cameras.length} {text('cameras')}</span><span>{text('keyboardMoveHint')}</span><span className="ds-spacer" /><span>{document.ratio} · {document.duration}s · 30 fps</span></footer>
    {helpOpen && <div className="ds-dialog"><div className="ds-dialog-content"><h2>{text('help')}</h2><p className="ds-note">{text('helpText')}</p><p className="ds-note">{text('actionHint')}</p><p className="ds-note">{text('outputHint')}</p><button className="ds-primary" onClick={() => setHelpOpen(false)}>{text('done')}</button></div></div>}
    {outputOpen && <div className="ds-dialog"><div className="ds-dialog-content"><div className="ds-field-heading"><h2>{text('capture')} / {text('record')}</h2><ToolButton label={text('done')} disabled={busy} onClick={() => setOutputOpen(false)}><X size={18} /></ToolButton></div><p className="ds-note">{text('cleanOutput')}</p><p className="ds-note">{text('outputHint')} {getRecordingFormat()?.extension.toUpperCase() ?? text('unavailable')}</p><div className="ds-panel-body"><button className="ds-primary" disabled={busy} onClick={() => void output('capture')}>{text('capture')}</button><button className="ds-secondary" disabled={busy} onClick={() => void output('all')}>{text('captureAll')} · {document.cameras.length}</button><button className="ds-secondary" disabled={busy || !getRecordingFormat()} onClick={() => void output('record')}>{text('recordCanvas')}</button></div>{busy && <><div className="ds-field-heading"><Loader2 size={16} className="animate-spin" /><span>{text('exporting')} {Math.round(progress * 100)}%</span><button className="ds-secondary" onClick={() => abortController.current?.abort()}>{text('cancel')}</button></div><progress value={progress} max={1} style={{ width: '100%', accentColor: 'var(--color-brand)' }} /></>}</div></div>}
  </div>
})
