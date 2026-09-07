# @director-stage/core API

[中文](api.md) · [English](api.en.md) · [日本語](api.ja.md)

MIT. Public symbols are those exported from `packages/core/src/index.ts`.

## Install

```bash
npm install @director-stage/core react react-dom three @react-three/fiber @react-three/drei
```

## 30-second usage

```tsx
import { useRef } from 'react'
import { DirectorStage, DirectorHostFactory } from '@director-stage/core'
import type { DirectorStageHandle } from '@director-stage/core'

const host = DirectorHostFactory.browser()

export function App() {
  const stage = useRef<DirectorStageHandle>(null)
  return (
    <DirectorStage
      ref={stage}
      documentKey="demo"
      host={host}
      style={{ height: '100vh' }}
    />
  )
}
```

## DirectorStageProps

| Prop | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `documentKey` | `string` | yes | Key passed to `documents.load/save`. Not a React list `key`. |
| `host` | `DirectorHost` | yes | `DirectorHostFactory.browser()` or `create()` |
| `locale` | `'zh-CN' \| 'en-US' \| 'ja-JP'` | no | Controlled UI language. Omit to let the component keep its own state. |
| `defaultLocale` | `'zh-CN' \| 'en-US' \| 'ja-JP'` | no | Uncontrolled initial language. Default `zh-CN`. |
| `theme` | `'dark' \| 'light'` | no | Controlled theme. Omit to let the component keep its own state. |
| `defaultTheme` | `'dark' \| 'light'` | no | Uncontrolled initial theme. Default `dark`. |
| `defaultDocument` | `DirectorDocument` | no | Used only when `load` returns `null`. |
| `className` / `style` | | no | Root node. The caller is responsible for height. |
| `onChange` / `onSave` / `onLoad` / `onThemeChange` / `onLocaleChange` / `onError` | | no | Document, theme, locale, and errors. |
| `onImageCapture` | `(result: ImageCaptureResult) => void` | no | Fired after a still capture. Includes `blob` plus camera/size. |
| `onVideoExport` | `(result: VideoExportResult) => void` | no | Fired after a video export. Includes `blob`, MIME, and duration. |

Workbench **Capture / Export**, or `ref.capture()` / `ref.record()`, all fire the same callbacks. Cancelling a recording does not fire `onVideoExport`.

```tsx
<DirectorStage
  documentKey="demo"
  host={host}
  style={{ height: '100vh' }}
  onImageCapture={(result) => {
    // result.blob / mimeType / width / height / cameraId / frame
  }}
  onVideoExport={(result) => {
    // result.blob / mimeType / extension / duration / width / height / cameraId
  }}
/>
```

After mount: `load(documentKey)` → `defaultDocument` → `DirectorDocument.create()`. Documents that cannot be normalized show an error panel and do not overwrite storage.

## DirectorStageHandle

Calling these after unmount throws `NOT_MOUNTED`.

| Method | Throws |
| :--- | :--- |
| `getDocument()` / `setDocument(doc)` | `NOT_MOUNTED`, `INVALID_DOCUMENT` |
| `save()` | `SAVE_FAILED`, `INVALID_HOST` |
| `load(key?)` | `LOAD_FAILED`, `INVALID_DOCUMENT` |
| `capture(options?)` | `NOT_MOUNTED`, `CAPTURE_FAILED` |
| `record(options?)` | `NOT_MOUNTED`, `RECORD_FAILED`, `RECORD_UNAVAILABLE`, `ABORTED` |
| `getShotText()` / `writeShotText()` | `NOT_MOUNTED` |
| `getTheme()` / `setTheme('dark' \| 'light')` | `NOT_MOUNTED` |
| `getLocale()` / `setLocale('zh-CN' \| 'en-US' \| 'ja-JP')` | `NOT_MOUNTED` |

`getShotText()` returns a **Chinese camera-language prompt** derived from the active camera relative to the first character (coverage, camera height, facing, focal length). `writeShotText()` sends the same string to `host.onShotText` (if provided) and copies it to the clipboard. The workbench **Copy shot text** button uses that path. The string is model prompt content, not UI chrome, so it does not follow `locale`.

`ABORTED` does not fire `onError` and does not toast.

## DirectorHostFactory

- `browser({ prefix? })`: `localStorage` key ``${prefix}:${documentKey}``; media triggers a download.
- `create(host)`: validates `documents.load/save`, otherwise `INVALID_HOST`.

## Not public

Internal `StudioEditor`, the three viewport, pose tables, canvas nodes, and upload APIs are not exported.

A runnable embed example lives in [`examples/embed`](../examples/embed).
