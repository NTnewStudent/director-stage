import { forwardRef, useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { ensureDirectorI18n } from './i18n/setup'
import { wrapDirectorError } from './host/errors'
import type { DirectorStageHandle, DirectorStageProps, Locale, Theme } from './host/types'
import { createDirectorDocument, normalizeDirectorDocument, type DirectorDocument } from './studio/model'
import { StudioEditor } from './studio/DirectorStudio'
import { useDirectorText } from './studio/text'
import './theme/design-tokens.css'
import './theme/studio.css'

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'en-US' || value === 'ja-JP'
}

/** Public director-stage workbench.
 * @param props Host, document key, optional locale/theme/document and callbacks.
 * @returns Full studio filling the parent box.
 * @throws Invalid documents render an error panel instead of overwriting storage.
 */
export const DirectorStage = forwardRef<DirectorStageHandle, DirectorStageProps>(function DirectorStage(props, ref) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading')
  const [initial, setInitial] = useState<DirectorDocument | null>(null)
  const [uncontrolledTheme, setUncontrolledTheme] = useState<Theme>(props.defaultTheme ?? 'dark')
  const [uncontrolledLocale, setUncontrolledLocale] = useState<Locale>(props.defaultLocale ?? 'zh-CN')
  const theme = props.theme ?? uncontrolledTheme
  const locale = props.locale ?? uncontrolledLocale
  ensureDirectorI18n(locale)
  const handle = useRef<DirectorStageHandle | null>(null)
  const themeRef = useRef(theme)
  const localeRef = useRef(locale)
  const alive = useRef(true)
  themeRef.current = theme
  localeRef.current = locale
  const applyTheme = (next: Theme) => {
    if (!isTheme(next)) return
    const previous = themeRef.current
    if (props.theme === undefined) {
      themeRef.current = next
      setUncontrolledTheme(next)
    }
    if (next !== previous) props.onThemeChange?.(next)
  }
  const applyLocale = (next: Locale) => {
    if (!isLocale(next)) return
    const previous = localeRef.current
    if (props.locale === undefined) {
      localeRef.current = next
      setUncontrolledLocale(next)
    }
    if (next !== previous) props.onLocaleChange?.(next)
  }
  const applyThemeRef = useRef(applyTheme)
  const applyLocaleRef = useRef(applyLocale)
  applyThemeRef.current = applyTheme
  applyLocaleRef.current = applyLocale

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    void props.host.documents.load(props.documentKey).then((loaded) => {
      if (cancelled) return
      try {
        if (loaded) {
          const document = normalizeDirectorDocument(loaded)
          setInitial(document)
          props.onLoad?.(document)
        } else {
          setInitial(props.defaultDocument ? normalizeDirectorDocument(props.defaultDocument) : createDirectorDocument())
        }
        setStatus('ready')
      } catch (error) {
        setStatus('invalid')
        props.onError?.(wrapDirectorError('INVALID_DOCUMENT', error))
      }
    }).catch((error: unknown) => {
      if (cancelled) return
      setStatus('invalid')
      props.onError?.(wrapDirectorError('LOAD_FAILED', error))
    })
    return () => { cancelled = true }
    // Reload when the storage key changes, not when callback identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.documentKey, props.defaultDocument, props.host])

  useEffect(() => {
    alive.current = true
    if (!ref) return
    const requireMounted = () => {
      if (!alive.current) throw wrapDirectorError('NOT_MOUNTED', new Error('DirectorStage is not mounted'))
    }
    const proxy: DirectorStageHandle = {
      getDocument: () => requireHandle(handle.current).getDocument(),
      setDocument: (document) => requireHandle(handle.current).setDocument(document),
      save: () => requireHandle(handle.current).save(),
      load: (key) => requireHandle(handle.current).load(key),
      capture: (options) => requireHandle(handle.current).capture(options),
      record: (options) => requireHandle(handle.current).record(options),
      getShotText: () => requireHandle(handle.current).getShotText(),
      writeShotText: () => requireHandle(handle.current).writeShotText(),
      getTheme: () => { requireMounted(); return themeRef.current },
      setTheme: (next) => { requireMounted(); applyThemeRef.current(next) },
      getLocale: () => { requireMounted(); return localeRef.current },
      setLocale: (next) => { requireMounted(); applyLocaleRef.current(next) },
    }
    if (typeof ref === 'function') ref(proxy)
    else ref.current = proxy
    return () => { alive.current = false }
  }, [ref, status])

  return (
    <div className={props.className} style={{ height: '100%', minHeight: 0, ...props.style }} data-director-stage-theme={theme}>
      <Toaster position="top-center" />
      {status === 'ready' && initial ? (
        <StudioEditor
          ref={handle}
          initial={initial}
          documentKey={props.documentKey}
          host={props.host}
          theme={theme}
          onThemeChange={applyTheme}
          locale={locale}
          onLocaleChange={applyLocale}
          onChange={props.onChange}
          onSave={props.onSave}
          onCapture={props.onCapture}
          onRecord={props.onRecord}
          onImageCapture={props.onImageCapture}
          onVideoExport={props.onVideoExport}
          onError={props.onError}
        />
      ) : (
        <StatusPanel status={status === 'invalid' ? 'invalid' : 'loading'} />
      )}
    </div>
  )
})

function requireHandle(handle: DirectorStageHandle | null): DirectorStageHandle {
  if (!handle) throw wrapDirectorError('NOT_MOUNTED', new Error('DirectorStage is not mounted'))
  return handle
}

function StatusPanel({ status }: { status: 'loading' | 'invalid' }) {
  const text = useDirectorText()
  return (
    <div className="director-studio">
      <div className="ds-dialog">
        <div className="ds-dialog-content">
          <p>{status === 'invalid' ? text('futureVersion') : '…'}</p>
        </div>
      </div>
    </div>
  )
}
