import { useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { DirectorHostFactory, DirectorStage } from '@director-stage/core'

/**
 * Minimal host embed. Seedance / H3 / Kling / Omni (or any parent app) mounts
 * DirectorStage, then receives stills, preview clips, and shot language.
 */
function App() {
  const host = useMemo(() => DirectorHostFactory.create({
    documents: {
      async load() {
        return null
      },
      async save() {
        /* Persist scene JSON in the host app if needed. */
      },
    },
    onShotText: (text) => {
      // Chinese camera language for Seedance / Kling / Omni prompts.
      console.info('onShotText', text)
    },
  }), [])

  return (
    <DirectorStage
      documentKey="scene"
      host={host}
      defaultLocale="zh-CN"
      style={{ height: '100vh' }}
      onImageCapture={(result) => {
        // Still frame for the video model (blob, mimeType, width, height, cameraId, frame).
        console.info('onImageCapture', result.mimeType, result.width, result.height, result.blob.size)
      }}
      onVideoExport={(result) => {
        // Camera-motion preview clip (blob, mimeType, extension, duration).
        console.info('onVideoExport', result.mimeType, result.duration, result.blob.size)
      }}
    />
  )
}

createRoot(document.getElementById('app')!).render(<App />)
