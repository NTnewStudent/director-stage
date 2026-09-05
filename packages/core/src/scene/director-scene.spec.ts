/**
 * REQ-173 导演台场景序列化 / 反序列化单测。
 *
 * `data.scene` 是自由 JSON（后端原样存取、不校验），因此重开画布时可能读到旧版本、
 * 被别端写坏、或压根缺失的数据。`normalizeDirectorScene` 是唯一入口，必须把任何
 * 非法输入收敛成可渲染的场景 —— 否则 NaN 坐标会直接把 3D 视口崩掉。
 *
 * @see task/REQ-173/req.md §3.2
 * @see docs/api-contracts/client/workflow-canvas.md#RULE_DIRECTOR_STAGE
 */
import { describe, expect, it } from 'vitest'
import {
  createDefaultDirectorScene,
  DIRECTOR_FOCAL_DEFAULT,
  DIRECTOR_FOCAL_MAX,
  DIRECTOR_FOCAL_MIN,
  DIRECTOR_SCENE_VERSION,
  nextDirectorObjectId,
  normalizeDirectorScene,
  normalizePoseControls,
  POSE_CONTROLS,
  POSE_CONTROL_BY_KEY,
  ratioToAspect,
  type DirectorObject,
} from './director-scene'

describe('createDefaultDirectorScene', () => {
  it('默认场景含一个站姿标准体型人偶，且每次返回独立引用', () => {
    const a = createDefaultDirectorScene()
    const b = createDefaultDirectorScene()
    expect(a.objects).toHaveLength(1)
    expect(a.objects[0]).toMatchObject({ kind: 'mannequin', build: 'standard', pose: 'stand' })
    expect(a.focalLength).toBe(DIRECTOR_FOCAL_DEFAULT)
    expect(a.ratio).toBe('16:9')
    // 独立引用：mutate 一个不得污染另一个（默认场景被 addNode 反复调用）
    a.objects[0].position[0] = 99
    expect(b.objects[0].position[0]).toBe(0)
  })
})

describe('normalizeDirectorScene — 往返保真', () => {
  it('JSON 往返（存 graph → 读回）后场景逐字段相等', () => {
    const original = createDefaultDirectorScene()
    original.objects.push({
      id: 'obj_2',
      kind: 'box',
      name: '桌子',
      position: [1.5, 0, -2],
      rotation: [0, 0.7853, 0],
      scale: [2, 0.8, 1],
    })
    original.camera = { position: [2, 1.4, 3], target: [0, 0.9, 0] }
    original.focalLength = 85
    original.ratio = '9:16'

    // 模拟真实持久化路径：序列化进 graphJson，再反序列化读回
    const roundTripped = normalizeDirectorScene(JSON.parse(JSON.stringify(original)))
    expect(roundTripped).toEqual(original)
  })

  it('保留道具的名称与非等比缩放（墙 / 桌需要拍扁的形变）', () => {
    const scene = normalizeDirectorScene({
      version: 1,
      objects: [{ id: 'obj_1', kind: 'plane', name: '背墙', position: [0, 0, -3], rotation: [0, 0, 0], scale: [6, 3, 1] }],
      camera: { position: [0, 1, 4], target: [0, 1, 0] },
      focalLength: 50,
      ratio: '4:3',
    })
    expect(scene.objects[0]).toMatchObject({ kind: 'plane', name: '背墙', scale: [6, 3, 1] })
  })
})

describe('normalizeDirectorScene — 脏数据收敛', () => {
  it('undefined / null / 非对象 ⇒ 回落默认场景', () => {
    for (const raw of [undefined, null, 42, 'scene', true]) {
      expect(normalizeDirectorScene(raw)).toEqual(createDefaultDirectorScene())
    }
  })

  it('NaN / Infinity / 缺位坐标逐位回落，绝不把 NaN 放进场景', () => {
    const scene = normalizeDirectorScene({
      objects: [
        {
          id: 'obj_1',
          kind: 'mannequin',
          position: [Number.NaN, 1, undefined],
          rotation: [Number.POSITIVE_INFINITY, 0, 0],
          scale: ['x', 2, null],
        },
      ],
      camera: { position: [Number.NaN, null, 3] },
      focalLength: Number.NaN,
    })
    const flat = [
      ...scene.objects[0].position,
      ...scene.objects[0].rotation,
      ...scene.objects[0].scale,
      ...scene.camera.position,
      ...scene.camera.target,
      scene.focalLength,
    ]
    expect(flat.every((n) => Number.isFinite(n))).toBe(true)
    expect(scene.objects[0].position).toEqual([0, 1, 0])
    expect(scene.focalLength).toBe(DIRECTOR_FOCAL_DEFAULT)
  })

  it('焦距夹到 [14, 200] 并取整', () => {
    expect(normalizeDirectorScene({ focalLength: 5 }).focalLength).toBe(DIRECTOR_FOCAL_MIN)
    expect(normalizeDirectorScene({ focalLength: 9999 }).focalLength).toBe(DIRECTOR_FOCAL_MAX)
    expect(normalizeDirectorScene({ focalLength: 35.7 }).focalLength).toBe(36)
  })

  it('0 / 负缩放钉到最小 0.05（否则 gizmo 与包围盒推导退化）', () => {
    const scene = normalizeDirectorScene({
      objects: [{ id: 'obj_1', kind: 'box', scale: [0, -3, 0.0001] }],
    })
    expect(scene.objects[0].scale[0]).toBeGreaterThanOrEqual(0.05)
    expect(scene.objects[0].scale[1]).toBe(3) // 取绝对值，保留量级
    expect(scene.objects[0].scale[2]).toBe(0.05)
  })

  it('未知 kind 的条目被丢弃，合法条目保留（不整场景回落）', () => {
    const scene = normalizeDirectorScene({
      objects: [
        { id: 'obj_1', kind: 'spaceship' },
        { id: 'obj_2', kind: 'box' },
        'not-an-object',
        null,
      ],
    })
    expect(scene.objects).toHaveLength(1)
    expect(scene.objects[0].id).toBe('obj_2')
  })

  it('非法 build / pose / ratio 回落到安全默认值', () => {
    const scene = normalizeDirectorScene({
      objects: [{ id: 'obj_1', kind: 'mannequin', build: 'buff', pose: 'breakdance' }],
      ratio: '13:37',
    })
    expect(scene.objects[0].build).toBe('standard')
    expect(scene.objects[0].pose).toBe('stand')
    expect(scene.ratio).toBe('16:9')
  })

  it('道具不被塞入 build / pose（人偶专属字段）', () => {
    const scene = normalizeDirectorScene({
      objects: [{ id: 'obj_1', kind: 'cylinder', build: 'slim', pose: 'run' }],
    })
    expect(scene.objects[0].build).toBeUndefined()
    expect(scene.objects[0].pose).toBeUndefined()
  })

  it('归一化后 version 恒为当前版本（旧版本数据被抬到当前）', () => {
    expect(normalizeDirectorScene({ version: 0, objects: [] }).version).toBe(DIRECTOR_SCENE_VERSION)
  })

  it('归一化是幂等的（二次归一化不再改变结果）', () => {
    const once = normalizeDirectorScene({
      objects: [{ id: 'obj_1', kind: 'mannequin', scale: [-2, 0, 1] }],
      focalLength: 300,
      ratio: 'bogus',
    })
    expect(normalizeDirectorScene(once)).toEqual(once)
  })
})

describe('nextDirectorObjectId', () => {
  const obj = (id: string): DirectorObject => ({
    id,
    kind: 'box',
    name: '',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  })

  it('空场景从 obj_1 起', () => {
    expect(nextDirectorObjectId([])).toBe('obj_1')
  })

  it('取 max+1，删除中间项后编号不复用（避免与残留引用撞号）', () => {
    expect(nextDirectorObjectId([obj('obj_1'), obj('obj_3')])).toBe('obj_4')
  })

  it('忽略不符命名规则的 id', () => {
    expect(nextDirectorObjectId([obj('legacy-thing'), obj('obj_2')])).toBe('obj_3')
  })
})

describe('normalizePoseControls', () => {
  it('非对象 / 数组 / 空对象一律收敛为 undefined（无微调不占字段）', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}]) {
      expect(normalizePoseControls(raw)).toBeUndefined()
    }
  })

  it('未知控制键被丢弃（人偶没有对应关节，留着只会让渲染层查表落空）', () => {
    expect(normalizePoseControls({ 'leftWrist.roll': 30, 'torso.pitch': 8 })).toEqual({
      'torso.pitch': 8,
    })
  })

  it('数值按各关节生理可动域钳制', () => {
    const spec = POSE_CONTROL_BY_KEY['leftKnee.bend']
    expect(normalizePoseControls({ 'leftKnee.bend': 9999 })?.['leftKnee.bend']).toBe(spec.max)
    expect(normalizePoseControls({ 'leftKnee.bend': -9999 })?.['leftKnee.bend']).toBe(spec.min)
  })

  it('NaN / Infinity / 非数字逐项丢弃，绝不把 NaN 写进场景', () => {
    const out = normalizePoseControls({
      'head.yaw': Number.NaN,
      'leftElbow.bend': Number.POSITIVE_INFINITY,
      'rightElbow.bend': '90',
      'torso.roll': 12,
    })
    expect(out).toEqual({ 'torso.roll': 12 })
  })

  it('26 个控制键全部可被接受，且元数据表与键集合一一对应', () => {
    expect(POSE_CONTROLS).toHaveLength(26)
    const all: Record<string, number> = {}
    for (const spec of POSE_CONTROLS) all[spec.key] = spec.max
    expect(Object.keys(normalizePoseControls(all) ?? {})).toHaveLength(26)
  })
})

describe('normalizeDirectorScene — 关节微调覆盖层（REQ-174 批次 1）', () => {
  it('覆盖层随场景往返保真（微调结果持久化、重开完整还原）', () => {
    const original = createDefaultDirectorScene()
    original.objects[0].poseControls = { 'leftShoulder.pitch': -35, 'body.offsetY': -0.2 }
    const roundTripped = normalizeDirectorScene(JSON.parse(JSON.stringify(original)))
    expect(roundTripped.objects[0].poseControls).toEqual(original.objects[0].poseControls)
    expect(roundTripped).toEqual(original)
  })

  it('覆盖层里的脏数据在归一化时收敛（未知键丢弃、越界钳制）', () => {
    const scene = normalizeDirectorScene({
      objects: [
        {
          id: 'obj_1',
          kind: 'mannequin',
          poseControls: { 'tail.wag': 3, 'head.yaw': 9999, 'leftKnee.bend': 45 },
        },
      ],
    })
    expect(scene.objects[0].poseControls).toEqual({
      'head.yaw': POSE_CONTROL_BY_KEY['head.yaw'].max,
      'leftKnee.bend': 45,
    })
  })

  it('道具不持有 poseControls（人偶专属字段）', () => {
    const scene = normalizeDirectorScene({
      objects: [{ id: 'obj_1', kind: 'box', poseControls: { 'torso.pitch': 10 } }],
    })
    expect(scene.objects[0].poseControls).toBeUndefined()
  })

  it('归一化是幂等的（二次归一化不再改动覆盖层）', () => {
    const once = normalizeDirectorScene({
      objects: [{ id: 'obj_1', kind: 'mannequin', poseControls: { 'head.yaw': 999 } }],
    })
    expect(normalizeDirectorScene(once)).toEqual(once)
  })
})

describe('ratioToAspect', () => {
  it.each([
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['1:1', 1],
    ['4:3', 4 / 3],
    ['21:9', 21 / 9],
  ])('%s ⇒ %f', (ratio, expected) => {
    expect(ratioToAspect(ratio)).toBeCloseTo(expected, 6)
  })

  it('非法比例回落 16:9（不产生 NaN / 0 除）', () => {
    for (const bad of ['', 'abc', '0:0', '16:0', '16']) {
      expect(ratioToAspect(bad)).toBeCloseTo(16 / 9, 6)
    }
  })
})
