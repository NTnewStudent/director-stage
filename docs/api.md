# @director-stage/core API

[中文](api.md) · [English](api.en.md) · [日本語](api.ja.md)

MIT。公开符号以 `packages/core/src/index.ts` 为准。

## 安装

```bash
npm install @director-stage/core react react-dom three @react-three/fiber @react-three/drei
```

## 30 秒用法

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

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `documentKey` | `string` | 是 | 传给 `documents.load/save` 的键。不要用 React 的 `key` |
| `host` | `DirectorHost` | 是 | `DirectorHostFactory.browser()` 或 `create()` |
| `locale` | `'zh-CN' \| 'en-US' \| 'ja-JP'` | 否 | 受控界面语言。不传则组件自己记 |
| `defaultLocale` | `'zh-CN' \| 'en-US' \| 'ja-JP'` | 否 | 非受控初始语言，默认 `zh-CN` |
| `theme` | `'dark' \| 'light'` | 否 | 受控主题。不传则组件自己记 |
| `defaultTheme` | `'dark' \| 'light'` | 否 | 非受控初始主题，默认 `dark` |
| `defaultDocument` | `DirectorDocument` | 否 | 仅当 `load` 返回 `null` |
| `className` / `style` | | 否 | 根节点；调用方负责高度 |
| `onChange` / `onSave` / `onLoad` / `onThemeChange` / `onLocaleChange` / `onError` | | 否 | 文档、主题、语言与错误 |
| `onImageCapture` | `(result: ImageCaptureResult) => void` | 否 | 截图成功。含 `blob` 与机位/尺寸 |
| `onVideoExport` | `(result: VideoExportResult) => void` | 否 | 视频导出成功。含 `blob`、MIME、时长 |

工作台里点截图/导出，或调用 `ref.capture()` / `ref.record()`，都会触发对应回调。用户取消录制不触发 `onVideoExport`。

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

挂载后：`load(documentKey)` → `defaultDocument` → `DirectorDocument.create()`。无法归一化的文档显示错误，不覆盖存储。

## DirectorStageHandle

卸载后调用抛 `NOT_MOUNTED`。

| 方法 | 抛出 |
| :--- | :--- |
| `getDocument()` / `setDocument(doc)` | `NOT_MOUNTED`, `INVALID_DOCUMENT` |
| `save()` | `SAVE_FAILED`, `INVALID_HOST` |
| `load(key?)` | `LOAD_FAILED`, `INVALID_DOCUMENT` |
| `capture(options?)` | `NOT_MOUNTED`, `CAPTURE_FAILED` |
| `record(options?)` | `NOT_MOUNTED`, `RECORD_FAILED`, `RECORD_UNAVAILABLE`, `ABORTED` |
| `getShotText()` / `writeShotText()` | `NOT_MOUNTED` |
| `getTheme()` / `setTheme('dark' \| 'light')` | `NOT_MOUNTED` |
| `getLocale()` / `setLocale('zh-CN' \| 'en-US' \| 'ja-JP')` | `NOT_MOUNTED` |

`getShotText()` 返回当前活动机位相对第一个角色的中文运镜描述（景别、机位高度、朝向、焦距）。`writeShotText()` 把同一段文字交给 `host.onShotText`（若提供）并复制到剪贴板。工作台顶部「复制镜头文本」走同一条路径。这段文本是给 Seedance / Kling 等的 prompt，不随 `locale` 切换。

`ABORTED` 不触发 `onError`、不 toast。

## DirectorHostFactory

- `browser({ prefix? })`：`localStorage` 键 ``${prefix}:${documentKey}``，媒体触发下载。
- `create(host)`：校验 `documents.load/save`，否则 `INVALID_HOST`。

## 非公开

内部 `StudioEditor`、three 视口、poses 表、画布节点与上传 API 均不导出。

可运行的嵌入示例见仓库 [`examples/embed`](../examples/embed)。
