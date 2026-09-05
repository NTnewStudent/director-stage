import { afterEach, describe, expect, it } from 'vitest'
import i18n from 'i18next'
import { ensureDirectorI18n } from '../i18n/setup'
import { defaultCameraName, defaultCopyName, defaultObjectName, labelEntityName } from './labels'

function t(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, { ns: 'directorStudio', ...options })
}

afterEach(() => {
  ensureDirectorI18n('zh-CN')
})

describe('default entity names', () => {
  it('generate numbered names in the active UI language', () => {
    ensureDirectorI18n('ja-JP')
    expect(defaultObjectName('mannequin', 1)).toBe('キャラクター 1')
    expect(defaultCameraName(1)).toBe('カメラ 1')
    expect(defaultObjectName('box', 2)).toBe('小道具 2')
    expect(defaultCopyName('キャラクター 1')).toBe('キャラクター 1 のコピー')
  })
})

describe('labelEntityName', () => {
  it('remaps numbered character, camera and prop names across locales', () => {
    ensureDirectorI18n('ja-JP')
    expect(labelEntityName({ name: '角色 1' }, 'ja-JP', t)).toBe('キャラクター 1')
    expect(labelEntityName({ name: '机位 1' }, 'ja-JP', t)).toBe('カメラ 1')
    expect(labelEntityName({ name: '道具 3' }, 'ja-JP', t)).toBe('小道具 3')
    expect(labelEntityName({ name: 'Character 2' }, 'ja-JP', t)).toBe('キャラクター 2')
    expect(labelEntityName({ name: 'Camera 1' }, 'ja-JP', t)).toBe('カメラ 1')
    ensureDirectorI18n('en-US')
    expect(labelEntityName({ name: '角色 1' }, 'en-US', t)).toBe('Character 1')
    expect(labelEntityName({ name: '机位 1' }, 'en-US', t)).toBe('Camera 1')
    expect(labelEntityName({ name: 'キャラクター 1' }, 'en-US', t)).toBe('Character 1')
  })

  it('remaps camera presets including uniqueness suffixes', () => {
    ensureDirectorI18n('ja-JP')
    expect(labelEntityName({ name: '正面中景' }, 'ja-JP', t)).toBe('正面ミディアム')
    expect(labelEntityName({ name: '正面中景 2' }, 'ja-JP', t)).toBe('正面ミディアム 2')
    expect(labelEntityName({ name: 'Dutch Angle' }, 'ja-JP', t)).toBe('ダッチアングル')
  })

  it('remaps catalog props and duplicate suffixes without rewriting custom names', () => {
    ensureDirectorI18n('ja-JP')
    expect(labelEntityName({ name: '木椅', propId: 'chair' }, 'ja-JP', t)).toBe('木製椅子')
    expect(labelEntityName({ name: '角色 1 副本' }, 'ja-JP', t)).toBe('キャラクター 1 のコピー')
    expect(labelEntityName({ name: 'Alice' }, 'ja-JP', t)).toBe('Alice')
  })
})
