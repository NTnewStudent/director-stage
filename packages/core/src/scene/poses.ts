/**
 * REQ-174 批次 1 人偶姿态表（**纯数据**）。
 *
 * @description 24 个预设姿态，每个姿态是一张「控制键 → 角度（度）/ 米」的稀疏表，
 *   经 {@link resolvePose} 与 `pose-rig.ts` 的绑定表展开成人偶各关节的欧拉角（弧度）。
 *   稀疏是刻意的：没写到的控制键取 {@link BASE} 的立正基线值，表格因此可读。
 *
 *   REQ-173 的 12 个姿态是从旧欧拉角表**逐字段换算**过来的（换算规则见
 *   `pose-rig.ts` 的符号推导），渲染结果逐位不变 —— 有 `poses.spec.ts` 的回归锁守着。
 *   其中 `lie` / `sit` / `crouch` / `sitFloor` 的 4 处数值在换算时一并修正：
 *   旧值把整具人偶压到地面下 0.76m（`lie`）、或让大腿朝身后折（`sit` 系列），
 *   详见 `task/REQ-174/pose-defects.md`。
 *
 *   后 12 个姿态（kneelOne … phone）的**姿态清单与中文名**取自
 *   `jiguang132/storyai-3d-director-desk` 的 `src/editor/presets/mannequinPosePresets.ts`
 *   （MIT，见文件头署名）。**角度数值为本仓库自行标定**：
 *   上游那套数值是相对 UE4 人偶 A-Pose 静止姿态的增量（其静止姿态双臂已外展 25°，
 *   见其 `getUE4NeutralPoseBoneRotations`），且写在 Bip001 的 Z-up 骨骼局部系里，
 *   直接搬到本项目 Y-up 程序化人偶上会整体错位 —— 故只取其「哪些关节参与、幅度多大」
 *   的语义，数值按本项目骨架重标，再用 `poses.spec.ts` 的几何断言逐姿态校验。
 *
 * @see task/REQ-174/req.md §3 批次 1
 */
import type {
  DirectorBuild,
  DirectorPoseKey,
  PoseControlKey,
  PoseControlValues,
  Vec3,
} from './director-scene'
import { POSE_CONTROL_BINDINGS, type PoseJointSlot } from './pose-rig'

/** 单个姿态展开后的全部关节角（弧度）+ 根抬升（米）+ 根旋转 */
export interface PoseSpec {
  /** 根节点整体抬升（米）。坐 / 躺 / 跪需要降低重心 */
  rootY: number
  /** 根节点整体旋转（躺姿靠此躺平） */
  rootRotation: Vec3
  torso: Vec3
  head: Vec3
  armLeftUpper: Vec3
  armLeftLower: Vec3
  armRightUpper: Vec3
  armRightLower: Vec3
  legLeftUpper: Vec3
  legLeftLower: Vec3
  legRightUpper: Vec3
  legRightLower: Vec3
}

const D = Math.PI / 180

/**
 * 立正基线：所有姿态以此为起点做差异覆盖。
 *
 * 手臂自然下垂时绕 Z 轴向外张开 8°、双腿各外撇 2°，避免与躯干穿模（REQ-173 原值）。
 */
const BASE: PoseControlValues = {
  'leftShoulder.spread': 8,
  'rightShoulder.spread': 8,
  'leftHip.spread': 2,
  'rightHip.spread': 2,
}

/** 24 个预设姿态查找表（度 / 米；键即 {@link PoseControlValues}） */
export const DIRECTOR_POSES: Record<DirectorPoseKey, PoseControlValues> = {
  /** 立正 */
  stand: {},

  /** 稍息：单腿外撇 + 髋部微转，比立正自然 */
  standRelaxed: {
    'torso.yaw': 6,
    'leftShoulder.spread': 12,
    'rightShoulder.spread': 6,
    'leftHip.pitch': 4,
    'leftHip.twist': 8,
    'leftHip.spread': 6,
    'rightHip.pitch': -4,
    'rightHip.spread': 2,
  },

  /** 行走：对角摆手摆腿 */
  walk: {
    'leftShoulder.pitch': 28,
    'leftShoulder.spread': 8,
    'rightShoulder.pitch': -28,
    'rightShoulder.spread': 8,
    'leftElbow.bend': 18,
    'rightElbow.bend': 12,
    'leftHip.pitch': -26,
    'leftHip.spread': 2,
    'rightHip.pitch': 22,
    'rightHip.spread': 2,
    'leftKnee.bend': -14,
    'rightKnee.bend': -8,
  },

  /** 奔跑：躯干前倾 + 大幅摆动 */
  run: {
    'torso.pitch': 16,
    'head.pitch': -10,
    'leftShoulder.pitch': 62,
    'leftShoulder.spread': 10,
    'rightShoulder.pitch': -58,
    'rightShoulder.spread': 10,
    'leftElbow.bend': 72,
    'rightElbow.bend': 64,
    'leftHip.pitch': -52,
    'leftHip.spread': 2,
    'rightHip.pitch': 38,
    'rightHip.spread': 2,
    'leftKnee.bend': -30,
    'rightKnee.bend': -64,
  },

  /** 坐（椅面高度约 0.45m）：髋屈 90°、膝屈 90°，小腿垂到地面 */
  sit: {
    'body.offsetY': -0.42,
    'leftShoulder.pitch': 12,
    'leftShoulder.spread': 10,
    'rightShoulder.pitch': 12,
    'rightShoulder.spread': 10,
    'leftElbow.bend': 24,
    'rightElbow.bend': 24,
    'leftHip.pitch': 88,
    'leftHip.spread': 6,
    'rightHip.pitch': 88,
    'rightHip.spread': 6,
    'leftKnee.bend': 88,
    'rightKnee.bend': 88,
  },

  /** 坐地（盘腿）：髋大幅外展 + 膝深屈，双膝落在身前 */
  sitFloor: {
    'body.offsetY': -0.54,
    'torso.pitch': 6,
    'leftShoulder.pitch': 20,
    'leftShoulder.spread': 26,
    'rightShoulder.pitch': 20,
    'rightShoulder.spread': 26,
    'leftElbow.bend': 30,
    'rightElbow.bend': 30,
    'leftHip.pitch': 50,
    'leftHip.twist': 34,
    'leftHip.spread': 46,
    'rightHip.pitch': 50,
    'rightHip.twist': 34,
    'rightHip.spread': 46,
    'leftKnee.bend': 130,
    'rightKnee.bend': 130,
  },

  /** 下蹲：髋膝深屈，重心压低，躯干前倾保持平衡 */
  crouch: {
    'body.offsetY': -0.5,
    'torso.pitch': 22,
    'leftShoulder.pitch': 40,
    'leftShoulder.spread': 10,
    'rightShoulder.pitch': 40,
    'rightShoulder.spread': 10,
    'leftElbow.bend': 40,
    'rightElbow.bend': 40,
    'leftHip.pitch': 96,
    'leftHip.spread': 12,
    'rightHip.pitch': 96,
    'rightHip.spread': 12,
    'leftKnee.bend': 121,
    'rightKnee.bend': 121,
  },

  /** 指向前方：右臂水平前伸 */
  point: {
    'torso.yaw': -8,
    'rightShoulder.pitch': 88,
    'rightShoulder.spread': 6,
    'rightElbow.bend': 4,
    'leftShoulder.spread': 10,
  },

  /** 向上伸手取物：右臂上举 */
  reach: {
    'torso.pitch': -6,
    'head.pitch': -16,
    'rightShoulder.pitch': 155,
    'rightShoulder.spread': 12,
    'rightElbow.bend': 12,
    'leftShoulder.spread': 14,
  },

  /** 平躺：整体绕 X 轴放平 90°，身体轴线抬到离地 0.16m（贴地不穿地） */
  lie: {
    'body.offsetY': 0.16,
    'body.pitch': -90,
    'leftShoulder.spread': 32,
    'rightShoulder.spread': 32,
    'leftHip.spread': 6,
    'rightHip.spread': 6,
  },

  /** 倚靠：整体侧倾 12°（靠墙 / 靠车） */
  lean: {
    'body.roll': 12,
    'torso.yaw': -6,
    'leftShoulder.spread': 16,
    'rightShoulder.pitch': 18,
    'rightShoulder.spread': 12,
    'rightElbow.bend': 30,
    'leftHip.spread': 4,
    'rightHip.pitch': 8,
    'rightHip.spread': 8,
  },

  /** T-Pose：双臂水平展开（比例参考基准） */
  tpose: {
    'leftShoulder.spread': 90,
    'rightShoulder.spread': 90,
  },

  /** 单膝跪：左膝着地，右脚踩在身前 */
  kneelOne: {
    'body.offsetY': -0.52,
    'torso.pitch': 4,
    'leftHip.pitch': 50,
    'leftKnee.bend': 140,
    'rightHip.pitch': 60,
    'rightKnee.bend': -8,
  },

  /** 双膝跪：双膝着地，小腿贴地，上身挺直 */
  kneelTwo: {
    'body.offsetY': -0.48,
    'torso.pitch': -4,
    'leftHip.pitch': 45,
    'rightHip.pitch': 45,
    'leftKnee.bend': 135,
    'rightKnee.bend': 135,
    'leftShoulder.spread': 10,
    'rightShoulder.spread': 10,
    'leftElbow.bend': 8,
    'rightElbow.bend': 8,
  },

  /** 叉腰：双臂外撑、肘部深屈，前臂收向髋部 */
  handsOnHips: {
    'leftShoulder.pitch': -12,
    'leftShoulder.spread': 44,
    'leftShoulder.twist': -25,
    'leftElbow.bend': 75,
    'rightShoulder.pitch': -12,
    'rightShoulder.spread': 44,
    'rightShoulder.twist': -25,
    'rightElbow.bend': 75,
  },

  /**
   * 鞠躬：以髋为轴前倾上身（不是绕脚踝转 —— 根节点枢轴在地面，
   * 大幅 `body.pitch` 会把头甩到身前 1m 外）
   */
  bow: {
    'body.pitch': 10,
    'torso.pitch': 50,
    'head.pitch': -20,
    'leftShoulder.pitch': -20,
    'rightShoulder.pitch': -20,
    'leftShoulder.spread': 10,
    'rightShoulder.spread': 10,
    'leftElbow.bend': 12,
    'rightElbow.bend': 12,
  },

  /** 思考：右手托腮，头微低侧倾 */
  think: {
    'head.pitch': 8,
    'head.roll': -6,
    'rightShoulder.pitch': 30,
    'rightShoulder.spread': 10,
    'rightShoulder.twist': -35,
    'rightElbow.bend': 135,
    'leftShoulder.pitch': -6,
    'leftShoulder.spread': 10,
    'leftElbow.bend': 16,
  },

  /** 格斗：前后开立，双肘收拢护住上身 */
  fight: {
    'body.yaw': -12,
    'torso.yaw': 8,
    'leftShoulder.pitch': 32,
    'leftShoulder.spread': 12,
    'leftShoulder.twist': -20,
    'leftElbow.bend': 88,
    'rightShoulder.pitch': 38,
    'rightShoulder.spread': 12,
    'rightShoulder.twist': -20,
    'rightElbow.bend': 95,
    'leftHip.pitch': -18,
    'leftHip.spread': 16,
    'leftKnee.bend': 22,
    'rightHip.pitch': 16,
    'rightHip.spread': 16,
    'rightKnee.bend': 26,
  },

  /** 踢球：右腿前踢，左腿支撑，上身后仰配平 */
  kick: {
    'body.pitch': -12,
    'torso.pitch': -8,
    'leftHip.pitch': 8,
    'leftKnee.bend': 20,
    'rightHip.pitch': 68,
    'rightKnee.bend': 18,
    'leftShoulder.pitch': -22,
    'leftShoulder.spread': 32,
    'rightShoulder.pitch': 28,
    'rightShoulder.spread': 28,
    'leftElbow.bend': 30,
    'rightElbow.bend': 40,
  },

  /** 投掷：躯干拧转，右臂甩到前上方 */
  throw: {
    'body.offsetY': -0.08,
    'body.yaw': 22,
    'torso.yaw': -14,
    'head.yaw': 8,
    'rightShoulder.pitch': 75,
    'rightShoulder.spread': -14,
    'rightShoulder.twist': 28,
    'rightElbow.bend': 55,
    'leftShoulder.pitch': -30,
    'leftShoulder.spread': 24,
    'leftElbow.bend': 40,
    'leftHip.pitch': -18,
    'leftHip.spread': 12,
    'leftKnee.bend': 26,
    'rightHip.pitch': 22,
    'rightHip.spread': 18,
    'rightKnee.bend': 16,
  },

  /** 推进：双臂前平举发力，重心前压 */
  push: {
    'body.offsetY': -0.05,
    'body.pitch': 10,
    'leftShoulder.pitch': 88,
    'leftShoulder.spread': -6,
    'leftElbow.bend': 8,
    'rightShoulder.pitch': 88,
    'rightShoulder.spread': -6,
    'rightElbow.bend': 8,
    'leftHip.pitch': -22,
    'leftHip.spread': 12,
    'leftKnee.bend': 34,
    'rightHip.pitch': 26,
    'rightHip.spread': 14,
    'rightKnee.bend': 18,
  },

  /** 招手：右臂举过肩、肘部深屈，左臂自然下垂 */
  wave: {
    'rightShoulder.pitch': 118,
    'rightShoulder.spread': 46,
    'rightShoulder.twist': 20,
    'rightElbow.bend': 62,
    'leftShoulder.pitch': -8,
    'leftShoulder.spread': 10,
    'leftElbow.bend': 18,
  },

  /** 抱臂：双臂在胸前交叉，肘部托住对侧上臂 */
  crossArms: {
    'leftShoulder.pitch': 34,
    'leftShoulder.spread': -34,
    'leftShoulder.twist': -70,
    'leftElbow.bend': 80,
    'rightShoulder.pitch': 30,
    'rightShoulder.spread': -48,
    'rightShoulder.twist': 40,
    'rightElbow.bend': 90,
  },

  /** 看手机：低头，双臂抬到胸前持机 */
  phone: {
    'head.pitch': 26,
    'torso.pitch': 8,
    'leftShoulder.pitch': 44,
    'leftShoulder.spread': -8,
    'leftShoulder.twist': 30,
    'leftElbow.bend': 88,
    'rightShoulder.pitch': 46,
    'rightShoulder.spread': -8,
    'rightShoulder.twist': -30,
    'rightElbow.bend': 92,
  },
}

/**
 * 把「预设姿态 + 关节微调覆盖层」展开成人偶各关节的欧拉角（弧度）。
 *
 * @description 覆盖层是**逐键叠加**：预设给整体姿态，`controls` 里写到的键才覆盖它，
 *   其余回落预设值 —— 用户只调一个手腕时不会把整具姿态重置成立正。
 * @param pose 预设姿态 key；未知 key 回落 `stand`
 * @param controls 关节微调覆盖层（角度制 / 米，已归一化）
 * @returns 各关节欧拉角（弧度）+ 根抬升（米），可直接喂给 three 的 `rotation`
 */
export function resolvePose(pose: DirectorPoseKey, controls?: PoseControlValues): PoseSpec {
  const spec: PoseSpec = {
    rootY: 0,
    rootRotation: [0, 0, 0],
    torso: [0, 0, 0],
    head: [0, 0, 0],
    armLeftUpper: [0, 0, 0],
    armLeftLower: [0, 0, 0],
    armRightUpper: [0, 0, 0],
    armRightLower: [0, 0, 0],
    legLeftUpper: [0, 0, 0],
    legLeftLower: [0, 0, 0],
    legRightUpper: [0, 0, 0],
    legRightLower: [0, 0, 0],
  }

  const merged: PoseControlValues = { ...BASE, ...DIRECTOR_POSES[pose], ...controls }
  for (const [key, raw] of Object.entries(merged) as [keyof PoseControlValues, number][]) {
    if (raw === undefined) continue
    if (key === 'body.offsetY') {
      spec.rootY = raw
      continue
    }
    const binding = POSE_CONTROL_BINDINGS[key]
    // 键集合由类型保证穷尽；这里兜底只防 `data.scene` 里混入的未来键
    if (!binding) continue
    const target = spec[binding.slot as PoseJointSlot]
    target[binding.axis] = raw * binding.sign * D
  }
  return spec
}

/**
 * 取某个控制键在「预设 + 微调」下的最终取值（度 / 米）。
 *
 * @description `poseControls` 是稀疏覆盖层，未写到的键要回落到预设值、再回落到立正基线，
 *   否则 UI 滑块会把「预设里没写、但基线给了 8°」的手臂显示为 0°，与所见姿态对不上。
 * @param pose 预设姿态 key
 * @param controls 关节微调覆盖层
 * @param key 控制键
 * @returns 该控制键的生效取值
 */
export function resolveControlValue(
  pose: DirectorPoseKey,
  controls: PoseControlValues | undefined,
  key: PoseControlKey,
): number {
  return controls?.[key] ?? DIRECTOR_POSES[pose]?.[key] ?? BASE[key] ?? 0
}

/** 体型基底 → 躯干 / 四肢横向缩放系数（只改宽度，不改身高） */
export const BUILD_WIDTH: Record<DirectorBuild, number> = {
  slim: 0.85,
  standard: 1,
  heavy: 1.28,
}
