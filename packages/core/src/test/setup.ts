import '@testing-library/jest-dom/vitest'
import { ensureDirectorI18n } from '../i18n/setup'

ensureDirectorI18n('zh-CN')

/** Node 22+ exposes an experimental `localStorage` getter that is undefined without `--localstorage-file`. */
function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

const testStorage = createMemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: testStorage })
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: testStorage })
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
