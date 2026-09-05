/**
 * REQ-173 导演台 3D 场景数据模型（**纯数据，零 three 依赖**）。
 *
 * @description 本模块只描述「场景里有什么」，不含任何 WebGL / three 代码，因此可以
 *   被画布主 chunk 安全引用（`store.defaultNodeData('director')` 需要它造默认场景），
 *   而真正的 3D 渲染栈仍全部留在懒加载的 `DirectorStageModal` 分包里。
 *
 *   人偶与道具**全部为本仓库自建的程序化低模**（three 基础几何体拼装，见
 *   `components/director/Mannequin.tsx`），不引入任何第三方 GLB / 贴图资产，
 *   从而彻底规避 REQ-173 §6 R4 的模型授权风险。
 *
 * @see docs/api-contracts/client/workflow-canvas.md#RULE_DIRECTOR_STAGE
 * @see task/REQ-173/req.md
 */

/** 场景 schema 版本；不兼容变更时递增并在 {@link normalizeDirectorScene} 内做迁移 */
export const DIRECTOR_SCENE_VERSION = 1

/** 人偶基准身高（米）。地面为 y=0，场景单位统一为米 */
export const MANNEQUIN_HEIGHT = 1.75

/** 可摆放对象种类：人偶 + 三种基础几何道具（墙 / 桌 / 车的替身） */
export type DirectorObjectKind = 'mannequin' | 'box' | 'cylinder' | 'plane'

/** 人偶体型基底（只改宽度比例，不改身高） */
export type DirectorBuild = 'slim' | 'standard' | 'heavy'

/** 三元组（位置 / 欧拉角（弧度）/ 缩放） */
export type Vec3 = [number, number, number]

/**
 * 预设姿态 key（24 个，本期不做 IK、不做骨骼拖拽 —— req §3.5）。
 *
 * @description REQ-173 的 12 个在前（顺序与取值一律不动，保证存量画布重开后姿态不变）；
 *   REQ-174 批次 1 新增的 12 个追加在后。姿态 id 取自
 *   `jiguang132/storyai-3d-director-desk` 的 `mannequinPosePresets.ts`（MIT），
 *   但按本项目命名惯例转 camelCase；其 `t-pose` 与 REQ-173 的 `tpose` 同义，已合并为 `tpose`。
 */
export type DirectorPoseKey =
  | 'stand'
  | 'standRelaxed'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sitFloor'
  | 'crouch'
  | 'point'
  | 'reach'
  | 'lie'
  | 'lean'
  | 'tpose'
  | 'kneelOne'
  | 'kneelTwo'
  | 'handsOnHips'
  | 'bow'
  | 'think'
  | 'fight'
  | 'kick'
  | 'throw'
  | 'push'
  | 'wave'
  | 'crossArms'
  | 'phone'

/** 预设姿态展示顺序（下拉列表顺序，同时是 i18n key 顺序） */
export const DIRECTOR_POSE_KEYS: readonly DirectorPoseKey[] = [
  'stand',
  'standRelaxed',
  'walk',
  'run',
  'sit',
  'sitFloor',
  'crouch',
  'point',
  'reach',
  'lie',
  'lean',
  'tpose',
  'kneelOne',
  'kneelTwo',
  'handsOnHips',
  'bow',
  'think',
  'fight',
  'kick',
  'throw',
  'push',
  'wave',
  'crossArms',
  'phone',
]

/**
 * 人形姿态控制键（25 个角度键 + 1 个根位移键，单位：度 / 米）。
 *
 * @description 引擎无关的通用抽象列表，源自
 *   `jiguang132/storyai-3d-director-desk` 的 `src/editor/presets/skeletonMappings.ts`
 *   （MIT，见文件头署名）。它只描述「人体有哪 25 个可控自由度」，不含骨骼名与轴向，
 *   落到本项目人偶的哪根骨头、哪个轴、什么符号，由 `components/director/pose-rig.ts`
 *   的绑定表决定（REQ-174 批次 1 的两阶段映射）。
 *
 *   语义约定（与 `pose-rig.ts` 的绑定表共同成立）：
 *   - `pitch` 正 = 肢体向**前**摆（人偶正面为 +Z）；
 *   - `spread` 正 = 向**体外**张开；
 *   - `twist` 正 = 沿肢体自身轴线向**外**旋；
 *   - `bend` 正 = **屈**曲（肘向前弯、膝向后弯），负 = 过伸；
 *   - `body.offsetY` 为线性抬升（米），非角度。
 */
export const POSE_CONTROL_KEYS = [
  'body.offsetY',
  'body.pitch',
  'body.yaw',
  'body.roll',
  'torso.pitch',
  'torso.yaw',
  'torso.roll',
  'head.pitch',
  'head.yaw',
  'head.roll',
  'leftShoulder.pitch',
  'leftShoulder.spread',
  'leftShoulder.twist',
  'rightShoulder.pitch',
  'rightShoulder.spread',
  'rightShoulder.twist',
  'leftElbow.bend',
  'rightElbow.bend',
  'leftHip.pitch',
  'leftHip.spread',
  'leftHip.twist',
  'rightHip.pitch',
  'rightHip.spread',
  'rightHip.twist',
  'leftKnee.bend',
  'rightKnee.bend',
] as const

export type PoseControlKey = (typeof POSE_CONTROL_KEYS)[number]

/** 关节微调面板的分组（UI 折叠依据，同时决定滑块排列顺序） */
export type PoseControlGroup =
  | 'root'
  | 'torso'
  | 'head'
  | 'armLeft'
  | 'armRight'
  | 'legLeft'
  | 'legRight'

/** 单个控制键的元数据（钳制范围来自人形关节的生理可动域，超出即渲染成穿模 / 反关节） */
export interface PoseControlSpec {
  key: PoseControlKey
  group: PoseControlGroup
  /** 滑块下界（`unit` 单位） */
  min: number
  /** 滑块上界（`unit` 单位） */
  max: number
  /** 滑块步长 */
  step: number
  unit: 'deg' | 'm'
}

/** 26 个控制键的元数据表；`POSE_CONTROL_KEYS` 与它同序、同集合 */
export const POSE_CONTROLS: readonly PoseControlSpec[] = [
  { key: 'body.offsetY', group: 'root', min: -1, max: 0.4, step: 0.01, unit: 'm' },
  { key: 'body.pitch', group: 'root', min: -90, max: 90, step: 1, unit: 'deg' },
  { key: 'body.yaw', group: 'root', min: -180, max: 180, step: 1, unit: 'deg' },
  { key: 'body.roll', group: 'root', min: -90, max: 90, step: 1, unit: 'deg' },
  { key: 'torso.pitch', group: 'torso', min: -45, max: 60, step: 1, unit: 'deg' },
  { key: 'torso.yaw', group: 'torso', min: -60, max: 60, step: 1, unit: 'deg' },
  { key: 'torso.roll', group: 'torso', min: -45, max: 45, step: 1, unit: 'deg' },
  { key: 'head.pitch', group: 'head', min: -60, max: 60, step: 1, unit: 'deg' },
  { key: 'head.yaw', group: 'head', min: -90, max: 90, step: 1, unit: 'deg' },
  { key: 'head.roll', group: 'head', min: -45, max: 45, step: 1, unit: 'deg' },
  { key: 'leftShoulder.pitch', group: 'armLeft', min: -180, max: 180, step: 1, unit: 'deg' },
  // 下界取 -60：抱臂 / 护胸这类姿态需要手臂越过身体中线，卡在 0 会让抱臂摆不出来
  { key: 'leftShoulder.spread', group: 'armLeft', min: -60, max: 180, step: 1, unit: 'deg' },
  { key: 'leftShoulder.twist', group: 'armLeft', min: -90, max: 90, step: 1, unit: 'deg' },
  { key: 'leftElbow.bend', group: 'armLeft', min: -20, max: 150, step: 1, unit: 'deg' },
  { key: 'rightShoulder.pitch', group: 'armRight', min: -180, max: 180, step: 1, unit: 'deg' },
  { key: 'rightShoulder.spread', group: 'armRight', min: -60, max: 180, step: 1, unit: 'deg' },
  { key: 'rightShoulder.twist', group: 'armRight', min: -90, max: 90, step: 1, unit: 'deg' },
  { key: 'rightElbow.bend', group: 'armRight', min: -20, max: 150, step: 1, unit: 'deg' },
  { key: 'leftHip.pitch', group: 'legLeft', min: -120, max: 120, step: 1, unit: 'deg' },
  { key: 'leftHip.spread', group: 'legLeft', min: -30, max: 90, step: 1, unit: 'deg' },
  { key: 'leftHip.twist', group: 'legLeft', min: -45, max: 45, step: 1, unit: 'deg' },
  { key: 'leftKnee.bend', group: 'legLeft', min: -90, max: 160, step: 1, unit: 'deg' },
  { key: 'rightHip.pitch', group: 'legRight', min: -120, max: 120, step: 1, unit: 'deg' },
  { key: 'rightHip.spread', group: 'legRight', min: -30, max: 90, step: 1, unit: 'deg' },
  { key: 'rightHip.twist', group: 'legRight', min: -45, max: 45, step: 1, unit: 'deg' },
  { key: 'rightKnee.bend', group: 'legRight', min: -90, max: 160, step: 1, unit: 'deg' },
]

/** 控制键 → 元数据；查表用，避免 UI 与归一化各写一份范围 */
export const POSE_CONTROL_BY_KEY: Record<PoseControlKey, PoseControlSpec> = Object.fromEntries(
  POSE_CONTROLS.map((spec) => [spec.key, spec]),
) as Record<PoseControlKey, PoseControlSpec>

/** 姿态取值表：预设姿态与关节微调覆盖层共用同一形态（角度制 / 米） */
export type PoseControlValues = Partial<Record<PoseControlKey, number>>

/**
 * 把 graph 里读回的任意 `poseControls` 归一化为合法 {@link PoseControlValues}。
 *
 * @description `data.scene` 是自由 JSON，微调层可能是别的客户端写坏的版本：未知控制键
 *   一律丢弃（人偶没有对应关节，留着只会让渲染层查表落空），数值按各关节生理可动域钳制。
 * @param raw 原始值（任意类型）
 * @returns 合法取值表；无任何可用项时返回 `undefined`（等价于「无微调」，省一份空对象）
 */
export function normalizePoseControls(raw: unknown): PoseControlValues | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const source = raw as Record<string, unknown>
  const out: PoseControlValues = {}
  for (const spec of POSE_CONTROLS) {
    const value = source[spec.key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    out[spec.key] = clamp(value, spec.min, spec.max)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 场景内单个可摆放对象 */
export interface DirectorObject {
  /** 场景内唯一 id（`obj_<seq>`，由 {@link nextDirectorObjectId} 生成） */
  id: string
  kind: DirectorObjectKind
  /** 用户可见名（默认按类型 + 序号，如「人偶 1」） */
  name: string
  position: Vec3
  /** 欧拉角，弧度（XYZ 序，与 three 默认一致） */
  rotation: Vec3
  scale: Vec3
  /** 人偶专属：体型基底；非人偶忽略 */
  build?: DirectorBuild
  /** 人偶专属：预设姿态；非人偶忽略 */
  pose?: DirectorPoseKey
  /**
   * 人偶专属：关节微调覆盖层（REQ-174 批次 1）。
   *
   * @description **叠加**在 `pose` 预设之上而非替换：预设给出整体姿态，本表只覆盖写到的
   *   那几个控制键（因此用户微调某一根手指不会影响其它关节）。未写到的键回落预设值。
   *   键见 {@link POSE_CONTROL_KEYS}，单位与范围见 {@link POSE_CONTROLS}。
   */
  poseControls?: PoseControlValues
}

/** 相机状态（位置 + 视点；朝向由两者相减得出，避免存冗余四元数） */
export interface DirectorCamera {
  position: Vec3
  /** 目标点（CameraControls 的 target） */
  target: Vec3
}

/**
 * 画幅比例档位。与生成节点口径一致（`videoConfigV2` / `klingOmniVideo` 的 5 档），
 * 不引入生成节点没有的比例，避免截图落 image 节点后与下游画幅口径打架。
 */
export const DIRECTOR_RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9', '3:4'] as const
export type DirectorRatio = (typeof DIRECTOR_RATIOS)[number]

/** 焦距（mm，等效 35mm 全画幅）可选档位；同时是滑杆的取值边界 */
export const DIRECTOR_FOCAL_MIN = 14
export const DIRECTOR_FOCAL_MAX = 200
/** 默认焦距（35mm：常规叙事镜头） */
export const DIRECTOR_FOCAL_DEFAULT = 35

/** 完整场景（`director` 节点 `data.scene`，原样入 graph；后端不解析） */
export interface DirectorScene {
  version: number
  objects: DirectorObject[]
  camera: DirectorCamera
  /** 焦距（mm，等效 35mm 全画幅） */
  focalLength: number
  ratio: DirectorRatio
}

/** 画幅比例 → 数值宽高比 */
export function ratioToAspect(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number)
  if (!w || !h || w <= 0 || h <= 0) return 16 / 9
  return w / h
}

/**
 * 默认场景：一个站姿标准体型人偶居中，相机在其前方略偏右的腰高位置。
 *
 * @returns 全新的默认场景对象（每次调用返回独立引用，可安全 mutate）
 */
export function createDefaultDirectorScene(): DirectorScene {
  return {
    version: DIRECTOR_SCENE_VERSION,
    objects: [
      {
        id: 'obj_1',
        kind: 'mannequin',
        name: '',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        build: 'standard',
        pose: 'stand',
      },
    ],
    camera: {
      position: [1.6, 1.15, 3.2],
      target: [0, MANNEQUIN_HEIGHT * 0.55, 0],
    },
    focalLength: DIRECTOR_FOCAL_DEFAULT,
    ratio: '16:9',
  }
}

/**
 * 生成场景内下一个对象 id（`obj_<max+1>`，编号不复用，删除后不回填）。
 * @param objects 当前对象列表
 * @returns 新对象 id
 */
export function nextDirectorObjectId(objects: readonly DirectorObject[]): string {
  let max = 0
  for (const o of objects) {
    const m = /^obj_(\d+)$/.exec(o.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `obj_${max + 1}`
}

const OBJECT_KINDS: readonly DirectorObjectKind[] = ['mannequin', 'box', 'cylinder', 'plane']
const BUILDS: readonly DirectorBuild[] = ['slim', 'standard', 'heavy']

/** 读一个有限数字；非法回落 fallback（NaN / Infinity / 非数字都算非法） */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** 读三元组；缺项按 fallback 逐位补齐 */
function vec3(value: unknown, fallback: Vec3): Vec3 {
  if (!Array.isArray(value)) return [...fallback]
  return [num(value[0], fallback[0]), num(value[1], fallback[1]), num(value[2], fallback[2])]
}

/** 数值夹到 [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 把 graph 里读回的任意 `data.scene` 归一化为合法 {@link DirectorScene}。
 *
 * @description graph 的 `data` 是自由 JSON（后端原样存取、不校验），因此重开画布时
 *   拿到的可能是旧版本、被别的客户端写坏、或干脆是 `undefined`。本函数是场景的**唯一
 *   入口**：任何非法字段都静默回落到默认值，保证 3D 视口永远拿到可渲染的数据，
 *   而不是在 render 阶段崩在 `NaN` 坐标上。
 * @param raw 从 `data.scene` 读出的原始值（任意类型）
 * @returns 结构完整、数值有限的场景；`raw` 完全不可用时返回默认场景
 */
export function normalizeDirectorScene(raw: unknown): DirectorScene {
  const fallback = createDefaultDirectorScene()
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Partial<DirectorScene> & { objects?: unknown; camera?: unknown }

  const objects: DirectorObject[] = Array.isArray(r.objects)
    ? r.objects.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return []
        const o = item as Partial<DirectorObject>
        const kind = OBJECT_KINDS.includes(o.kind as DirectorObjectKind)
          ? (o.kind as DirectorObjectKind)
          : null
        // 未知 kind 无法渲染（也无法猜测语义）⇒ 丢弃该条目而非整场景回落
        if (!kind) return []
        const scale = vec3(o.scale, [1, 1, 1])
        const controls = normalizePoseControls(o.poseControls)
        return [
          {
            id: typeof o.id === 'string' && o.id ? o.id : `obj_${index + 1}`,
            kind,
            name: typeof o.name === 'string' ? o.name : '',
            position: vec3(o.position, [0, 0, 0]),
            rotation: vec3(o.rotation, [0, 0, 0]),
            // 0 / 负缩放会让 gizmo 与包围盒推导退化，钉到最小 0.05
            scale: [
              clamp(Math.abs(scale[0]) || 1, 0.05, 100),
              clamp(Math.abs(scale[1]) || 1, 0.05, 100),
              clamp(Math.abs(scale[2]) || 1, 0.05, 100),
            ],
            ...(kind === 'mannequin'
              ? {
                  build: BUILDS.includes(o.build as DirectorBuild) ? (o.build as DirectorBuild) : 'standard',
                  pose: DIRECTOR_POSE_KEYS.includes(o.pose as DirectorPoseKey)
                    ? (o.pose as DirectorPoseKey)
                    : 'stand',
                  ...(controls ? { poseControls: controls } : {}),
                }
              : {}),
          },
        ]
      })
    : fallback.objects

  const cameraRaw = (r.camera ?? {}) as Partial<DirectorCamera>
  return {
    version: DIRECTOR_SCENE_VERSION,
    objects,
    camera: {
      position: vec3(cameraRaw.position, fallback.camera.position),
      target: vec3(cameraRaw.target, fallback.camera.target),
    },
    focalLength: clamp(
      Math.round(num(r.focalLength, DIRECTOR_FOCAL_DEFAULT)),
      DIRECTOR_FOCAL_MIN,
      DIRECTOR_FOCAL_MAX,
    ),
    ratio: (DIRECTOR_RATIOS as readonly string[]).includes(r.ratio as string)
      ? (r.ratio as DirectorRatio)
      : '16:9',
  }
}
