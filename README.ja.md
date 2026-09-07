# Director Stage

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

Seedance、H3、Kling、Omni などの映像生成向け **3D 監督台**です。**カメラワーク、シーン、立ち位置**を制御します。

キャラクター・小道具・カメラを 3D 空間に配置し、クリーンなスチルまたはプレビュー動画を生成モデルへ渡します。

- パッケージ: `@director-stage/core`
- コンポーネント: `<DirectorStage />`
- ライセンス: MIT
- API: [日本語](docs/api.ja.md) · [中文](docs/api.md) · [English](docs/api.en.md)

## できること

| | |
| :--- | :--- |
| **カメラワーク** | 独立カメラ、焦点距離、ロール、ワンクリック画角プリセット、手続き型カメラワーク |
| **シーン** | キャラクターと小道具、構図、グリッドとラベル |
| **立ち位置** | 位置 / 向き / スケール、移動パス、キーフレーム |

キャプチャと書き出しにグリッド・ギズモ・ラベルは含まれません。Seedance や Kling などの入力に使えます。

## インストール

```bash
npm install @director-stage/core react react-dom three @react-three/fiber @react-three/drei
```

Peer: `react` 18 または 19、`three` ^0.185、`@react-three/fiber`、`@react-three/drei`。

## 使い方

```tsx
import { DirectorStage, DirectorHostFactory } from '@director-stage/core'

const host = DirectorHostFactory.create({
  documents: {
    load: async (key) => null,
    save: async (key, document) => {
      // シーン JSON をホスト（Seedance / Kling / 自前バックエンド）へ保存
    },
  },
})

export function App() {
  return (
    <DirectorStage
      documentKey="scene"
      host={host}
      locale="ja-JP"
      style={{ height: '100vh' }}
      onImageCapture={(result) => {
        // result.blob は PNG スチル
      }}
      onVideoExport={(result) => {
        // result.blob はプレビュー動画（WebM または MP4）
      }}
    />
  )
}
```

作業台の「キャプチャ / 書き出し」、または `ref.capture()` / `ref.record()` は同じコールバックを発火します。

| コールバック | 結果 |
| :--- | :--- |
| `onImageCapture` | `blob`、`mimeType`、`width`、`height`、`cameraId`、`frame` |
| `onVideoExport` | `blob`、`mimeType`、`extension`、`duration`、`width`、`height`、`cameraId` |

「ショットテキストをコピー」は、現在のカメラと最初のキャラクターから**中国語のカメラワーク記述**（画角、カメラ高さ、向き、焦点距離）を導きます。例: `广角全身镜头，膝高机位，右侧四分之三侧面，24mm`。これは Seedance / Kling / Omni 向けのプロンプト本文で、作業台の UI 言語には追従しません。ボタンでクリップボードへコピーします。埋め込み時は `onShotText`、または `ref.getShotText()` / `ref.writeShotText()` を使います。

`DirectorHostFactory.browser()` はシーンを `localStorage` に書き、メディアはダウンロードします。生成ホストに埋め込むときは `create()` を使い、保存とアップロードは呼び出し側で行います。

`locale`: `'zh-CN'`（既定）`| 'en-US' | 'ja-JP'`。ヘッダーでテーマと UI 言語を切り替えられます。`locale` を渡さず `defaultLocale` を使うと、作業台が言語を自己管理します。

公開 API は [docs/api.ja.md](docs/api.ja.md) を参照してください。

## ローカル実行

```bash
npm install
npm run dev          # 全画面の作業台
npm run example      # 唯一の example：埋め込み + キャプチャ/書き出しコールバック
npm test
```

Example は [`examples/embed`](examples/embed) です。

## デプロイ

Playground は静的サイトです。3D はブラウザで動きます。

```bash
docker compose up --build
```

Vercel: リポジトリルートの `vercel.json` を使います。**Root Directory はリポジトリルートのまま**にしてください。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

```bash
npx vercel
```

## License

MIT
