/**
 * REQ-173 镜头语言推导单测（纯函数，不拉起 WebGL）。
 *
 * 覆盖：焦距↔FOV 换算与 three 同口径、景别随距离/焦距变化、机位高度分档、
 * 朝向的左右侧判定（符号写反会让描述整体镜像）、无主体时不编造景别。
 *
 * @see task/REQ-173/req.md §3.3
 */
import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import {
  createDefaultDirectorScene,
  MANNEQUIN_HEIGHT,
  type DirectorScene,
  type Vec3,
} from './director-scene'
import { deriveShotLanguage, focalToVerticalFov, resolveSubject } from './director-shot'

/** 造一个只含单个站姿人偶（原点、面朝 +Z）的场景，相机可自由指定 */
function sceneWith(camera: { position: Vec3; target?: Vec3 }, patch?: Partial<DirectorScene>): DirectorScene {
  const base = createDefaultDirectorScene()
  return {
    ...base,
    camera: { position: camera.position, target: camera.target ?? [0, MANNEQUIN_HEIGHT / 2, 0] },
    ...patch,
  }
}

describe('focalToVerticalFov — 与 three PerspectiveCamera.setFocalLength 同口径', () => {
  it.each([14, 24, 35, 50, 85, 200])('%imm 换算结果与 three 一致', (focal) => {
    const aspect = 16 / 9
    // three 的 setFocalLength 用默认 filmGauge=35 且按 aspect 折算 filmHeight，
    // 若我们的公式漂移，视口所见与推导出的景别就会对不上
    const camera = new PerspectiveCamera(50, aspect)
    camera.setFocalLength(focal)
    expect(focalToVerticalFov(focal, aspect)).toBeCloseTo(camera.fov, 5)
  })
})

describe('deriveShotLanguage — 景别', () => {
  it('贴近 + 长焦 ⇒ 特写档（画面只容纳一小截身体）', () => {
    const shot = deriveShotLanguage(sceneWith({ position: [0, 1.6, 1.2] }, { focalLength: 135 }))
    expect(['特写', '大特写']).toContain(shot.shotSize)
  })

  it('中距 + 广角 ⇒ 至少全身（画面容纳整个人）', () => {
    const shot = deriveShotLanguage(sceneWith({ position: [0, 1, 4] }, { focalLength: 24 }))
    expect(['全身', '全景', '远景']).toContain(shot.shotSize)
  })

  it('同机位下焦距越长景别越紧（单调性）', () => {
    const wide = deriveShotLanguage(sceneWith({ position: [0, 1, 3] }, { focalLength: 18 }))
    const tele = deriveShotLanguage(sceneWith({ position: [0, 1, 3] }, { focalLength: 135 }))
    const order = ['大特写', '特写', '近景', '中景', '全身', '全景', '远景']
    expect(order.indexOf(tele.shotSize)).toBeLessThan(order.indexOf(wide.shotSize))
  })
})

describe('deriveShotLanguage — 机位高度', () => {
  it.each([
    [0.05, '地面'],
    [0.4, '膝高'],
    [0.9, '腰高'],
    [1.3, '胸高'],
    [1.65, '视平线'],
    [2.4, '高角度俯拍'],
  ])('相机高度 %sm ⇒ %s', (y, expected) => {
    const shot = deriveShotLanguage(sceneWith({ position: [0, y as number, 3] }))
    expect(shot.cameraHeight).toBe(expected)
  })
})

describe('deriveShotLanguage — 朝向', () => {
  it('相机在人偶正前方（+Z）⇒ 正面', () => {
    expect(deriveShotLanguage(sceneWith({ position: [0, 1.6, 3] })).facing).toBe('正面')
  })

  it('相机在人偶正后方（-Z）⇒ 背面', () => {
    expect(deriveShotLanguage(sceneWith({ position: [0, 1.6, -3] })).facing).toBe('背面')
  })

  it('相机在人偶自身右手侧 ⇒ 右侧正侧面（+Z 朝向时右手指向 -X）', () => {
    expect(deriveShotLanguage(sceneWith({ position: [-3, 1.6, 0] })).facing).toBe('右侧正侧面')
  })

  it('相机在人偶自身左手侧 ⇒ 左侧正侧面', () => {
    expect(deriveShotLanguage(sceneWith({ position: [3, 1.6, 0] })).facing).toBe('左侧正侧面')
  })

  it('前方偏侧 ⇒ 四分之三侧面（最常用的叙事角度）', () => {
    expect(deriveShotLanguage(sceneWith({ position: [-2, 1.6, 2] })).facing).toBe('右侧四分之三侧面')
  })

  it('人偶自身旋转 180° 后，同一机位的朝向翻转为背面', () => {
    const scene = sceneWith({ position: [0, 1.6, 3] })
    scene.objects[0].rotation = [0, Math.PI, 0]
    expect(deriveShotLanguage(scene).facing).toBe('背面')
  })
})

describe('deriveShotLanguage — 文本拼接与边界', () => {
  it('拼出 req §3.3 示例形态：`广角全身镜头，膝高机位，右侧四分之三侧面，24mm`', () => {
    const shot = deriveShotLanguage(sceneWith({ position: [-1.5, 0.5, 2.2] }, { focalLength: 24 }))
    expect(shot.text).toBe(
      `${shot.lens}${shot.shotSize}镜头，${shot.cameraHeight}机位，${shot.facing}，24mm`,
    )
    expect(shot.text).toMatch(/^广角.+机位，.+，24mm$/)
  })

  it('焦段按 35mm 等效分档命名', () => {
    const lensOf = (focalLength: number) =>
      deriveShotLanguage(sceneWith({ position: [0, 1.6, 3] }, { focalLength })).lens
    expect(lensOf(16)).toBe('超广角')
    expect(lensOf(24)).toBe('广角')
    expect(lensOf(50)).toBe('标准')
    expect(lensOf(85)).toBe('中长焦')
    expect(lensOf(200)).toBe('长焦')
  })

  it('无人偶（纯道具场景）⇒ 不编造景别与朝向，只报焦段', () => {
    const scene = sceneWith({ position: [0, 1.6, 3] })
    scene.objects = [
      { id: 'obj_9', kind: 'box', name: '', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ]
    const shot = deriveShotLanguage(scene)
    expect(resolveSubject(scene)).toBeNull()
    expect(shot.shotSize).toBe('')
    expect(shot.facing).toBe('')
    expect(shot.text).toBe('标准空镜头，35mm')
  })

  it('人偶缩放影响主体高度（景别推导以实际身高为准）', () => {
    const scene = sceneWith({ position: [0, 1.6, 3] })
    scene.objects[0].scale = [1, 2, 1]
    expect(resolveSubject(scene)!.height).toBeCloseTo(MANNEQUIN_HEIGHT * 2, 5)
  })

  it('同一场景多次推导结果恒等（可重放，供 prompt 拼接稳定）', () => {
    const scene = sceneWith({ position: [-1.2, 1.1, 2.6] }, { focalLength: 40 })
    expect(deriveShotLanguage(scene).text).toBe(deriveShotLanguage(scene).text)
  })
})
