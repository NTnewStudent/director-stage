# @director-stage/core API

[中文](api.md) · [English](api.en.md) · [日本語](api.ja.md)

MIT。公開シンボルは `packages/core/src/index.ts` の export に準拠します。

## インストール

```bash
npm install @director-stage/core react react-dom three @react-three/fiber @react-three/drei
```

## 30 秒で使う

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

| プロパティ | 型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `documentKey` | `string` | はい | `documents.load/save` に渡すキー。React のリスト `key` ではない。 |
| `host` | `DirectorHost` | はい | `DirectorHostFactory.browser()` または `create()` |
| `locale` | `'zh-CN' \| 'en-US' \| 'ja-JP'` | いいえ | 制御された UI 言語。省略するとコンポーネントが自身で保持する。 |
| `defaultLocale` | `'zh-CN' \| 'en-US' \| 'ja-JP'` | いいえ | 非制御の初期言語。デフォルトは `zh-CN`。 |
| `theme` | `'dark' \| 'light'` | いいえ | 制御されたテーマ。省略するとコンポーネントが自身で保持する。 |
| `defaultTheme` | `'dark' \| 'light'` | いいえ | 非制御の初期テーマ。デフォルトは `dark`。 |
| `defaultDocument` | `DirectorDocument` | いいえ | `load` が `null` を返したときだけ使う。 |
| `className` / `style` | | いいえ | ルートノード。高さは呼び出し側の責任。 |
| `onChange` / `onSave` / `onLoad` / `onThemeChange` / `onLocaleChange` / `onError` | | いいえ | ドキュメント、テーマ、言語、エラー。 |
| `onImageCapture` | `(result: ImageCaptureResult) => void` | いいえ | 静止画キャプチャ成功。`blob` とカメラ/サイズを含む。 |
| `onVideoExport` | `(result: VideoExportResult) => void` | いいえ | 動画エクスポート成功。`blob`、MIME、尺を含む。 |

ワークベンチのキャプチャ/エクスポート、または `ref.capture()` / `ref.record()` は同じコールバックを発火する。録画をキャンセルしても `onVideoExport` は発火しない。

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

マウント後の解決順: `load(documentKey)` → `defaultDocument` → `DirectorDocument.create()`。正規化できないドキュメントはエラー表示し、ストレージは上書きしない。

## DirectorStageHandle

アンマウント後に呼ぶと `NOT_MOUNTED` を投げる。

| メソッド | 例外 |
| :--- | :--- |
| `getDocument()` / `setDocument(doc)` | `NOT_MOUNTED`, `INVALID_DOCUMENT` |
| `save()` | `SAVE_FAILED`, `INVALID_HOST` |
| `load(key?)` | `LOAD_FAILED`, `INVALID_DOCUMENT` |
| `capture(options?)` | `NOT_MOUNTED`, `CAPTURE_FAILED` |
| `record(options?)` | `NOT_MOUNTED`, `RECORD_FAILED`, `RECORD_UNAVAILABLE`, `ABORTED` |
| `getShotText()` / `writeShotText()` | `NOT_MOUNTED` |
| `getTheme()` / `setTheme('dark' \| 'light')` | `NOT_MOUNTED` |
| `getLocale()` / `setLocale('zh-CN' \| 'en-US' \| 'ja-JP')` | `NOT_MOUNTED` |

`getShotText()` は、現在の撮影カメラと最初のキャラクターから導出した**中国語のカメラ言語プロンプト**（画角、カメラ高、向き、焦点距離）を返す。`writeShotText()` は同じ文字列を `host.onShotText`（あれば）へ渡し、クリップボードにもコピーする。ワークベンチ上部の「ショットテキストをコピー」も同じ経路。この文字列は Seedance / Kling などへの prompt であり UI 文言ではないため、`locale` には追従しない。

`ABORTED` は `onError` を発火せず、toast も出さない。

## DirectorHostFactory

- `browser({ prefix? })`: `localStorage` キーは ``${prefix}:${documentKey}``。メディアはダウンロードを開始する。
- `create(host)`: `documents.load/save` を検証し、不正なら `INVALID_HOST`。

## 非公開

内部の `StudioEditor`、three ビューポート、ポーズ表、キャンバスノード、アップロード API は export されない。

実行可能な埋め込み例はリポジトリの [`examples/embed`](../examples/embed) を参照。
