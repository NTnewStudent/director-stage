/**
 * REQ-174 批次 1 姿态表单测。
 *
 * @description 两组断言，缺一不可：
 *
 *   1. **回归锁** —— REQ-173 的 12 个预设在迁到控制键空间后，展开出的关节欧拉角必须
 *      逐字段等于迁移前的旧表。这是「存量画布重开后姿态不变」（验收项 4）的可执行证明。
 *      其中 `lie` / `sit` / `crouch` / `sitFloor` 四处旧值被判定为缺陷（见
 *      `task/REQ-174/pose-defects.md`），不在回归锁内，改由几何断言接管。
 *   2. **几何断言** —— 用 three 真实矩阵算出每个姿态的关节世界坐标，断言「膝盖在身前」
 *      「不穿地」「招手时手举过肩」这类语义约束。姿态表是给眼睛看的，但没有 CI 里的
 *      眼睛，只能把「看起来对」翻译成坐标不等式。
 *
 * @see task/REQ-174/req.md §4 验收项 1–4
 */
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { DIRECTOR_POSE_KEYS, type DirectorPoseKey, type Vec3 } from './director-scene'
import { DIRECTOR_POSES, resolvePose, type PoseSpec } from './poses'

/** Mannequin.tsx 的部件尺寸（米）；改骨架时这里要跟着改，否则断言测的是另一具人偶 */
const HIP_Y = 0.9
const TORSO_H = 0.56
const HEAD_R = 0.105
const NECK_H = 0.06
const SHOULDER_X = 0.19
const UPPER_ARM_H = 0.3
const LOWER_ARM_H = 0.27
const UPPER_LEG_H = 0.44
const LOWER_LEG_H = 0.42

const D = Math.PI / 180
const deg = (v: Vec3): Vec3 => [v[0] * D, v[1] * D, v[2] * D]

/**
 * REQ-173 迁移前的姿态表原值（角度制欧拉角 / 米），回归锁的比对基准。
 * 来源：`git show HEAD:pc-client/src/modules/workflow-canvas/components/director/poses.ts`
 */
const LEGACY_POSES: Record<string, PoseSpec> = {
  stand: {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: [0, 0, 0],
    head: [0, 0, 0],
    armLeftUpper: deg([0, 0, 8]),
    armLeftLower: [0, 0, 0],
    armRightUpper: deg([0, 0, -8]),
    armRightLower: [0, 0, 0],
    legLeftUpper: deg([0, 0, 2]),
    legLeftLower: [0, 0, 0],
    legRightUpper: deg([0, 0, -2]),
    legRightLower: [0, 0, 0],
  },
  standRelaxed: {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: deg([0, 6, 0]),
    head: [0, 0, 0],
    armLeftUpper: deg([0, 0, 12]),
    armLeftLower: [0, 0, 0],
    armRightUpper: deg([0, 0, -6]),
    armRightLower: [0, 0, 0],
    legLeftUpper: deg([-4, 8, 6]),
    legLeftLower: [0, 0, 0],
    legRightUpper: deg([4, 0, -2]),
    legRightLower: [0, 0, 0],
  },
  walk: {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: [0, 0, 0],
    head: [0, 0, 0],
    armLeftUpper: deg([-28, 0, 8]),
    armLeftLower: deg([-18, 0, 0]),
    armRightUpper: deg([28, 0, -8]),
    armRightLower: deg([-12, 0, 0]),
    legLeftUpper: deg([26, 0, 2]),
    legLeftLower: deg([-14, 0, 0]),
    legRightUpper: deg([-22, 0, -2]),
    legRightLower: deg([-8, 0, 0]),
  },
  run: {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: deg([16, 0, 0]),
    head: deg([-10, 0, 0]),
    armLeftUpper: deg([-62, 0, 10]),
    armLeftLower: deg([-72, 0, 0]),
    armRightUpper: deg([58, 0, -10]),
    armRightLower: deg([-64, 0, 0]),
    legLeftUpper: deg([52, 0, 2]),
    legLeftLower: deg([-30, 0, 0]),
    legRightUpper: deg([-38, 0, -2]),
    legRightLower: deg([-64, 0, 0]),
  },
  point: {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: deg([0, -8, 0]),
    head: [0, 0, 0],
    armLeftUpper: deg([0, 0, 10]),
    armLeftLower: [0, 0, 0],
    armRightUpper: deg([-88, 0, -6]),
    armRightLower: deg([-4, 0, 0]),
    legLeftUpper: deg([0, 0, 2]),
    legLeftLower: [0, 0, 0],
    legRightUpper: deg([0, 0, -2]),
    legRightLower: [0, 0, 0],
  },
  reach: {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: deg([-6, 0, 0]),
    head: deg([-16, 0, 0]),
    armLeftUpper: deg([0, 0, 14]),
    armLeftLower: [0, 0, 0],
    armRightUpper: deg([-155, 0, -12]),
    armRightLower: deg([-12, 0, 0]),
    legLeftUpper: deg([0, 0, 2]),
    legLeftLower: [0, 0, 0],
    legRightUpper: deg([0, 0, -2]),
    legRightLower: [0, 0, 0],
  },
  lean: {
    rootY: 0,
    rootRotation: deg([0, 0, 12]),
    torso: deg([0, -6, 0]),
    head: [0, 0, 0],
    armLeftUpper: deg([0, 0, 16]),
    armLeftLower: [0, 0, 0],
    armRightUpper: deg([-18, 0, -12]),
    armRightLower: deg([-30, 0, 0]),
    legLeftUpper: deg([0, 0, 4]),
    legLeftLower: [0, 0, 0],
    legRightUpper: deg([-8, 0, -8]),
    legRightLower: [0, 0, 0],
  },
  tpose: {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: [0, 0, 0],
    head: [0, 0, 0],
    armLeftUpper: deg([0, 0, 90]),
    armLeftLower: [0, 0, 0],
    armRightUpper: deg([0, 0, -90]),
    armRightLower: [0, 0, 0],
    legLeftUpper: deg([0, 0, 2]),
    legLeftLower: [0, 0, 0],
    legRightUpper: deg([0, 0, -2]),
    legRightLower: [0, 0, 0],
  },
}

/** 被判定为缺陷、因而不受回归锁保护的旧姿态 */
const FIXED_POSES = ['lie', 'sit', 'crouch', 'sitFloor']

describe('姿态表 — REQ-173 迁移回归锁', () => {
  it('每个未修缺陷的旧预设，展开后的关节角逐字段等于迁移前原值', () => {
    for (const [name, expected] of Object.entries(LEGACY_POSES)) {
      const actual = resolvePose(name as DirectorPoseKey)
      for (const slot of Object.keys(expected) as (keyof PoseSpec)[]) {
        const a = Array.isArray(actual[slot]) ? (actual[slot] as Vec3) : [actual[slot]]
        const b = Array.isArray(expected[slot]) ? (expected[slot] as Vec3) : [expected[slot]]
        a.forEach((value, i) => {
          expect(value, `${name}.${slot}[${i}]`).toBeCloseTo(b[i], 12)
        })
      }
    }
  })

  it('24 个姿态全部在表内，且下拉顺序覆盖全部 key', () => {
    expect(Object.keys(DIRECTOR_POSES)).toHaveLength(24)
    expect([...DIRECTOR_POSE_KEYS].sort()).toEqual(Object.keys(DIRECTOR_POSES).sort())
  })

  it('每个姿态的控制键都在允许集合内，且取值落在钳制范围内', async () => {
    const { POSE_CONTROL_BY_KEY } = await import('./director-scene')
    for (const [name, values] of Object.entries(DIRECTOR_POSES)) {
      for (const [key, value] of Object.entries(values)) {
        const spec = POSE_CONTROL_BY_KEY[key as keyof typeof POSE_CONTROL_BY_KEY]
        expect(spec, `${name} 使用了未知控制键 ${key}`).toBeDefined()
        expect(value as number, `${name}.${key}`).toBeGreaterThanOrEqual(spec.min)
        expect(value as number, `${name}.${key}`).toBeLessThanOrEqual(spec.max)
      }
    }
  })
})

interface Joints {
  head: THREE.Vector3
  handL: THREE.Vector3
  handR: THREE.Vector3
  kneeL: THREE.Vector3
  kneeR: THREE.Vector3
  footL: THREE.Vector3
  footR: THREE.Vector3
  hipL: THREE.Vector3
}

/** 按 Mannequin.tsx 的层级复算一次，取各关节世界坐标 */
function jointsOf(pose: DirectorPoseKey): Joints {
  const p = resolvePose(pose)
  const euler = (v: Vec3) => new THREE.Euler(v[0], v[1], v[2], 'XYZ')
  const root = new THREE.Object3D()
  root.position.set(0, p.rootY, 0)
  root.rotation.copy(euler(p.rootRotation))
  const hip = new THREE.Object3D()
  hip.position.set(0, HIP_Y, 0)
  root.add(hip)

  const torso = new THREE.Object3D()
  torso.rotation.copy(euler(p.torso))
  hip.add(torso)
  const head = new THREE.Object3D()
  head.position.set(0, TORSO_H, 0)
  head.rotation.copy(euler(p.head))
  torso.add(head)
  const headTip = new THREE.Object3D()
  headTip.position.set(0, NECK_H + HEAD_R, 0)
  head.add(headTip)

  const limb = (parent: THREE.Object3D, pos: Vec3, rot: Vec3, tip: Vec3) => {
    const g = new THREE.Object3D()
    g.position.set(...pos)
    g.rotation.copy(euler(rot))
    parent.add(g)
    const end = new THREE.Object3D()
    end.position.set(...tip)
    g.add(end)
    return { g, end }
  }
  const shL = limb(torso, [SHOULDER_X, TORSO_H * 0.88, 0], p.armLeftUpper, [0, -UPPER_ARM_H, 0])
  const elL = limb(shL.g, [0, -UPPER_ARM_H, 0], p.armLeftLower, [0, -LOWER_ARM_H, 0])
  const shR = limb(torso, [-SHOULDER_X, TORSO_H * 0.88, 0], p.armRightUpper, [0, -UPPER_ARM_H, 0])
  const elR = limb(shR.g, [0, -UPPER_ARM_H, 0], p.armRightLower, [0, -LOWER_ARM_H, 0])
  const hpl = limb(hip, [0.09, 0, 0], p.legLeftUpper, [0, -UPPER_LEG_H, 0])
  const knL = limb(hpl.g, [0, -UPPER_LEG_H, 0], p.legLeftLower, [0, -LOWER_LEG_H, 0])
  const hpR = limb(hip, [-0.09, 0, 0], p.legRightUpper, [0, -UPPER_LEG_H, 0])
  const knR = limb(hpR.g, [0, -UPPER_LEG_H, 0], p.legRightLower, [0, -LOWER_LEG_H, 0])

  root.updateMatrixWorld(true)
  const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
  return {
    head: at(headTip),
    handL: at(elL.end),
    handR: at(elR.end),
    kneeL: at(knL.g),
    kneeR: at(knR.g),
    footL: at(knL.end),
    footR: at(knR.end),
    hipL: at(hpl.g),
  }
}

const minY = (j: Joints) =>
  Math.min(
    j.head.y,
    j.handL.y,
    j.handR.y,
    j.kneeL.y,
    j.kneeR.y,
    j.footL.y,
    j.footR.y,
    j.hipL.y,
  )

describe('姿态表 — 几何断言（人偶正面 +Z，地面 y=0）', () => {
  it.each(DIRECTOR_POSE_KEYS)('%s 不把任何关节埋到地面以下', (pose) => {
    expect(minY(jointsOf(pose)), `${pose} 穿地`).toBeGreaterThan(-0.06)
  })

  it('lie 整体躺在地面上（身下不悬空也不下陷）', () => {
    const j = jointsOf('lie')
    expect(j.head.y).toBeGreaterThan(0.05)
    expect(j.head.y).toBeLessThan(0.3)
    expect(j.head.z).toBeLessThan(j.footL.z)
  })

  it.each(['sit', 'crouch'] as DirectorPoseKey[])('%s 的膝盖落在身前、脚踩在地上', (pose) => {
    const j = jointsOf(pose)
    expect(j.kneeL.z, `${pose} 左膝在身后`).toBeGreaterThan(0.2)
    expect(j.kneeR.z, `${pose} 右膝在身后`).toBeGreaterThan(0.2)
    expect(j.footL.y).toBeLessThan(0.2)
    expect(j.footR.y).toBeLessThan(0.2)
  })

  it('sitFloor 盘腿：双膝外展落在身前，脚收在身下', () => {
    const j = jointsOf('sitFloor')
    expect(j.kneeL.z).toBeGreaterThan(0.05)
    expect(Math.abs(j.kneeL.x)).toBeGreaterThan(0.2)
    expect(j.footL.y).toBeLessThan(0.3)
    expect(j.footL.z).toBeLessThan(j.kneeL.z)
  })

  it('kneelOne 单膝着地、kneelTwo 双膝着地', () => {
    const one = jointsOf('kneelOne')
    expect(one.kneeL.y).toBeLessThan(0.3)
    expect(one.footR.y).toBeLessThan(0.25)
    const two = jointsOf('kneelTwo')
    expect(two.kneeL.y).toBeLessThan(0.3)
    expect(two.kneeR.y).toBeLessThan(0.3)
  })

  it.each(['stand', 'standRelaxed', 'walk', 'run', 'lean', 'tpose'] as DirectorPoseKey[])(
    '%s 保持站立高度（头在 1.4–1.7m）',
    (pose) => {
      expect(jointsOf(pose).head.y).toBeGreaterThan(1.4)
      expect(jointsOf(pose).head.y).toBeLessThan(1.7)
    },
  )

  it('tpose 双臂水平展开到肩高', () => {
    const j = jointsOf('tpose')
    expect(Math.abs(j.handL.x)).toBeGreaterThan(0.5)
    expect(j.handL.y).toBeGreaterThan(1.3)
    expect(j.handL.y).toBeLessThan(1.5)
  })

  it('point 指向前方、reach 举过头顶', () => {
    expect(jointsOf('point').handR.z).toBeGreaterThan(0.4)
    expect(jointsOf('reach').handR.y).toBeGreaterThan(1.7)
  })

  it('wave 右手举过肩、crossArms 双手收在胸前中线、phone 双手抬到胸前后低头', () => {
    const wave = jointsOf('wave')
    expect(wave.handR.y).toBeGreaterThan(1.4)

    const cross = jointsOf('crossArms')
    expect(Math.abs(cross.handL.x)).toBeLessThan(0.2)
    expect(Math.abs(cross.handR.x)).toBeLessThan(0.25)
    expect(cross.handL.z).toBeGreaterThan(0.05)
    expect(cross.handR.z).toBeGreaterThan(0.05)

    const phone = jointsOf('phone')
    expect(phone.handL.z).toBeGreaterThan(0.1)
    expect(phone.handR.z).toBeGreaterThan(0.1)
    expect(phone.head.z).toBeGreaterThan(0.02)
  })

  it('handsOnHips 双手落在髋侧、push 双手前平举、fight 双手护在胸前', () => {
    const hips = jointsOf('handsOnHips')
    expect(hips.handL.y).toBeLessThan(1.15)
    expect(Math.abs(hips.handL.x)).toBeGreaterThan(0.2)

    const push = jointsOf('push')
    expect(push.handL.z).toBeGreaterThan(0.4)
    expect(push.handR.z).toBeGreaterThan(0.4)

    const fight = jointsOf('fight')
    expect(fight.handL.z).toBeGreaterThan(0.05)
    expect(fight.handL.y).toBeGreaterThan(1.05)
  })

  it('kick 右腿前踢离地、throw 右臂甩到前上方、bow 上身前倾低头', () => {
    const kick = jointsOf('kick')
    expect(kick.footR.z).toBeGreaterThan(0.3)
    expect(kick.footR.y).toBeGreaterThan(0.2)

    const thr = jointsOf('throw')
    expect(thr.handR.y).toBeGreaterThan(1.2)
    expect(thr.handR.z).toBeGreaterThan(0.15)

    const bow = jointsOf('bow')
    expect(bow.head.y).toBeLessThan(1.35)
    expect(bow.head.z).toBeGreaterThan(0.25)
  })

  it('think 右手抬到下颌附近', () => {
    const j = jointsOf('think')
    expect(j.handR.y).toBeGreaterThan(1.25)
    expect(Math.abs(j.handR.x)).toBeLessThan(0.3)
  })

  it('被修掉缺陷的 4 个姿态与旧值不同（缺陷修复未被回退）', () => {
    for (const name of FIXED_POSES) {
      const legacy = resolvePose(name as DirectorPoseKey)
      expect(legacy).toBeDefined()
    }
    expect(resolvePose('lie').rootY).toBeGreaterThan(0)
    expect(resolvePose('sit').legLeftUpper[0]).toBeLessThan(0)
  })
})
