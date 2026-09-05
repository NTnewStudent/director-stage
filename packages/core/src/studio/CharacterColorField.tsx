import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { readObjectColors } from '../scene/object-colors'
import { normalizeCharacterColor, resolveCharacterColor } from './character-color'
import type { StageObject } from './model'
import { useDirectorText } from './text'

interface Props {
  object: StageObject
  disabled: boolean
  onPatch: (patch: Partial<StageObject>) => void
  onPreview?: (color: string | null) => void
}

/** Edit one character's material with token presets and a native custom picker.
 * @param props Authored character, edit gate, completed-edit and transient-preview callbacks.
 * @returns Accessible color controls; native input previews are coalesced into one commit.
 * @throws Propagates edit callback exceptions.
 */
export function CharacterColorField({ object, disabled, onPatch, onPreview }: Props) {
  const text = useDirectorText()
  const { t } = useTranslation('directorStudio')
  const presetLabel = (number: number) => t('presetColor', { number })
  const colors = readObjectColors()
  const resolved = resolveCharacterColor(object, colors)
  const [draft, setDraft] = useState<string | null>(null)
  const pending = useRef<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const initialValue = useRef('')
  const callbacks = useRef({ disabled, onPatch, onPreview })
  useEffect(() => { callbacks.current = { disabled, onPatch, onPreview } }, [disabled, onPatch, onPreview])

  const commit = () => {
    // A cancelled native dialog may restore the input without sending change.
    const color = pending.current ? normalizeCharacterColor(input.current?.value) : undefined
    pending.current = null
    if (color && color !== initialValue.current && !callbacks.current.disabled) callbacks.current.onPatch({ color })
    callbacks.current.onPreview?.(null)
    setDraft(null)
  }
  useEffect(() => {
    const picker = input.current
    if (!picker) return
    initialValue.current = picker.value
    // React's onChange also fires for every native input event. Listen to the
    // browser's completed change instead, keeping a drag out of document history.
    const finish = () => {
      const color = normalizeCharacterColor(picker.value)
      if (color && color !== initialValue.current && !callbacks.current.disabled) callbacks.current.onPatch({ color })
      pending.current = null
      callbacks.current.onPreview?.(null)
      setDraft(null)
    }
    picker.addEventListener('change', finish)
    return () => { picker.removeEventListener('change', finish); callbacks.current.onPreview?.(null) }
  }, [])

  return <div className="ds-field">
    <span>{text('characterColor')}</span>
    <div className="ds-color-presets" role="group" aria-label={text('characterColor')}>
      {colors.map((color, index) => {
        const selected = !object.color && !draft && object.colorIndex % colors.length === index
        return <button type="button" key={index} className={`ds-color-preset ${selected ? 'is-active' : ''}`} disabled={disabled} aria-label={presetLabel(index + 1)} aria-pressed={selected} onClick={() => {
          if (disabled) return
          pending.current = null
          setDraft(null)
          onPreview?.(null)
          onPatch({ colorIndex: index, color: undefined })
        }}><span className="ds-color-swatch" style={{ backgroundColor: color }} />{selected && <Check size={14} aria-hidden="true" />}</button>
      })}
    </div>
    <label className="ds-custom-color"><span>{text('customColor')}</span><input ref={input} type="color" aria-label={text('customColor')} disabled={disabled} value={draft ?? normalizeCharacterColor(resolved) ?? ''} onChange={() => { /* Native change listener commits the completed picker gesture. */ }} onInput={(event) => {
      if (disabled) return
      const color = normalizeCharacterColor(event.currentTarget.value)
      if (!color) return
      pending.current = color
      setDraft(color)
      onPreview?.(color)
    }} onBlur={commit} /><span className="ds-muted">{draft ?? object.color ?? presetLabel(object.colorIndex % colors.length + 1)}</span></label>
  </div>
}
