import { useState, type InputHTMLAttributes, type ReactNode } from 'react'

/** Commits finite numeric input on blur/Enter so typing remains one undo step.
 * @param props Input constraints, value and commit callback.
 * @returns Numeric field that commits only finite, clamped values.
 * @throws Propagates exceptions from the caller's commit callback.
 */
export function NumberField({ value, onCommit, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [previousValue, setPreviousValue] = useState(value)
  if (previousValue !== value) {
    setPreviousValue(value)
    setDraft(String(Math.round(value * 1000) / 1000))
  }
  const commit = () => {
    const parsed = Number(draft)
    if (draft.trim() && Number.isFinite(parsed)) {
      const clamped = Math.min(Number(props.max ?? Infinity), Math.max(Number(props.min ?? -Infinity), parsed))
      setDraft(String(clamped))
      onCommit(clamped)
    }
    else setDraft(String(value))
  }
  return <input {...props} type="number" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
}

/** Accessible icon/text control used throughout the workbench.
 * @param props Button label, icon and interaction callbacks.
 * @returns Accessible icon/text button.
 * @throws Propagates callback exceptions.
 */
export function ToolButton({ label, children, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; active?: boolean }) {
  return <button type="button" {...props} title={label} aria-label={label} aria-pressed={active} className={`ds-tool ${active ? 'is-active' : ''} ${props.className ?? ''}`}>{children}</button>
}
