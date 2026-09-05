import i18n from 'i18next'
import zh from '../i18n/zh-CN.json'
import en from '../i18n/en-US.json'
import ja from '../i18n/ja-JP.json'
import { DIRECTOR_PROP_CATALOG } from './catalog'
import type { DirectorCameraPresetKey } from '../scene/director-camera-presets'

const PACKS = [zh, en, ja] as const
const EN_CATEGORIES: Record<string, string> = {
  '基础形状': 'Primitives', '建筑': 'Architecture', '家具': 'Furniture', '生活': 'Everyday objects',
  '电子': 'Electronics', '交通': 'Transport', '自然': 'Nature', '动作': 'Actions', '路径': 'Paths',
  '基础': 'Basic', '跟拍': 'Follow', '镜头': 'Lens', '空间': 'Spatial',
  '基础运镜': 'Basic camera motion', '空间运镜': 'Spatial camera motion', '镜头效果': 'Lens effects',
}
const JA_CATEGORIES: Record<string, string> = {
  '基础形状': '基本形状', '建筑': '建築', '家具': '家具', '生活': '生活',
  '电子': '電子機器', '交通': '交通', '自然': '自然', '动作': 'アクション', '路径': 'パス',
  '基础': '基本', '跟拍': 'フォロー', '镜头': 'レンズ', '空间': '空間',
  '基础运镜': '基本カメラワーク', '空间运镜': '空間カメラワーク', '镜头效果': 'レンズ効果',
}
const EN_DESCRIPTIONS: Record<string, string> = {
  walk: 'Alternating walk cycle in place; combine with a forward path to move.',
  run: 'Faster running gait with vertical body motion.', wave: 'Raise the right arm and wave.',
  sit: 'Smoothly transition from standing into a held sitting pose.', nod: 'Nod the head up and down.',
  bow: 'Lean forward to bow, then return upright.', jump: 'Bend the knees, jump and land.',
  turn: 'Turn halfway around on the spot.', 'path-forward': 'Move along the character’s forward axis; amount is in meters.',
  'path-side': 'Move sideways relative to the character; amount is in meters.', 'path-circle': 'Follow a circular path with a tangent-facing orientation.',
  push: 'Move the camera toward its look-at target.', pull: 'Move the camera away from its look-at target.',
  orbit: 'Rotate the camera around the target.', pan: 'Sweep the look-at direction horizontally.',
  rise: 'Raise both camera and target.', fall: 'Lower both camera and target.', truck: 'Move camera and target sideways.',
  'zoom-in': 'Increase focal length without moving the camera.', 'zoom-out': 'Decrease focal length without moving the camera.',
  crane: 'Move upward and away from the target.', roll: 'Rotate the image around the optical axis.', handheld: 'Add subtle deterministic handheld movement.',
}
const JA_NAMES: Record<string, string> = {
  cube: '立方体', sphere: '球体', cylinder: '円柱', cone: '円錐', capsule: 'カプセル', platform: 'プラットフォーム',
  wall: '壁', doorway: 'ドア枠', window: '窓枠', stairs: '階段', pillar: '柱', room: '部屋',
  'office-tower': 'オフィスタワー', 'glass-tower': 'ガラスビル', 'setback-tower': 'セットバックビル',
  'spire-tower': '尖塔ビル', 'twin-towers': 'ツインタワー', 'slab-tower': 'スラブ住宅',
  chair: '木製椅子', stool: '丸椅子', table: 'ダイニングテーブル', 'round-table': '円卓', sofa: 'ソファ',
  bed: 'ベッド', bookshelf: '本棚', cabinet: 'キャビネット', bench: 'ベンチ', lamp: 'フロアランプ',
  vase: '花瓶', bottle: 'ボトル', cup: 'カップ', book: '本', screen: 'モニター', laptop: 'ノートPC',
  phone: 'スマートフォン', car: '自動車', van: 'バン', road: '道路', tree: '木', pine: '松', rock: '岩', plant: '盆栽',
  walk: '歩行', run: '走行', wave: '手を振る', sit: '座る', nod: 'うなずく', bow: 'お辞儀', jump: 'ジャンプ',
  turn: '方向転換', 'path-forward': '前方移動', 'path-side': '横移動', 'path-circle': '円移動',
  push: 'プッシュイン', pull: 'プルバック', orbit: 'オービット', pan: 'パン', rise: 'ライズ', fall: 'フォール',
  truck: 'トラック', 'zoom-in': 'ズームイン', 'zoom-out': 'ズームアウト', crane: 'クレーン', handheld: '手持ち揺れ', roll: 'ロール',
}
const JA_DESCRIPTIONS: Record<string, string> = {
  walk: 'その場で左右交互の歩行。前方パスと組み合わせて移動できる。',
  run: '上下動のある、より速いその場走行。',
  wave: '右腕を上げて振る。',
  sit: '立ち姿勢から座位へ滑らかに遷移する。',
  nod: '頭を上下にうなずく。',
  bow: '前傾してお辞儀し、直立に戻る。',
  jump: '膝を曲げて跳び、着地する。',
  turn: 'その場で半回転する。',
  'path-forward': 'キャラクターの正面方向へ移動。量はメートル。',
  'path-side': 'キャラクターの右方向へ横移動。量はメートル。',
  'path-circle': '円弧を進み、接線方向を向く。',
  push: '注視点へカメラを近づける。',
  pull: '注視点からカメラを遠ざける。',
  orbit: '注視点の周りを回転する。',
  pan: 'カメラ位置は固定し、視線を水平に振る。',
  rise: 'カメラと注視点を同時に上げる。',
  fall: 'カメラと注視点を同時に下げる。',
  truck: '構図の向きを保ったまま横移動する。',
  'zoom-in': 'カメラを動かさず焦点距離を伸ばす。',
  'zoom-out': 'カメラを動かさず焦点距離を縮める。',
  crane: '対象を見続けながら斜め上後方へ移動する。',
  roll: '光軸まわりに画面を回転する。',
  handheld: '再現可能な、ごく弱い手持ち揺れ。',
}
const NUMBERED: Record<string, 'entityCharacter' | 'entityCamera' | 'entityProp'> = {
  角色: 'entityCharacter', Character: 'entityCharacter', キャラクター: 'entityCharacter',
  机位: 'entityCamera', Camera: 'entityCamera', カメラ: 'entityCamera',
  道具: 'entityProp', Prop: 'entityProp', 小道具: 'entityProp',
}
const NUMBERED_RE = new RegExp(`^(${Object.keys(NUMBERED).sort((a, b) => b.length - a.length).join('|')})\\s+(\\d+)$`)
const COPY_RE = /^(.*) (副本|copy|のコピー)$/
const PRESET_ALIASES = new Map<string, string>()
for (const pack of PACKS) {
  for (const [key, value] of Object.entries(pack)) {
    if (key.startsWith('cameraPreset_') && typeof value === 'string') PRESET_ALIASES.set(value, key)
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/** Scene entity whose stored name may be a default generated in any supported locale. */
export interface LabelEntity {
  name: string
  kind?: string
  propId?: string
}

function englishName(id: string) {
  return id.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')
}

function translate(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, { ns: 'directorStudio', ...options })
}

/** Localize a built-in catalog card without mutating persisted scene entities. */
export function localizeCatalogEntry<T extends { id: string; name: string; category: string; description: string }>(entry: T, language: string): T {
  if (language.startsWith('ja')) {
    const name = JA_NAMES[entry.id] ?? entry.name
    return {
      ...entry,
      name,
      category: JA_CATEGORIES[entry.category] ?? entry.category,
      description: JA_DESCRIPTIONS[entry.id] ?? `${name} · オリジナルの手続き型ローポリ`,
    }
  }
  if (!language.startsWith('en')) return entry
  const name = englishName(entry.id)
  return { ...entry, name, category: EN_CATEGORIES[entry.category] ?? 'Camera motion', description: EN_DESCRIPTIONS[entry.id] ?? `${name} · Original procedural low-poly asset` }
}

function catalogAliases(id: string) {
  const names = new Set<string>([englishName(id)])
  const zhName = DIRECTOR_PROP_CATALOG.find((entry) => entry.id === id)?.name
  if (zhName) names.add(zhName)
  if (JA_NAMES[id]) names.add(JA_NAMES[id])
  return names
}

/** Default object name in the active UI language. */
export function defaultObjectName(kind: 'mannequin' | string, index: number, propId?: string) {
  const prop = DIRECTOR_PROP_CATALOG.find((entry) => entry.id === propId)
  if (prop) return localizeCatalogEntry(prop, i18n.language).name
  const key = kind === 'mannequin' ? 'entityCharacter' : 'entityProp'
  const fallback = kind === 'mannequin' ? `角色 ${index}` : `道具 ${index}`
  return translate(key, { number: index, defaultValue: fallback })
}

/** Default camera name in the active UI language. */
export function defaultCameraName(index: number, presetKey: DirectorCameraPresetKey = 'current', taken: Iterable<string> = []) {
  if (presetKey === 'current') return translate('entityCamera', { number: index, defaultValue: `机位 ${index}` })
  const base = translate(`cameraPreset_${presetKey}`, { defaultValue: `机位 ${index}` })
  const used = new Set(taken)
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base} ${suffix}`)) suffix += 1
  return `${base} ${suffix}`
}

/** Duplicate suffix in the active UI language. */
export function defaultCopyName(name: string) {
  return translate('entityCopy', { name, defaultValue: `${name} 副本` })
}

/** Present a stored entity name in the active UI language without rewriting custom names. */
export function labelEntityName(entity: LabelEntity, language: string, t: Translate): string {
  const copy = COPY_RE.exec(entity.name)
  if (copy) return t('entityCopy', { name: labelEntityName({ ...entity, name: copy[1] }, language, t) })
  const numbered = NUMBERED_RE.exec(entity.name)
  if (numbered) return t(NUMBERED[numbered[1]], { number: numbered[2] })
  const presetKey = PRESET_ALIASES.get(entity.name)
  if (presetKey) return t(presetKey)
  const numberedPreset = /^(.*) (\d+)$/.exec(entity.name)
  if (numberedPreset) {
    const key = PRESET_ALIASES.get(numberedPreset[1])
    if (key) return `${t(key)} ${numberedPreset[2]}`
  }
  if (entity.propId && catalogAliases(entity.propId).has(entity.name)) {
    return localizeCatalogEntry({ id: entity.propId, name: entity.name, category: '', description: '' }, language).name
  }
  return entity.name
}
