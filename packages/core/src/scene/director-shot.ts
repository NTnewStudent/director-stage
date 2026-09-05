/**
 * REQ-173 镜头语言推导（**纯函数，零 three 依赖**）。
 *
 * @description 从相机位置 / 视点 / 焦距 + 主体人偶包围盒推导出「景别 + 机位高度 +
 *   朝向 + 焦段」，拼成一段中文镜头描述（如
 *   `广角全身镜头，膝高机位，右侧四分之三侧面，24mm`），写入 `director` 节点
 *   `data.shotText`，经 `promptOrder` 边参与既有确定性 prompt 拼接。
 *
 *   刻意不依赖 three：几何量全部是三元组上的初等运算，因此本模块可以进画布主 chunk
 *   并被单测直接覆盖，无需拉起 WebGL。
 *
 *   输出文案固定中文：它是**下发给模型的 prompt 内容**而非 UI chrome，与后端
 *   `COMPOSED_PROMPT_IMAGE_REF_PREFIX`（'请参考输入的图片生成'）同性质，
 *   不随界面语言切换（否则同一场景在中英界面下会生成不同的图）。
 *
 * @see docs/api-contracts/client/workflow-canvas.md#RULE_DIRECTOR_STAGE
 * @see task/REQ-173/req.md §3.3
 */
import {
  MANNEQUIN_HEIGHT,
  ratioToAspect,
  type DirectorObject,
  type DirectorScene,
  type Vec3,
} from './director-scene'

/**
 * three `PerspectiveCamera` 默认 `filmGauge`（mm）。焦距 ↔ FOV 换算必须与
 * `THREE.PerspectiveCamera.setFocalLength` 同公式，否则「视口所见」与「推导出的景别」
 * 会对不上（用户看到全身、文本说中景）。
 */
const FILM_GAUGE = 35

/**
 * 焦距（mm）换算为**垂直** FOV（度），口径与 `THREE.PerspectiveCamera.setFocalLength` 一致。
 *
 * @param focalLength 等效 35mm 焦距（mm）
 * @param aspect 画幅宽高比（宽 / 高）
 * @returns 垂直 FOV（度）
 */
export function focalToVerticalFov(focalLength: number, aspect: number): number {
  const filmHeight = FILM_GAUGE / Math.max(aspect, 1)
  return (2 * Math.atan(filmHeight / (2 * Math.max(focalLength, 1)))) * (180 / Math.PI)
}

/** 主体包围盒（只需高度与中心，道具不参与主体判定） */
export interface SubjectBox {
  /** 主体实际高度（米，含 scale） */
  height: number
  /** 主体几何中心（米） */
  center: Vec3
  /** 主体朝向 yaw（弧度，绕 Y 轴；局部 +Z 为正面） */
  yaw: number
}

/**
 * 取场景主体：第一个人偶。没有人偶时返回 null（纯道具场景无「景别 / 朝向」语义）。
 *
 * @param scene 场景
 * @returns 主体包围盒；场景内无人偶时为 null
 */
export function resolveSubject(scene: DirectorScene): SubjectBox | null {
  const mannequin: DirectorObject | undefined = scene.objects.find((o) => o.kind === 'mannequin')
  if (!mannequin) return null
  const height = MANNEQUIN_HEIGHT * Math.abs(mannequin.scale[1] || 1)
  return {
    height,
    center: [mannequin.position[0], mannequin.position[1] + height / 2, mannequin.position[2]],
    yaw: mannequin.rotation[1],
  }
}

/** 结构化镜头语言（`shotText` 的各组成部分，供 UI 分别展示与单测断言） */
export interface ShotLanguage {
  /** 镜头焦段（超广角 / 广角 / 标准 / 中长焦 / 长焦） */
  lens: string
  /** 景别（远景 / 全景 / 全身 / 中景 / 近景 / 特写 / 大特写）；无主体时为空串 */
  shotSize: string
  /** 机位高度（地面 / 膝高 / 腰高 / 胸高 / 视平线 / 高角度俯拍）；无主体时为空串 */
  cameraHeight: string
  /** 主体朝向（正面 / 左侧四分之三侧面 / 右侧正侧面 …）；无主体时为空串 */
  facing: string
  /** 焦距（mm，整数） */
  focalLength: number
  /** 画幅比例（原样透出，便于 UI 展示；不入 shotText —— 画幅由 image 节点自身承载） */
  ratio: string
  /** 拼接好的完整中文描述（写入 `data.shotText`） */
  text: string
}

/** 焦段命名（分界与常见 35mm 等效焦段习惯一致） */
function lensName(focalLength: number): string {
  if (focalLength < 20) return '超广角'
  if (focalLength < 35) return '广角'
  if (focalLength < 60) return '标准'
  if (focalLength < 105) return '中长焦'
  return '长焦'
}

/**
 * 景别命名。判据是「画面垂直可容纳的主体身高倍数」`framed`：
 * framed=1 表示主体正好占满画面高度（全身），framed=0.5 表示只看到半个身子（中景）。
 */
function shotSizeName(framed: number): string {
  if (framed >= 3) return '远景'
  if (framed >= 1.5) return '全景'
  if (framed >= 0.95) return '全身'
  if (framed >= 0.6) return '中景'
  if (framed >= 0.35) return '近景'
  if (framed >= 0.18) return '特写'
  return '大特写'
}

/** 机位高度命名（相机高度 / 主体身高的比值；1.0 ≈ 头顶，0.91 ≈ 视平线） */
function cameraHeightName(ratio: number): string {
  if (ratio < 0.1) return '地面'
  if (ratio < 0.33) return '膝高'
  if (ratio < 0.6) return '腰高'
  if (ratio < 0.8) return '胸高'
  if (ratio < 1.05) return '视平线'
  return '高角度俯拍'
}

/**
 * 朝向命名：`angle` 为「相机方位」与「主体正面朝向」的夹角（度，0 = 正对镜头），
 * `side` 为**主体自身**的左 / 右（摄影惯例：「右侧侧面」= 看到主体右半边脸，
 * 而非「相机在画面右边」）。
 */
function facingName(angle: number, side: '左侧' | '右侧'): string {
  if (angle < 22.5) return '正面'
  if (angle > 157.5) return '背面'
  if (angle < 67.5) return `${side}四分之三侧面`
  if (angle < 112.5) return `${side}正侧面`
  return `${side}背侧面`
}

/**
 * 推导场景的结构化镜头语言。
 *
 * @param scene 已归一化的场景（相机 / 焦距 / 画幅 / 对象）
 * @returns 结构化镜头语言 + 拼接好的中文 `text`
 */
export function deriveShotLanguage(scene: DirectorScene): ShotLanguage {
  const focalLength = Math.round(scene.focalLength)
  const lens = lensName(focalLength)
  const subject = resolveSubject(scene)

  if (!subject) {
    // 纯道具 / 空场景：没有主体就没有景别与朝向，只报焦段（避免编造「全身」这类错误信息）
    return {
      lens,
      shotSize: '',
      cameraHeight: '',
      facing: '',
      focalLength,
      ratio: scene.ratio,
      text: `${lens}空镜头，${focalLength}mm`,
    }
  }

  const [cx, cy, cz] = scene.camera.position
  const [sx, sy, sz] = subject.center

  // 景别：画面在主体距离处的垂直可视高度 ÷ 主体身高
  const distance = Math.hypot(cx - sx, cy - sy, cz - sz)
  const fov = focalToVerticalFov(focalLength, ratioToAspect(scene.ratio))
  const visibleHeight = 2 * Math.max(distance, 0.01) * Math.tan((fov * Math.PI) / 360)
  const shotSize = shotSizeName(visibleHeight / Math.max(subject.height, 0.01))

  // 机位高度：相机绝对高度相对主体身高（主体脚底为 center.y - height/2）
  const footY = sy - subject.height / 2
  const cameraHeight = cameraHeightName((cy - footY) / Math.max(subject.height, 0.01))

  // 朝向：人偶正面为局部 +Z（glTF 惯例），绕 Y 旋转 yaw 后为 (sin yaw, cos yaw)。
  // 主体自身的「右手方向」在 +Z 朝向下是 -X（three 相机看向 -Z 时 +X 才是右），
  // 旋转后为 (-cos yaw, sin yaw)；符号写反会让左右侧面描述整体镜像。
  const facingVec: [number, number] = [Math.sin(subject.yaw), Math.cos(subject.yaw)]
  const rightVec: [number, number] = [-Math.cos(subject.yaw), Math.sin(subject.yaw)]
  const toCam: [number, number] = [cx - sx, cz - sz]
  const toCamLen = Math.hypot(toCam[0], toCam[1]) || 1
  const cos = (facingVec[0] * toCam[0] + facingVec[1] * toCam[1]) / toCamLen
  const angle = (Math.acos(Math.min(Math.max(cos, -1), 1)) * 180) / Math.PI
  const side = rightVec[0] * toCam[0] + rightVec[1] * toCam[1] >= 0 ? '右侧' : '左侧'
  const facing = facingName(angle, side)

  return {
    lens,
    shotSize,
    cameraHeight,
    facing,
    focalLength,
    ratio: scene.ratio,
    text: `${lens}${shotSize}镜头，${cameraHeight}机位，${facing}，${focalLength}mm`,
  }
}
