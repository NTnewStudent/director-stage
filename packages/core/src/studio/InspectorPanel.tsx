import { useState } from 'react'
import { Copy, Diamond, Lock, Trash2, Unlock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DirectorDocument, StageCamera, StageChannel, StageObject } from './model'
import { DIRECTOR_POSE_KEYS, POSE_CONTROLS, type DirectorBuild, type Vec3 } from '../scene/director-scene'
import { resolveControlValue } from '../scene/poses'
import { NumberField, ToolButton } from './ui'
import { useDirectorText, useEntityLabel } from './text'
import { ClipEditor } from './TimelinePanel'
import { CharacterColorField } from './CharacterColorField'

interface Props {
  document: DirectorDocument
  authoredDocument: DirectorDocument
  selectedId: string | null
  frame: number
  disabled: boolean
  onPatch: (patch: Partial<StageObject & StageCamera>) => void
  onPreviewColor?: (color: string | null) => void
  colorRevision?: string
  onChange: (document: DirectorDocument) => void
  onKey: (channel: StageChannel) => void
  onDuplicate: () => void
  onRemove: () => void
}

/** Context-sensitive scene/object/camera inspector with explicit per-channel keyframing.
 * @param props Authored/rendered scenes, selection and completed-edit callbacks.
 * @returns Context-sensitive properties, pose or motion inspector.
 * @throws Propagates edit callback exceptions.
 */
export function InspectorPanel({ document, authoredDocument, selectedId, frame, disabled, onPatch, onPreviewColor, colorRevision, onChange, onKey, onDuplicate, onRemove }: Props) {
  const text = useDirectorText()
  const entityLabel = useEntityLabel()
  const { t } = useTranslation('directorStudio')
  const [tab, setTab] = useState('attributes')
  const object = document.objects.find((item) => item.id === selectedId)
  const authoredObject = authoredDocument.objects.find((item) => item.id === selectedId)
  const camera = document.cameras.find((item) => item.id === selectedId)
  const entity = object ?? camera
  const locked = disabled || entity?.locked
  const keyButton = (channel: StageChannel) => <ToolButton label={text('addKey')} disabled={locked} active={document.keyframes.some((key) => key.targetId === selectedId && key.channel === channel && key.frame === frame)} onClick={() => onKey(channel)}><Diamond size={13} /></ToolButton>
  const vector = (channel: 'position' | 'rotation' | 'scale' | 'target', value: Vec3) => <div className="ds-field" key={channel}>
    <div className="ds-field-heading"><span>{text(channel)}</span>{keyButton(channel)}</div>
    <div className="ds-axis-row">{value.map((number, index) => <label className="ds-axis" key={index}><span>{'XYZ'[index]}</span><NumberField aria-label={`${text(channel)} ${'XYZ'[index]}`} disabled={locked} value={channel === 'rotation' ? number * 180 / Math.PI : number} step={channel === 'rotation' ? 1 : .1} min={channel === 'scale' ? .05 : -10000} max={channel === 'scale' ? 100 : 10000} onCommit={(next) => {
      const result = [...value] as Vec3
      result[index] = channel === 'rotation' ? next * Math.PI / 180 : next
      onPatch({ [channel]: result })
    }} /></label>)}</div>
  </div>
  if (!entity) return <div className="ds-section"><h3>{text('scene')}</h3><p className="ds-note">{text('noSelection')}</p>
    {(['showGrid', 'showLabels'] as const).map((key) => <label className="ds-field-heading" key={key}><span>{text(key === 'showGrid' ? 'grid' : 'labels')}</span><input type="checkbox" disabled={disabled} checked={document[key]} onChange={(event) => onChange({ ...document, [key]: event.target.checked })} /></label>)}
  </div>
  const label = entityLabel(entity)
  return <div data-testid="director-inspector">
    <div className="ds-panel-heading"><input key={`${entity.id}:${label}`} aria-label={text('rename')} defaultValue={label} disabled={locked} onBlur={(event) => {
      const next = event.target.value.trim()
      if (!next || next === label) return
      onPatch({ name: next })
    }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
      <ToolButton label={text('lock')} disabled={disabled} onClick={() => onPatch({ locked: !entity.locked })}>{entity.locked ? <Lock size={15} /> : <Unlock size={15} />}</ToolButton>
      <ToolButton label={text('duplicate')} disabled={locked} onClick={onDuplicate}><Copy size={15} /></ToolButton>
      <ToolButton label={text('remove')} disabled={locked || (!!camera && document.cameras.length === 1)} onClick={onRemove}><Trash2 size={15} /></ToolButton>
    </div>
    {entity.locked && <div className="ds-section ds-muted">{text('lockedHint')}</div>}
    <div className="ds-tabs">{(object?.kind === 'mannequin' ? ['attributes', 'pose', 'actions', 'path'] : camera ? ['attributes', 'motion'] : ['attributes']).map((id) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{text(id)}</button>)}</div>
    {(tab === 'attributes' || (tab === 'pose' && object?.kind !== 'mannequin')) && <>
      <section className="ds-section"><h3>{text('attributes')}</h3>{vector('position', entity.position)}{object && vector('rotation', object.rotation)}{object && vector('scale', object.scale)}</section>
      {object?.kind === 'mannequin' && <section className="ds-section"><label className="ds-field"><span>{text('build')}</span><select disabled={locked} value={object.build ?? 'standard'} onChange={(event) => onPatch({ build: event.target.value as DirectorBuild })}>{(['slim', 'standard', 'heavy'] as const).map((build) => <option key={build} value={build}>{text(build)}</option>)}</select></label><CharacterColorField key={`${object.id}:${authoredObject?.color}:${authoredObject?.colorIndex}:${!!locked}:${colorRevision}`} object={authoredObject ?? object} disabled={!!locked} onPatch={onPatch} onPreview={onPreviewColor} /></section>}
      {camera && <>
        <section className="ds-section"><h3>{text('lens')}</h3>
          <div className="ds-field"><div className="ds-field-heading"><span>{text('focal')}</span>{keyButton('focalLength')}</div><NumberField aria-label={text('focal')} disabled={locked} value={camera.focalLength} min={14} max={200} step={1} onCommit={(value) => onPatch({ focalLength: value })} /></div>
          <div className="ds-field"><div className="ds-field-heading"><span>{text('roll')}</span>{keyButton('roll')}</div><NumberField aria-label={text('roll')} disabled={locked} value={camera.roll * 180 / Math.PI} min={-360} max={360} step={1} onCommit={(value) => onPatch({ roll: value * Math.PI / 180 })} /></div>
        </section>
        <section className="ds-section"><label className="ds-field"><span>{text('lookAt')}</span><select aria-label={text('lookAt')} disabled={locked} value={camera.lookAtObjectId ?? ''} onChange={(event) => onPatch({ lookAtObjectId: event.target.value || undefined })}><option value="">{text('manual')}</option>{document.objects.map((item) => <option value={item.id} key={item.id}>{entityLabel(item)}</option>)}</select></label>{!camera.lookAtObjectId && vector('target', camera.target)}</section>
      </>}
    </>}
    {tab === 'pose' && object?.kind === 'mannequin' && <>
      <section className="ds-section"><div className="ds-card-grid">{DIRECTOR_POSE_KEYS.map((pose) => <button key={pose} disabled={locked} className={`ds-card ${object.pose === pose ? 'is-active' : ''}`} onClick={() => onPatch({ pose, poseControls: undefined })}>{t(`pose_${pose}`)}</button>)}</div></section>
      <section className="ds-section"><div className="ds-field-heading"><h3>{text('tuning')}</h3><button className="ds-tool" disabled={locked} onClick={() => onPatch({ poseControls: undefined })}>{text('resetPose')}</button></div>
        <p className="ds-note">{text('poseBaseHint')}</p>
        {Array.from(new Set(POSE_CONTROLS.map((control) => control.group))).map((group) => <details key={group}><summary>{t(`poseGroup_${group}`)}</summary>{POSE_CONTROLS.filter((spec) => spec.group === group).map((spec) => <label key={spec.key} className="ds-field"><span>{t(`poseControls.${spec.key}`)} · {spec.unit}</span><NumberField disabled={locked} value={resolveControlValue(authoredObject?.pose ?? 'stand', authoredObject?.poseControls, spec.key)} min={spec.min} max={spec.max} step={spec.step} onCommit={(value) => onPatch({ poseControls: { ...authoredObject?.poseControls, [spec.key]: value } })} /></label>)}</details>)}
      </section>
    </>}
    {(tab === 'actions' || tab === 'motion' || tab === 'path') && <section className="ds-section">
      {tab === 'path' && <><p className="ds-note">{text('pathHint')}</p>{vector('position', entity.position)}</>}
      {document.clips.filter((clip) => clip.targetId === selectedId).map((clip) => <ClipEditor key={clip.id} clip={clip} document={document} disabled={!!locked} onChange={onChange} />)}
      {!document.clips.some((clip) => clip.targetId === selectedId) && <p className="ds-muted">{text('noClips')}</p>}
    </section>}
  </div>
}
