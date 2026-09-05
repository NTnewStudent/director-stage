import { describe, expect, it } from 'vitest'
import zh from './zh-CN.json'
import en from './en-US.json'
import ja from './ja-JP.json'
import { ensureDirectorI18n } from './setup'

function keys(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => keys(nested, prefix ? `${prefix}.${key}` : key))
  }
  return prefix ? [prefix] : []
}

describe('director locales', () => {
  it('keeps zh-CN, en-US and ja-JP keys aligned', () => {
    const chinese = keys(zh).sort()
    expect(keys(en).sort()).toEqual(chinese)
    expect(keys(ja).sort()).toEqual(chinese)
  })

  it('resolves Japanese chrome without changing the active language', () => {
    ensureDirectorI18n('zh-CN')
    const i18n = ensureDirectorI18n('zh-CN')
    expect(i18n.getFixedT('ja-JP', 'directorStudio')('title')).toBe('監督台')
    expect(i18n.language).toBe('zh-CN')
  })
})
