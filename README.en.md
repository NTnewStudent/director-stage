# Director Stage

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

A 3D director stage for Seedance, H3, Kling, Omni, and similar video models. Use it to **direct camera motion, lay out the scene, and place talent**.

Stage characters, props, and cameras in 3D, then export a clean still or a preview clip into the generator.

- Package: `@director-stage/core`
- Component: `<DirectorStage />`
- License: Apache-2.0
- API: [docs/api.md](docs/api.md)

## What it does

| | |
| :--- | :--- |
| **Camera** | Independent filming cameras, focal length, roll, one-click coverage presets, procedural camera moves |
| **Scene** | Characters and props, composition, grid and labels |
| **Blocking** | Position / facing / scale, path clips, keyframes |

Captures and exports omit the grid, gizmos, and labels, so they can feed Seedance, Kling, and similar models.

## Install

```bash
npm install @director-stage/core react react-dom three @react-three/fiber @react-three/drei
```

Peers: `react` 18 or 19, `three` ^0.185, `@react-three/fiber`, `@react-three/drei`.

## Usage

```tsx
import { DirectorStage, DirectorHostFactory } from '@director-stage/core'

const host = DirectorHostFactory.create({
  documents: {
    load: async (key) => null,
    save: async (key, document) => {
      // Persist scene JSON in the host (Seedance / Kling / your backend)
    },
  },
})

export function App() {
  return (
    <DirectorStage
      documentKey="scene"
      host={host}
      locale="en-US"
      style={{ height: '100vh' }}
      onImageCapture={(result) => {
        // result.blob is a PNG still
      }}
      onVideoExport={(result) => {
        // result.blob is a preview video (WebM or MP4)
      }}
    />
  )
}
```

Workbench **Capture / Export**, or `ref.capture()` / `ref.record()`, all fire the same callbacks.

| Callback | Payload |
| :--- | :--- |
| `onImageCapture` | `blob`, `mimeType`, `width`, `height`, `cameraId`, `frame` |
| `onVideoExport` | `blob`, `mimeType`, `extension`, `duration`, `width`, `height`, `cameraId` |

**Copy shot text** derives a **Chinese camera prompt** from the active camera and first character (coverage, camera height, facing, focal length), for example `广角全身镜头，膝高机位，右侧四分之三侧面，24mm`. That string is model prompt content, not UI chrome, so it does not follow the workbench locale. The button copies it; hosts can implement `onShotText`, or call `ref.getShotText()` / `ref.writeShotText()`.

`DirectorHostFactory.browser()` writes the scene to `localStorage` and downloads media. For a generator host, use `create()` and handle storage and upload yourself.

`locale`: `'zh-CN'` (default) `| 'en-US' | 'ja-JP'`. The header switches theme and UI language. Omit `locale` and pass `defaultLocale` if the workbench should keep its own language state.

Full surface: [docs/api.md](docs/api.md).

## Run locally

```bash
npm install
npm run dev          # full-screen workbench
npm run example      # the single example: embed + capture/export callbacks
npm test
```

The example lives in [`examples/embed`](examples/embed).

## Deploy

The playground is a static site. 3D runs in the browser.

```bash
docker compose up --build
```

Vercel: `vercel.json` is at the repo root. Keep **Root Directory** as the repository root.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

```bash
npx vercel
```

## License

Apache License 2.0
