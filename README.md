# Director Stage

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

3D 导演台。面向 Seedance、H3、Kling、Omni 等视频生成工作流，用来**控制运镜、控制场景、控制站位**。

把角色、道具和机位摆进三维空间，导出干净截图或预览视频，再交给生成模型。

- 包：`@director-stage/core`
- 组件：`<DirectorStage />`
- 协议：MIT
- API：[docs/api.md](docs/api.md) · [English](docs/api.en.md) · [日本語](docs/api.ja.md)

## 能做什么

| | |
| :--- | :--- |
| **运镜** | 独立机位、焦距、roll、一键景别预设、程序化运镜片段 |
| **场景** | 角色与道具、构图、网格与标签 |
| **站位** | 位置 / 朝向 / 缩放、走位路径、关键帧 |

截图与导出不含网格、gizmo 和标签，适合作为 Seedance / Kling 等模型的输入。

## 安装

```bash
npm i @director-stage/core
```

[npm](https://www.npmjs.com/package/@director-stage/core) 包。Peer 需一并安装：

```bash
npm i react react-dom three @react-three/fiber @react-three/drei
```

Peer：`react` 18 或 19，`three` ^0.185，`@react-three/fiber`、`@react-three/drei`。

## 使用

```tsx
import { DirectorStage, DirectorHostFactory } from '@director-stage/core'

const host = DirectorHostFactory.create({
  documents: {
    load: async (key) => null,
    save: async (key, document) => {
      // 把场景 JSON 存进宿主（Seedance / Kling / 自有后端）
    },
  },
})

export function App() {
  return (
    <DirectorStage
      documentKey="scene"
      host={host}
      locale="zh-CN"
      style={{ height: '100vh' }}
      onImageCapture={(result) => {
        // result.blob 是 PNG 截图
      }}
      onVideoExport={(result) => {
        // result.blob 是预览视频（webm 或 mp4）
      }}
    />
  )
}
```

工作台里点「截图到画布 / 导出视频」，或调用 `ref.capture()` / `ref.record()`，都会触发回调。

| 回调 | 结果 |
| :--- | :--- |
| `onImageCapture` | `blob`、`mimeType`、`width`、`height`、`cameraId`、`frame` |
| `onVideoExport` | `blob`、`mimeType`、`extension`、`duration`、`width`、`height`、`cameraId` |

顶部「复制镜头文本」会根据当前机位和第一个角色推导一段**中文运镜描述**（景别、机位高度、朝向、焦距），例如 `广角全身镜头，膝高机位，右侧四分之三侧面，24mm`。这段给 Seedance / Kling / Omni 当运镜 prompt 用，不随界面语言切换。按钮会复制到剪贴板；嵌入时在 host 上实现 `onShotText`，或调用 `ref.getShotText()` / `ref.writeShotText()`。

仅浏览器用：`DirectorHostFactory.browser()` 会把场景写入 `localStorage`，媒体触发下载。嵌入生成工作流时用 `create()`，自己处理存储和上传。

`locale`：`'zh-CN'`（默认）`| 'en-US' | 'ja-JP'`。顶栏可切换主题和界面语言；不传 `locale` 时用 `defaultLocale`，组件自己记。

完整符号见 [docs/api.md](docs/api.md)。

## 本地运行

```bash
npm install
npm run dev          # 全屏工作台
npm run example      # 唯一 example：嵌入 + 截图/导出回调
npm test
```

Example 在 [`examples/embed`](examples/embed)。

## 部署

Playground 是静态站，3D 在浏览器里跑。

```bash
docker compose up --build
```

Vercel：仓库根目录已有 `vercel.json`。导入时 **Root Directory 保持仓库根**。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

```bash
npx vercel
```

## License

MIT
