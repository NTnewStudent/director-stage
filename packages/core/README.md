# @director-stage/core

A 3D director stage React component for AI video models (Seedance, Kling, Omni, H3 and similar). Stage characters, props, and cameras in 3D, then export a clean still, a camera-motion preview clip, or a camera-language prompt into the generator.

Full docs and playground: [github.com/NTnewStudent/director-stage](https://github.com/NTnewStudent/director-stage) · API reference: [docs/api.md](https://github.com/NTnewStudent/director-stage/blob/main/docs/api.md)

## Install

```bash
npm install @director-stage/core react react-dom three @react-three/fiber @react-three/drei
```

Peer dependencies: `react` 18 or 19, `react-dom`, `three` ^0.185, `@react-three/fiber` ^9, `@react-three/drei` ^10.

Styles are injected automatically when you import the component; no separate CSS import is needed.

## Usage

```tsx
import { DirectorStage, DirectorHostFactory } from '@director-stage/core'

const host = DirectorHostFactory.create({
  documents: {
    load: async (key) => null,
    save: async (key, document) => {
      // Persist scene JSON in your backend
    },
  },
  onShotText: (text) => {
    // Chinese camera-language prompt derived from the active camera
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
        // result.blob is a PNG still (mimeType, width, height, cameraId, frame)
      }}
      onVideoExport={(result) => {
        // result.blob is a preview video (WebM or MP4)
      }}
    />
  )
}
```

`DirectorHostFactory.browser()` is a zero-config host that stores the scene in `localStorage` and downloads captured media. Use `create()` when the parent app owns storage and upload.

### Imperative handle

```tsx
import { useRef } from 'react'
import type { DirectorStageHandle } from '@director-stage/core'

const stage = useRef<DirectorStageHandle>(null)

await stage.current?.capture()       // fires onImageCapture
await stage.current?.record()        // fires onVideoExport
stage.current?.getShotText()         // camera-language prompt
stage.current?.setLocale('ja-JP')
```

## Exports

- `DirectorStage` – the workbench component
- `DirectorHostFactory` – `browser()` / `create()` host builders
- `DirectorDocument` – scene JSON type and `DirectorDocument.create()` factory
- `DirectorStageError` – typed error wrapper
- Types: `DirectorStageProps`, `DirectorStageHandle`, `DirectorHost`, `DirectorDocumentStore`, `DirectorMediaStore`, `ImageCaptureResult`, `VideoExportResult`, `RecordingResult`, `CaptureMeta`, `RecordMeta`, `Locale`, `Theme`

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
