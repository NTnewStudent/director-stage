/** Original procedural assets and motion definitions; no external licensed meshes or runtime imports. */
import type { Vec3 } from '../scene/director-scene'

/** A unit primitive: box dimensions 1, other shapes diameter 1 and height 1. */
export interface PropPart {
  shape: 'box' | 'cylinder' | 'sphere' | 'cone'
  position: Vec3
  scale: Vec3
  rotation?: Vec3
  colorIndex?: number
}
/** Renderable prop library entry, with ground-aligned local geometry. */
export interface PropDefinition {
  id: string
  name: string
  category: string
  description: string
  parts: PropPart[]
}
/** Action/motion cards map directly to a supported sampler algorithm. */
export interface MotionDefinition {
  id: string
  name: string
  category: string
  description: string
}
const part = (shape: PropPart['shape'], position: Vec3, scale: Vec3, rotation?: Vec3): PropPart => ({ shape, position, scale, ...(rotation ? { rotation } : {}) })
const box = (p: Vec3, s: Vec3) => part('box', p, s)
const cylinder = (p: Vec3, s: Vec3, r?: Vec3) => part('cylinder', p, s, r)
const sphere = (p: Vec3, s: Vec3) => part('sphere', p, s)
const tint = (entry: PropPart, colorIndex: number): PropPart => ({ ...entry, colorIndex })
const offset = (entry: PropPart, origin: Vec3): PropPart => ({ ...entry, position: [entry.position[0] + origin[0], entry.position[1] + origin[1], entry.position[2] + origin[2]] })
const legs = (width: number, depth: number, height: number): PropPart[] => [-1, 1].flatMap((x) => [-1, 1].map((z) => box([x * width / 2, height / 2, z * depth / 2], [0.08, height, 0.08])))
const chair = [box([0, 0.48, 0], [0.55, 0.08, 0.55]), box([0, 0.85, -0.24], [0.55, 0.7, 0.08]), ...legs(0.43, 0.43, 0.45)]
const wheels = (width: number, depth: number, radius: number): PropPart[] => [-1, 1].flatMap((x) => [-1, 1].map((z) => cylinder([x * width / 2, radius, z * depth / 2], [radius * 2, 0.16, radius * 2], [0, 0, Math.PI / 2])))
const prop = (id: string, name: string, category: string, parts: PropPart[]): PropDefinition => ({ id, name, category, description: `${name} · 原创程序化低模`, parts })

/** Horizontal glass bands on four facades. yStart/yEnd are meters from the local ground plane. */
function windowBands(width: number, depth: number, yStart: number, yEnd: number, rows: number, origin: Vec3 = [0, 0, 0], colorIndex = 1): PropPart[] {
  const inset = 0.08
  const pitch = (yEnd - yStart) / rows
  const band = Math.min(0.55, pitch * 0.42)
  return Array.from({ length: rows }, (_, i) => {
    const y = yStart + (i + 0.5) * pitch
    return [
      offset(tint(box([0, y, depth / 2 - inset], [width * 0.78, band, 0.05]), colorIndex), origin),
      offset(tint(box([0, y, -(depth / 2 - inset)], [width * 0.78, band, 0.05]), colorIndex), origin),
      offset(tint(box([width / 2 - inset, y, 0], [0.05, band, depth * 0.78]), colorIndex), origin),
      offset(tint(box([-(width / 2 - inset), y, 0], [0.05, band, depth * 0.78]), colorIndex), origin),
    ]
  }).flat()
}

const officeTower = [
  box([0, 1.6, 0], [12, 3.2, 10]),
  box([0, 16.2, 0], [8, 26, 8]),
  box([0, 30, 0], [9, 1.6, 9]),
  cylinder([0, 32.9, 0], [0.28, 4.2, 0.28]),
  ...windowBands(8, 8, 3.6, 28.8, 12),
]

const glassTower = [
  box([0, 18, 0], [6, 36, 6]),
  box([0, 36.6, 0], [6.5, 1.2, 6.5]),
  cylinder([0, 38.6, 0], [0.22, 2.8, 0.22]),
  ...windowBands(6, 6, 0.9, 35.5, 16),
]

const setbackTower = [
  box([0, 4, 0], [14, 8, 12]),
  ...windowBands(14, 12, 0.7, 7.6, 4),
  box([0, 12, 0], [10, 8, 9]),
  ...windowBands(10, 9, 8.4, 15.6, 4),
  box([0, 20, 0], [7, 8, 7]),
  ...windowBands(7, 7, 16.4, 23.6, 4),
  box([0, 26.5, 0], [4.2, 5, 4.2]),
  ...windowBands(4.2, 4.2, 24.2, 28.8, 3),
]

const spireTower = [
  box([0, 1.2, 0], [9, 2.4, 9]),
  box([0, 16.4, 0], [7, 28, 7]),
  part('cone', [0, 34.4, 0], [3.4, 8, 3.4]),
  ...windowBands(7, 7, 2.8, 30, 12),
]

const twinTowers = [
  box([0, 1.1, 0], [16, 2.2, 10]),
  box([-4.2, 14.2, 0], [5.6, 24, 5.6]),
  box([4.2, 14.2, 0], [5.6, 24, 5.6]),
  box([-4.2, 26.5, 0], [6, 0.6, 6]),
  box([4.2, 26.5, 0], [6, 0.6, 6]),
  ...windowBands(5.6, 5.6, 2.6, 25.8, 11, [-4.2, 0, 0]),
  ...windowBands(5.6, 5.6, 2.6, 25.8, 11, [4.2, 0, 0]),
]

const slabTower = [
  box([0, 11, 0], [18, 22, 6.5]),
  box([0, 22.15, 0], [18.4, 0.3, 7]),
  cylinder([6.2, 22.7, 0], [1.5, 0.8, 1.5]),
  ...windowBands(18, 6.5, 1, 21.2, 10),
  ...Array.from({ length: 8 }, (_, i) => box([0, 2.4 + i * 2.4, 3.38], [16.5, 0.12, 0.35])),
]

/** 42 self-authored prop compositions, all backed by actual geometry. */
export const DIRECTOR_PROP_CATALOG: readonly PropDefinition[] = [
  prop('cube', '立方体', '基础形状', [box([0, 0.5, 0], [1, 1, 1])]),
  prop('sphere', '球体', '基础形状', [sphere([0, 0.5, 0], [1, 1, 1])]),
  prop('cylinder', '圆柱', '基础形状', [cylinder([0, 0.5, 0], [1, 1, 1])]),
  prop('cone', '圆锥', '基础形状', [part('cone', [0, 0.5, 0], [1, 1, 1])]),
  prop('capsule', '胶囊', '基础形状', [cylinder([0, 0.75, 0], [0.6, 0.9, 0.6]), sphere([0, 0.3, 0], [0.6, 0.6, 0.6]), sphere([0, 1.2, 0], [0.6, 0.6, 0.6])]),
  prop('platform', '平台', '基础形状', [box([0, 0.1, 0], [3, 0.2, 3])]),
  prop('wall', '墙面', '建筑', [box([0, 1.5, 0], [4, 3, 0.16])]),
  prop('doorway', '门框', '建筑', [box([-0.6, 1.15, 0], [0.2, 2.3, 0.2]), box([0.6, 1.15, 0], [0.2, 2.3, 0.2]), box([0, 2.2, 0], [1.4, 0.2, 0.2])]),
  prop('window', '窗框', '建筑', [box([-0.8, 1.5, 0], [0.12, 1.5, 0.12]), box([0.8, 1.5, 0], [0.12, 1.5, 0.12]), box([0, 2.2, 0], [1.6, 0.12, 0.12]), box([0, 0.8, 0], [1.6, 0.12, 0.12]), box([0, 1.5, 0], [0.06, 1.4, 0.06])]),
  prop('stairs', '台阶', '建筑', Array.from({ length: 5 }, (_, i) => box([0, (i + 1) * 0.1, -i * 0.35], [1.5, (i + 1) * 0.2, 0.35]))),
  prop('pillar', '立柱', '建筑', [cylinder([0, 1.5, 0], [0.5, 3, 0.5]), box([0, 0.1, 0], [0.8, 0.2, 0.8]), box([0, 2.9, 0], [0.8, 0.2, 0.8])]),
  prop('room', '房间', '建筑', [box([0, -0.05, 0], [5, 0.1, 5]), box([0, 1.5, -2.5], [5, 3, 0.15]), box([-2.5, 1.5, 0], [0.15, 3, 5])]),
  prop('office-tower', '办公塔楼', '建筑', officeTower),
  prop('glass-tower', '玻璃大厦', '建筑', glassTower),
  prop('setback-tower', '退台大厦', '建筑', setbackTower),
  prop('spire-tower', '尖顶摩天楼', '建筑', spireTower),
  prop('twin-towers', '双子塔', '建筑', twinTowers),
  prop('slab-tower', '板式住宅楼', '建筑', slabTower),
  prop('chair', '木椅', '家具', chair),
  prop('stool', '圆凳', '家具', [cylinder([0, 0.5, 0], [0.6, 0.12, 0.6]), ...legs(0.35, 0.35, 0.45)]),
  prop('table', '餐桌', '家具', [box([0, 0.78, 0], [1.6, 0.1, 0.9]), ...legs(1.35, 0.65, 0.73)]),
  prop('round-table', '圆桌', '家具', [cylinder([0, 0.75, 0], [1.2, 0.1, 1.2]), cylinder([0, 0.37, 0], [0.12, 0.7, 0.12]), cylinder([0, 0.05, 0], [0.7, 0.1, 0.7])]),
  prop('sofa', '沙发', '家具', [box([0, 0.35, 0], [2.1, 0.6, 0.9]), box([0, 0.8, -0.4], [2.1, 0.7, 0.2]), box([-1, 0.55, 0], [0.2, 0.5, 0.95]), box([1, 0.55, 0], [0.2, 0.5, 0.95])]),
  prop('bed', '床', '家具', [box([0, 0.35, 0], [1.6, 0.4, 2.2]), box([0, 0.65, -1], [1.6, 0.9, 0.12]), box([0, 0.6, -0.7], [1.2, 0.18, 0.4])]),
  prop('bookshelf', '书架', '家具', [box([-0.6, 1, 0], [0.12, 2, 0.4]), box([0.6, 1, 0], [0.12, 2, 0.4]), ...[0.06, 0.65, 1.3, 1.95].map((y) => box([0, y, 0], [1.2, 0.1, 0.4]))]),
  prop('cabinet', '柜子', '家具', [box([0, 0.9, 0], [1.2, 1.8, 0.6]), box([-0.1, 1, 0.33], [0.04, 0.2, 0.04]), box([0.1, 1, 0.33], [0.04, 0.2, 0.04])]),
  prop('bench', '长凳', '家具', [box([0, 0.5, 0], [1.8, 0.12, 0.5]), ...legs(1.5, 0.3, 0.45)]),
  prop('lamp', '落地灯', '生活', [cylinder([0, 0.04, 0], [0.45, 0.08, 0.45]), cylinder([0, 0.8, 0], [0.05, 1.5, 0.05]), part('cone', [0, 1.6, 0], [0.65, 0.4, 0.65])]),
  prop('vase', '花瓶', '生活', [sphere([0, 0.25, 0], [0.4, 0.5, 0.4]), cylinder([0, 0.5, 0], [0.16, 0.25, 0.16])]),
  prop('bottle', '瓶子', '生活', [cylinder([0, 0.18, 0], [0.15, 0.36, 0.15]), cylinder([0, 0.4, 0], [0.06, 0.12, 0.06])]),
  prop('cup', '杯子', '生活', [cylinder([0, 0.1, 0], [0.16, 0.2, 0.16]), box([0.11, 0.1, 0], [0.08, 0.1, 0.035])]),
  prop('book', '书本', '生活', [box([0, 0.025, 0], [0.22, 0.05, 0.3])]),
  prop('screen', '显示器', '电子', [box([0, 0.48, 0], [0.9, 0.55, 0.06]), box([0, 0.18, 0], [0.06, 0.35, 0.06]), box([0, 0.03, 0], [0.4, 0.06, 0.25])]),
  prop('laptop', '笔记本', '电子', [box([0, 0.02, 0], [0.4, 0.04, 0.3]), part('box', [0, 0.17, -0.13], [0.4, 0.3, 0.02], [-0.2, 0, 0])]),
  prop('phone', '手机', '电子', [box([0, 0.08, 0], [0.075, 0.16, 0.012])]),
  prop('car', '汽车', '交通', [box([0, 0.65, 0], [1.7, 0.5, 3.8]), box([0, 1.12, -0.2], [1.45, 0.6, 1.9]), ...wheels(1.7, 2.5, 0.32)]),
  prop('van', '厢式车', '交通', [box([0, 1.1, 0], [1.8, 1.6, 4]), ...wheels(1.8, 2.7, 0.34)]),
  prop('road', '道路', '交通', [box([0, -0.03, 0], [6, 0.06, 12]), ...[-4, -2, 0, 2, 4].map((z) => box([0, 0.01, z], [0.1, 0.02, 1]))]),
  prop('tree', '树木', '自然', [cylinder([0, 0.85, 0], [0.22, 1.7, 0.22]), sphere([0, 2, 0], [1.8, 1.8, 1.8])]),
  prop('pine', '松树', '自然', [cylinder([0, 0.4, 0], [0.2, 0.8, 0.2]), ...[0, 1, 2].map((i) => part('cone', [0, 1 + i * 0.65, 0], [1.8 - i * 0.4, 1.4, 1.8 - i * 0.4]))]),
  prop('rock', '岩石', '自然', [sphere([0, 0.35, 0], [1.2, 0.7, 0.85])]),
  prop('plant', '盆栽', '自然', [cylinder([0, 0.2, 0], [0.45, 0.4, 0.45]), cylinder([0, 0.6, 0], [0.04, 0.8, 0.04]), sphere([-0.15, 0.7, 0], [0.4, 0.55, 0.3]), sphere([0.15, 0.85, 0], [0.35, 0.5, 0.3])]),
]

/** Actions and paths implemented by the frame sampler (not placeholder AI results). */
export const DIRECTOR_ACTION_CATALOG: readonly MotionDefinition[] = [
  { id: 'walk', name: '行走', category: '动作', description: '原地步态，左右肢体交替；可组合直线路径' },
  { id: 'run', name: '奔跑', category: '动作', description: '更快的原地跑步与身体起伏' },
  { id: 'wave', name: '挥手', category: '动作', description: '抬起右臂，连续挥手' },
  { id: 'sit', name: '坐下', category: '动作', description: '从站姿平滑过渡为坐姿' },
  { id: 'nod', name: '点头', category: '动作', description: '头部上下点动' },
  { id: 'bow', name: '鞠躬', category: '动作', description: '俯身致意后回正' },
  { id: 'jump', name: '跳跃', category: '动作', description: '屈膝起跳并回到地面' },
  { id: 'turn', name: '转身', category: '路径', description: '在原地旋转半周' },
  { id: 'path-forward', name: '向前走位', category: '路径', description: '沿角色朝向移动，幅度单位为米' },
  { id: 'path-side', name: '横向走位', category: '路径', description: '沿角色右方横移，幅度单位为米' },
  { id: 'path-circle', name: '圆形走位', category: '路径', description: '沿圆弧移动并保持朝向切线' },
]

/** Camera motions with real analytic position/target/lens changes. */
export const DIRECTOR_MOTION_CATALOG: readonly MotionDefinition[] = [
  { id: 'push', name: '推近', category: '基础', description: '相机向注视点推进，幅度单位为米' },
  { id: 'pull', name: '拉远', category: '基础', description: '相机远离注视点，幅度单位为米' },
  { id: 'orbit', name: '环绕', category: '跟拍', description: '围绕注视点旋转，幅度 1 为四分之一周' },
  { id: 'pan', name: '横摇', category: '基础', description: '相机不动，水平转动注视方向' },
  { id: 'rise', name: '升起', category: '基础', description: '机位和注视点同时上升' },
  { id: 'fall', name: '下降', category: '基础', description: '机位和注视点同时下降' },
  { id: 'truck', name: '横移', category: '基础', description: '保持构图方向横向移动' },
  { id: 'zoom-in', name: '变焦推进', category: '镜头', description: '固定机位增加焦距' },
  { id: 'zoom-out', name: '变焦拉远', category: '镜头', description: '固定机位减小焦距' },
  { id: 'crane', name: '摇臂升降', category: '空间', description: '向上后方移动，相机始终注视主体' },
  { id: 'handheld', name: '手持微晃', category: '镜头', description: '确定性平滑微动，逐帧重放一致' },
  { id: 'roll', name: '镜头旋转', category: '镜头', description: '围绕镜头轴旋转' },
]

/** Reuse the original 15 camera presets, retaining existing focal length semantics. */
export { DIRECTOR_CAMERA_PRESETS } from '../scene/director-camera-presets'
