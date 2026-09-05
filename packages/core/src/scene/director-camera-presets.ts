/**
 * 导演台「添加机位」一键预设（参考图 15 格）。
 *
 * @description 纯数据文件：每个机位只描述 position / target / focalLength。
 *   落到 three 的平滑过渡由 `DirectorViewport` 的 imperative handle 处理。
 *
 *   坐标约定：场景中心为原点，人偶正面朝 +Z，髋高约 0.9m，总高约 1.75m。
 *   target 的 y 决定景别：1.35 脸、1.0 胸、0.9 髋、0 地面。
 *
 *   数值为初标：没有真视口走查前，某些机位（尤其荷兰角、过肩）需要在实际
 *   画面里微调。荷兰角受 CameraControls 不直接暴露 roll 的限制，先用低斜角
 *   构图近似；后续若需要真正的镜头 roll，再扩展接口。
 */
import type { Vec3 } from './director-scene'

export type DirectorCameraPresetKey =
  | 'current'
  | 'frontMedium'
  | 'frontClose'
  | 'frontFull'
  | 'sideFollow'
  | 'sideClose'
  | 'backMedium'
  | 'topDownFull'
  | 'topDown45'
  | 'lowAngle'
  | 'lowAngleWide'
  | 'overShoulder'
  | 'overShoulderRight'
  | 'birdEye'
  | 'dutchAngle'

export interface DirectorCameraPreset {
  key: DirectorCameraPresetKey
  /** i18n key 后缀：实际为 `node.director.cameraPreset_${labelKey}` */
  labelKey: string
  position: Vec3
  target: Vec3
  focalLength: number
}

/** 15 个一键机位；顺序即 UI 网格展示顺序 */
export const DIRECTOR_CAMERA_PRESETS: readonly DirectorCameraPreset[] = [
  {
    key: 'current',
    labelKey: 'current',
    position: [1.6, 1.15, 3.2],
    target: [0, 0.96, 0],
    focalLength: 35,
  },
  {
    key: 'frontMedium',
    labelKey: 'frontMedium',
    position: [0, 1.2, 2.6],
    target: [0, 1.0, 0],
    focalLength: 35,
  },
  {
    key: 'frontClose',
    labelKey: 'frontClose',
    position: [0, 1.35, 1.4],
    target: [0, 1.35, 0],
    focalLength: 55,
  },
  {
    key: 'frontFull',
    labelKey: 'frontFull',
    position: [0, 1.0, 4.0],
    target: [0, 0.9, 0],
    focalLength: 24,
  },
  {
    key: 'sideFollow',
    labelKey: 'sideFollow',
    position: [2.8, 1.1, 0.8],
    target: [0, 1.0, 0],
    focalLength: 35,
  },
  {
    key: 'sideClose',
    labelKey: 'sideClose',
    position: [1.6, 1.3, 0],
    target: [0, 1.3, 0],
    focalLength: 55,
  },
  {
    key: 'backMedium',
    labelKey: 'backMedium',
    position: [0, 1.2, -2.6],
    target: [0, 1.0, 0],
    focalLength: 35,
  },
  {
    key: 'topDownFull',
    labelKey: 'topDownFull',
    position: [0, 4.5, 0],
    target: [0, 0, 0],
    focalLength: 24,
  },
  {
    key: 'topDown45',
    labelKey: 'topDown45',
    position: [2.5, 3.5, 2.5],
    target: [0, 0.5, 0],
    focalLength: 30,
  },
  {
    key: 'lowAngle',
    labelKey: 'lowAngle',
    position: [0, 0.35, 2.0],
    target: [0, 1.3, 0],
    focalLength: 35,
  },
  {
    key: 'lowAngleWide',
    labelKey: 'lowAngleWide',
    position: [0, 0.25, 2.8],
    target: [0, 1.1, 0],
    focalLength: 24,
  },
  {
    key: 'overShoulder',
    labelKey: 'overShoulder',
    position: [-0.4, 1.35, -1.4],
    target: [0, 1.2, 2.0],
    focalLength: 35,
  },
  {
    key: 'overShoulderRight',
    labelKey: 'overShoulderRight',
    position: [0.4, 1.35, -1.4],
    target: [0, 1.2, 2.0],
    focalLength: 35,
  },
  {
    key: 'birdEye',
    labelKey: 'birdEye',
    position: [4.0, 6.0, 4.0],
    target: [0, 0, 0],
    focalLength: 24,
  },
  {
    key: 'dutchAngle',
    labelKey: 'dutchAngle',
    position: [2.2, 0.4, 1.2],
    target: [0, 1.2, 0],
    focalLength: 35,
  },
]
