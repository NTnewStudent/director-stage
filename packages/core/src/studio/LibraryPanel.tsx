import { useState } from 'react'
import { Box, Camera, Eye, EyeOff, Lock, Unlock, User, Users, Activity, Move3d } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DirectorDocument } from './model'
import { DIRECTOR_ACTION_CATALOG, DIRECTOR_MOTION_CATALOG, DIRECTOR_PROP_CATALOG, type MotionDefinition, type PropDefinition } from './catalog'
import { DIRECTOR_CAMERA_PRESETS } from '../scene/director-camera-presets'
import { ToolButton } from './ui'
import { useCatalogText, useDirectorText, useEntityLabel } from './text'
import { PropThumbnail } from './PropThumbnail'

/** Workbench library modes; these remain UI state, not document history. */
export type LibraryTab = 'objects' | 'characters' | 'props' | 'cameras' | 'actions' | 'motion'
interface Props {
  tab: LibraryTab
  document: DirectorDocument
  selectedId: string | null
  disabled: boolean
  onSelect: (id: string) => void
  onChange: (document: DirectorDocument) => void
  onAddCharacter: (count: number) => void
  onAddProp: (id: string) => void
  onAddCamera: (key: string) => void
  onAddClip: (id: string) => void
}

/** Searchable asset catalog and scene outline. Mutations are emitted as document commits.
 * @param props Scene, current library, selection and edit callbacks.
 * @returns Searchable library or scene-outline panel for the selected navigation mode.
 * @throws Propagates document edit callback errors.
 */
export function LibraryPanel({ tab, document, selectedId, disabled, onSelect, onChange, onAddCharacter, onAddProp, onAddCamera, onAddClip }: Props) {
  const text = useDirectorText()
  const catalogText = useCatalogText()
  const entityLabel = useEntityLabel()
  const { t } = useTranslation('directorStudio')
  const [search, setSearch] = useState({ tab, value: '' })
  const query = search.tab === tab ? search.value : ''
  const setQuery = (value: string) => setSearch({ tab, value })
  const matches = (name: string) => name.toLowerCase().includes(query.toLowerCase())
  const toggle = (id: string, property: 'visible' | 'locked') => onChange({ ...document,
    objects: document.objects.map((object) => object.id === id ? { ...object, [property]: !object[property] } : object),
    cameras: document.cameras.map((camera) => camera.id === id ? { ...camera, [property]: !camera[property] } : camera),
  })
  const catalog: readonly (PropDefinition | MotionDefinition)[] = tab === 'props' ? DIRECTOR_PROP_CATALOG : tab === 'actions' ? DIRECTOR_ACTION_CATALOG : DIRECTOR_MOTION_CATALOG
  const filtered = catalog.map(catalogText).filter((entry) => matches(`${entry.name} ${entry.category} ${entry.description}`))
  return <>
    <div className="ds-panel-heading"><h2>{text(tab)}</h2><span className="ds-kicker">LIBRARY</span></div>
    <div className="ds-panel-body">
      <input className="ds-search" aria-label={text('search')} placeholder={text('search')} value={query} onChange={(event) => setQuery(event.target.value)} />
      {tab === 'objects' && <div data-testid="director-outline">
        <div className="ds-kicker">SCENE / {document.objects.length + document.cameras.length}</div>
        {[...document.cameras, ...document.objects].filter((entity) => {
          const label = entityLabel(entity)
          return matches(entity.name) || matches(label)
        }).map((entity) => <div key={entity.id} className={`ds-outline-row ${selectedId === entity.id ? 'is-active' : ''}`}>
          {'focalLength' in entity ? <Camera size={14} /> : entity.kind === 'mannequin' ? <User size={14} /> : <Box size={14} />}
          <button className="ds-outline-name" onClick={() => onSelect(entity.id)}>{entityLabel(entity)}</button>
          <ToolButton label={text('hide')} disabled={disabled} onClick={() => toggle(entity.id, 'visible')}>{entity.visible ? <Eye size={13} /> : <EyeOff size={13} />}</ToolButton>
          <ToolButton label={text('lock')} disabled={disabled} onClick={() => toggle(entity.id, 'locked')}>{entity.locked ? <Lock size={13} /> : <Unlock size={13} />}</ToolButton>
        </div>)}
      </div>}
      {tab === 'characters' && <>
        <div className="ds-card-grid">
          <button className="ds-card" disabled={disabled} onClick={() => onAddCharacter(1)}><span className="ds-card-art"><User /></span>{text('addCharacter')}<small>24 POSES / 26 JOINTS</small></button>
          <button className="ds-card" disabled={disabled} onClick={() => onAddCharacter(5)}><span className="ds-card-art"><Users /></span>{text('crowd')}<small>PROCEDURAL</small></button>
        </div><p className="ds-note">{text('importHint')}</p>
      </>}
      {tab === 'cameras' && <>
        <button className="ds-secondary" disabled={disabled} onClick={() => onAddCamera('current')}>{text('createCamera')}</button>
        <div className="ds-card-grid">{DIRECTOR_CAMERA_PRESETS.filter((preset) => preset.key !== 'current' && matches(t(`cameraPreset_${preset.labelKey}`))).map((preset) => <button className="ds-card" disabled={disabled} key={preset.key} onClick={() => onAddCamera(preset.key)}>
          <span className="ds-card-art"><Camera /></span><span>{t(`cameraPreset_${preset.labelKey}`)}</span><small>{preset.focalLength} mm</small>
        </button>)}</div>
      </>}
      {(tab === 'props' || tab === 'actions' || tab === 'motion') && <>
        {tab !== 'props' && <p className="ds-note">{text(tab === 'actions' ? 'actionHint' : 'motionHint')}</p>}
        {Array.from(new Set(filtered.map((entry) => entry.category))).map((category) => <section key={category}>
          <h3 className="ds-kicker">{category}</h3>
          <div className="ds-card-grid">{filtered.filter((entry) => entry.category === category).map((entry) => <button key={entry.id} title={entry.description} className="ds-card" disabled={disabled} onClick={() => tab === 'props' ? onAddProp(entry.id) : onAddClip(entry.id)}>
            <span className="ds-card-art">{'parts' in entry ? <PropThumbnail definition={entry} /> : tab === 'actions' ? <Activity /> : <Move3d />}</span>
            <span>{entry.name}</span><small>{entry.description}</small>
          </button>)}</div>
        </section>)}
        {!filtered.length && <p className="ds-muted">{text('emptySearch')}</p>}
      </>}
    </div>
  </>
}
