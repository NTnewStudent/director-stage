import { useState } from 'react'
import { ChevronFirst, ChevronLast, Diamond, Pause, Play, Repeat2, Trash2 } from 'lucide-react'
import type { DirectorDocument, StageClip, StageInterpolation } from './model'
import { DIRECTOR_ACTION_CATALOG, DIRECTOR_MOTION_CATALOG } from './catalog'
import { removeClip, removeKeyframe, upsertKeyframe } from './animation'
import { NumberField, ToolButton } from './ui'
import { useCatalogText, useDirectorText, useEntityLabel } from './text'

interface ClipProps { clip: StageClip; document: DirectorDocument; disabled: boolean; onChange: (document: DirectorDocument) => void }

/** Edits a real procedural clip's duration and strength; invalid ranges are clamped by normalization.
 * @param props Clip, authored document and commit callback.
 * @returns Clip duration, strength, loop and deletion controls.
 * @throws Propagates commit callback exceptions.
 */
export function ClipEditor({ clip, document, disabled, onChange }: ClipProps) {
  const text = useDirectorText()
  const catalogText = useCatalogText()
  const patch = (change: Partial<StageClip>) => onChange({ ...document, clips: document.clips.map((item) => item.id === clip.id ? { ...item, ...change } : item) })
  const name = [...DIRECTOR_ACTION_CATALOG, ...DIRECTOR_MOTION_CATALOG].map(catalogText).find((preset) => preset.id === clip.presetId)?.name ?? clip.presetId
  return <div className="ds-field" data-testid="director-clip-editor">
    <div className="ds-field-heading"><strong>{name}</strong><ToolButton label={text('deleteClip')} disabled={disabled} onClick={() => onChange(removeClip(document, clip.id))}><Trash2 size={13} /></ToolButton></div>
    <div className="ds-axis-row">
      <label>{text('clipStart')}<NumberField aria-label={text('clipStart')} style={{ width: '100%' }} disabled={disabled} value={clip.startFrame} min={0} max={clip.endFrame - 1} onCommit={(value) => patch({ startFrame: Math.round(value) })} /></label>
      <label>{text('clipEnd')}<NumberField aria-label={text('clipEnd')} style={{ width: '100%' }} disabled={disabled} value={clip.endFrame} min={clip.startFrame + 1} max={Math.round(document.duration * 30)} onCommit={(value) => patch({ endFrame: Math.round(value) })} /></label>
      <label>{text('amount')}<NumberField aria-label={text('amount')} style={{ width: '100%' }} disabled={disabled} value={clip.amount} min={-10} max={10} step={.1} onCommit={(value) => patch({ amount: value })} /></label>
    </div>
    <label><input disabled={disabled} type="checkbox" checked={clip.loop} onChange={(event) => patch({ loop: event.target.checked })} /> {text('loop')}</label>
  </div>
}

interface Props {
  document: DirectorDocument
  frame: number
  playing: boolean
  loop: boolean
  disabled: boolean
  selectedId: string | null
  onSeek: (frame: number) => void
  onPlay: () => void
  onLoop: () => void
  onSelect: (id: string) => void
  onChange: (document: DirectorDocument) => void
}

/** Frame-addressable timeline; selecting/seeking never writes the document or undo history.
 * @param props Authored tracks, playback state and editing callbacks.
 * @returns Frame ruler, playback controls, track lanes and keyframe/clip editors.
 * @throws Propagates commit callback exceptions.
 */
export function TimelinePanel({ document, frame, playing, loop, disabled, selectedId, onSeek, onPlay, onLoop, onSelect, onChange }: Props) {
  const text = useDirectorText()
  const catalogText = useCatalogText()
  const entityLabel = useEntityLabel()
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const lastFrame = Math.round(document.duration * 30)
  const entities = [...document.cameras, ...document.objects]
  const selectedKey = document.keyframes.find((key) => key.id === selectedKeyId)
  const selectedClip = document.clips.find((clip) => clip.id === selectedClipId)
  const lockedKey = disabled || entities.find((entity) => entity.id === selectedKey?.targetId)?.locked
  const lockedClip = disabled || entities.find((entity) => entity.id === selectedClip?.targetId)?.locked
  const keyPatch = (frameValue: number, interpolation: StageInterpolation) => {
    if (!selectedKey) return
    const next = upsertKeyframe(removeKeyframe(document, selectedKey.id), { ...selectedKey, frame: frameValue, interpolation })
    onChange(next)
    setSelectedKeyId(next.keyframes.find((key) => key.targetId === selectedKey.targetId && key.channel === selectedKey.channel && key.frame === frameValue)?.id ?? null)
  }
  return <>
    <div className="ds-transport">
      <span className="ds-kicker">{text('timeline')}</span>
      <ToolButton label={text('start')} onClick={() => onSeek(0)}><ChevronFirst size={15} /></ToolButton>
      <ToolButton label={text('play')} active={playing} disabled={disabled} data-testid="director-play" onClick={onPlay}>{playing ? <Pause size={15} /> : <Play size={15} />}</ToolButton>
      <ToolButton label={text('end')} onClick={() => onSeek(lastFrame)}><ChevronLast size={15} /></ToolButton>
      <ToolButton label={text('loop')} active={loop} onClick={onLoop}><Repeat2 size={15} /></ToolButton>
      <NumberField aria-label={text('frame')} value={frame} min={0} max={lastFrame} onCommit={(value) => onSeek(Math.round(value))} />
      <span className="ds-muted">/ {lastFrame} · 30 fps</span>
      <span className="ds-spacer" />
      <label>{text('duration')} <NumberField aria-label={text('duration')} disabled={disabled} value={document.duration} min={1} max={30} onCommit={(value) => onChange({ ...document, duration: value })} /></label>
    </div>
    <div className="ds-track-list" data-testid="director-timeline">
      <div className="ds-track"><div className="ds-track-label">{text('frame')}</div><div className="ds-track-lane"><div className="ds-ruler" onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); onSeek(Math.round((event.clientX - bounds.left) / bounds.width * lastFrame)) }}>{Array.from({ length: 6 }, (_, index) => <span key={index}>{Math.round(lastFrame * index / 5)}</span>)}</div><div className="ds-playhead" style={{ left: `${frame / lastFrame * 100}%` }} /></div></div>
      {entities.map((entity) => {
        const keys = document.keyframes.filter((key) => key.targetId === entity.id)
        const channels = Array.from(new Set(keys.map((key) => key.channel)))
        const clips = document.clips.filter((clip) => clip.targetId === entity.id)
        return <div key={entity.id}>
          <div className="ds-track"><button className="ds-track-label" style={{ color: entity.id === selectedId ? 'var(--color-brand)' : undefined }} onClick={() => onSelect(entity.id)}>{entityLabel(entity)}</button><div className="ds-track-lane"><div className="ds-playhead" style={{ left: `${frame / lastFrame * 100}%` }} /></div></div>
          {channels.map((channel) => <div className="ds-track" key={channel}><div className="ds-track-label">↳ {text(channel === 'focalLength' ? 'focal' : channel)}</div><div className="ds-track-lane">
            {keys.filter((key) => key.channel === channel).map((key) => <button key={key.id} title={`${text('selectedKey')} ${key.frame} · ${channel}`} aria-label={`${entityLabel(entity)} ${channel} ${key.frame}`} className={`ds-keyframe ${key.id === selectedKeyId ? 'is-active' : ''}`} style={{ left: `${key.frame / lastFrame * 100}%` }} onClick={() => { setSelectedKeyId(key.id); setSelectedClipId(null); onSelect(entity.id); onSeek(key.frame) }} />)}
            <div className="ds-playhead" style={{ left: `${frame / lastFrame * 100}%` }} />
          </div></div>)}
          {clips.map((clip) => <div className="ds-track" key={clip.id}><div className="ds-track-label">↳ {text('clip')}</div><div className="ds-track-lane"><button className="ds-clip" style={{ left: `${clip.startFrame / lastFrame * 100}%`, width: `${(clip.endFrame - clip.startFrame) / lastFrame * 100}%` }} onClick={() => { setSelectedClipId(clip.id); setSelectedKeyId(null); onSelect(entity.id); onSeek(clip.startFrame) }}>{[...DIRECTOR_ACTION_CATALOG, ...DIRECTOR_MOTION_CATALOG].map(catalogText).find((preset) => preset.id === clip.presetId)?.name}</button><div className="ds-playhead" style={{ left: `${frame / lastFrame * 100}%` }} /></div></div>)}
        </div>
      })}
    </div>
    <input aria-label={text('frame')} data-testid="director-frame-slider" type="range" min={0} max={lastFrame} value={frame} onChange={(event) => onSeek(Number(event.target.value))} />
    {selectedKey && <div className="ds-transport"><Diamond size={13} /><span>{text('selectedKey')}</span><NumberField aria-label={text('selectedKey')} disabled={!!lockedKey} value={selectedKey.frame} min={0} max={lastFrame} onCommit={(value) => keyPatch(Math.round(value), selectedKey.interpolation)} /><select aria-label={text('interpolation')} disabled={!!lockedKey} value={selectedKey.interpolation} onChange={(event) => keyPatch(selectedKey.frame, event.target.value as StageInterpolation)}>{(['linear', 'hold', 'ease'] as const).map((value) => <option key={value} value={value}>{text(value)}</option>)}</select><ToolButton label={text('deleteKey')} disabled={!!lockedKey} onClick={() => onChange(removeKeyframe(document, selectedKey.id))}><Trash2 size={14} /></ToolButton></div>}
    {selectedClip && <div className="ds-section" style={{ maxHeight: 130, overflow: 'auto' }}><ClipEditor clip={selectedClip} document={document} disabled={!!lockedClip} onChange={onChange} /></div>}
  </>
}
