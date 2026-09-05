import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@director-stage/core': path.resolve(root, '../../packages/core/src/index.ts'),
    },
  },
  server: { host: true, port: 5173 },
})
