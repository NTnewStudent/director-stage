/**
 * REQ-174 批次 1 控制键 → 人偶关节绑定表（**纯数据，零 three 依赖**）。
 *
 * @description 两阶段映射的第二阶段：{@link PoseControlKey} 是引擎无关的 25 个自由度，
 *   本表负责把它们落到 REQ-173 程序化人偶的具体关节槽位上 ——
 *   「哪个关节、哪个欧拉轴、什么符号」。换骨骼人偶（批次 3）时只改这一张表，
 *   姿态预设与序列化格式一概不动。
 *
 *   符号推导（人偶正面为局部 +Z，肢体沿局部 -Y 垂下，three 欧拉序 XYZ）：
 *   - `pitch` 写 X 轴。X 正把 -Y 转向 -Z（向后），故取符号 -1，令 pitch 正 = 前摆。
 *   - `spread` 写 Z 轴。Z 正把 -Y 转向 +X，左侧（+X）即体外，右侧取反号镜像。
 *   - `twist` 写 Y 轴（肢体自身轴线），左右取反号使正值语义一致（同向外旋）。
 *   - 肘 `bend` 写 X 轴，向前屈 ⇒ 符号 -1；膝 `bend` 向后屈 ⇒ 符号 +1。两者方向相反
 *     是解剖事实（肘膝对屈），不是约定冲突。
 *
 *   沿用 storyai 的「控制键 → 关节 + 轴向 + 符号 + 钳制」两阶段思路（MIT）；
 *   其 `ue4MannequinRig.ts` 的 `Bip001_*` 骨骼名与英寸换算一并弃用 —— 绑死 3ds Max
 *   Biped，对本项目的程序化人偶无意义。
 *
 * @see task/REQ-174/req.md §3 批次 1
 */
import type { PoseControlKey } from './director-scene'

/** 人偶关节槽位（与 {@link PoseSpec} 的字段一一对应） */
export type PoseJointSlot =
  | 'rootRotation'
  | 'torso'
  | 'head'
  | 'armLeftUpper'
  | 'armLeftLower'
  | 'armRightUpper'
  | 'armRightLower'
  | 'legLeftUpper'
  | 'legLeftLower'
  | 'legRightUpper'
  | 'legRightLower'

/** 欧拉三元组下标 */
export type EulerAxis = 0 | 1 | 2

export interface PoseBinding {
  slot: PoseJointSlot
  axis: EulerAxis
  /** 控制值 → 关节欧拉角的符号（左右镜像与轴向正负都由它承担） */
  sign: 1 | -1
}

/**
 * 25 个角度控制键的绑定表。`body.offsetY` 是线性抬升、直接写 `rootY`，不在此表内。
 */
export const POSE_CONTROL_BINDINGS: Record<
  Exclude<PoseControlKey, 'body.offsetY'>,
  PoseBinding
> = {
  'body.pitch': { slot: 'rootRotation', axis: 0, sign: 1 },
  'body.yaw': { slot: 'rootRotation', axis: 1, sign: 1 },
  'body.roll': { slot: 'rootRotation', axis: 2, sign: 1 },
  'torso.pitch': { slot: 'torso', axis: 0, sign: 1 },
  'torso.yaw': { slot: 'torso', axis: 1, sign: 1 },
  'torso.roll': { slot: 'torso', axis: 2, sign: 1 },
  'head.pitch': { slot: 'head', axis: 0, sign: 1 },
  'head.yaw': { slot: 'head', axis: 1, sign: 1 },
  'head.roll': { slot: 'head', axis: 2, sign: 1 },
  'leftShoulder.pitch': { slot: 'armLeftUpper', axis: 0, sign: -1 },
  'leftShoulder.spread': { slot: 'armLeftUpper', axis: 2, sign: 1 },
  'leftShoulder.twist': { slot: 'armLeftUpper', axis: 1, sign: 1 },
  'leftElbow.bend': { slot: 'armLeftLower', axis: 0, sign: -1 },
  'rightShoulder.pitch': { slot: 'armRightUpper', axis: 0, sign: -1 },
  'rightShoulder.spread': { slot: 'armRightUpper', axis: 2, sign: -1 },
  'rightShoulder.twist': { slot: 'armRightUpper', axis: 1, sign: -1 },
  'rightElbow.bend': { slot: 'armRightLower', axis: 0, sign: -1 },
  'leftHip.pitch': { slot: 'legLeftUpper', axis: 0, sign: -1 },
  'leftHip.spread': { slot: 'legLeftUpper', axis: 2, sign: 1 },
  'leftHip.twist': { slot: 'legLeftUpper', axis: 1, sign: 1 },
  'leftKnee.bend': { slot: 'legLeftLower', axis: 0, sign: 1 },
  'rightHip.pitch': { slot: 'legRightUpper', axis: 0, sign: -1 },
  'rightHip.spread': { slot: 'legRightUpper', axis: 2, sign: -1 },
  'rightHip.twist': { slot: 'legRightUpper', axis: 1, sign: -1 },
  'rightKnee.bend': { slot: 'legRightLower', axis: 0, sign: 1 },
}
