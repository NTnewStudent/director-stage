import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** Everything the consumer already installs stays external, including subpath imports like `three/examples/...`. */
const externalPackages = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]
const external = new RegExp(`^(?:${externalPackages.map((name) => name.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})(?:/|$)`)

export default defineConfig({
  plugins: [
    react(),
    // Emits `import './index.css'` at the top of the bundle so consumers get styles without a manual import.
    libInjectCss(),
    dts({
      tsconfigPath: path.join(root, 'tsconfig.lib.json'),
      exclude: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/test/**'],
    }),
  ],
  build: {
    lib: {
      entry: path.join(root, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    sourcemap: true,
    copyPublicDir: false,
    rolldownOptions: {
      external,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
