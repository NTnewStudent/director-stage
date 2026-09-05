# Director Stage 开源包设计

日期：2026-09-05  
状态：draft（2026-09-05 修订：对外用法改为 React 组件；许可证改为 Apache-2.0）  
仓库路径：`/Users/mac/Documents/director-stage`（与 hjwall 平级，互不引用）  
许可证：Apache License 2.0

本文件是已确认设计的完整记录。实施时不得扩大范围：不回接 hjwall、不加后端、不把 WebM 伪装成 MP4、不伪造 AI 能力。

## 1. 目标

把 hjw 画布内的导演台抽成独立开源项目：

1. **可安装库** `@director-stage/core`：对外用法是 React 组件 `<DirectorStage />`，用 ref 调用保存/截图/录像。
2. **Playground** `apps/playground`：全屏演示，纯静态，Docker / Render / Vercel 一键部署。
3. **Examples** `examples/01~03`：演示组件挂载、自定义存储、截图录像。
4. **对外 API 文档** `docs/api.md`：公开符号的唯一文字契约，与 TypeScript 导出一致。

保存通过 Host 工厂注入。默认 `localStorage` + 本地下载。接入方重写 `documents.save` 决定真实存储。容器不持久化业务数据。

不提供 `new DirectorStage()` 类实例门面。创建系统的方式是渲染组件。

## 2. 非目标

- 不修改 `/Users/mac/Documents/hjwall`。
- 不提供登录、数据库、对象存储、上传微服务。
- 不实现 AI 识图、AI 动作、GLB/FBX 上传、IK 骨骼拖拽。
- 不导出命令式 `DirectorStage` 类（`mount`/`unmount`/`destroy`）。
- 第一版不发布到 npm registry（仓库可安装即可；`package.json` 按可发布结构写）。
- 不在 Docker 镜像中包含 examples。

## 3. 仓库结构

npm workspaces monorepo。

```
director-stage/
  package.json                 # workspaces: packages/*, apps/*, examples/*
  package-lock.json
  tsconfig.base.json
  DESIGN.md                    # 从 hjwall/global/design/DESIGN.md 复制
  LICENSE                      # Apache License 2.0 全文
  NOTICE                       # 版权与 Apache-2.0 要求的归属说明
  README.md
  Dockerfile
  docker-compose.yml
  render.yaml
  vercel.json                    # playground 静态输出；Root Directory 为仓库根
  nginx.conf.template          # listen ${PORT}
  docker/entrypoint.sh         # 用 $PORT 生成 nginx 配置并启动
  docs/
    api.md                     # 对外 API
    superpowers/specs/         # 本设计文件
  packages/core/
    package.json               # name: @director-stage/core, license: Apache-2.0
    src/index.ts               # 唯一公开导出
    src/host/                  # DirectorHost 与工厂
    src/document/              # 场景模型、归一化、动画、目录、历史
    src/viewport/              # three 视口、截图、录像
    src/studio/                # 工作台实现（不公开导出）
    src/theme/                 # design-tokens.css + studio.css
    src/i18n/                  # zh-CN / en-US / ja-JP
  apps/playground/
    package.json
    src/main.tsx               # createRoot + <DirectorStage />
    index.html
  examples/
    embed/                     # 唯一 example：嵌入 + 截图/导出回调
```

`packages/core` 的 `exports` 只暴露 `.`（`src/index.ts` 编译结果）。禁止从 `@director-stage/core/studio` 等深层路径导入。

## 4. 运行时架构

```
接入方 React 树
    │
    ▼
<DirectorStage ref={handle} host={...} documentKey={...} />
    │
    ├── DirectorHost（工厂生产）
    │     ├── documents.load / save     必选
    │     ├── media.saveImage/saveVideo 可选
    │     └── onShotText                可选
    │
    └── 工作台 UI + 单 Canvas 视口
          └── 场景文档 DirectorDocument（JSON）
```

- 3D 在用户浏览器里运行。Docker / Render / Vercel 只托管 playground 静态文件。
- 工作台顶栏「保存」与 `ref.save()` 走同一条 `host.documents.save`。
- 截图/录像先得到 `Blob`；若 Host 实现了对应 `media` 方法则调用，否则 `browser()` 触发下载。
- 组件卸载时释放 WebGL 与监听。再次挂载是重新渲染 `<DirectorStage />`，不是调用 `destroy()`。

## 5. 公开 API

`packages/core/src/index.ts` 只导出下列符号。新增公开符号必须先改 `docs/api.md`。

### 5.1 值导出

- `DirectorStage`（React 组件，`forwardRef`）
- `DirectorHostFactory`
- `DirectorDocument`（值：`{ create() }`；类型：场景 JSON）
- `DirectorStageError`

### 5.2 类型导出

- `DirectorStageProps`
- `DirectorStageHandle`
- `DirectorHost`
- `DirectorDocumentStore`
- `DirectorMediaStore`
- `CaptureMeta`
- `RecordMeta`
- `RecordingResult`
- `ImageCaptureResult`
- `VideoExportResult`
- `Locale`
- `Theme`

不导出：内部工作台组件、`DirectorViewport`、Zustand store、poses 内部表、canvas 遗留类型、命令式 Stage 类。

### 5.3 30 秒用法

```tsx
import { useRef } from 'react'
import { DirectorStage, DirectorHostFactory } from '@director-stage/core'

const host = DirectorHostFactory.browser()

export function App() {
  const stage = useRef<DirectorStageHandle>(null)
  return (
    <DirectorStage
      ref={stage}
      documentKey="demo"
      host={host}
      style={{ height: '100vh' }}
    />
  )
}
```

### 5.4 DirectorStageProps

文档键字段名为 `documentKey`，不用 `key`（避免与 React 列表 `key` 冲突）。

| 字段 | 类型 | 必填 | 约定 |
| :--- | :--- | :--- | :--- |
| `documentKey` | `string` | 是 | 传给 `documents.load/save` 的文档键，非空 |
| `host` | `DirectorHost` | 是 | 必须经工厂 `browser()` 或 `create()` |
| `locale` | `'zh-CN' \| 'en-US' \| 'ja-JP'` | 否 | 默认 `'zh-CN'` |
| `theme` | `'dark' \| 'light'` | 否 | 受控主题。不传则内部保存 |
| `defaultTheme` | `'dark' \| 'light'` | 否 | 非受控初始值，默认 `'dark'` |
| `defaultDocument` | `DirectorDocument` | 否 | 仅当 `load` 返回 `null` 时使用 |
| `className` | `string` | 否 | 加在根节点 |
| `style` | `CSSProperties` | 否 | 加在根节点；接入方负责给高度，默认 `height: 100%` |
| `onChange` | `(document: DirectorDocument) => void` | 否 | 用户编辑提交（含撤销/重做），不在播放逐帧触发 |
| `onSave` | `(document: DirectorDocument) => void` | 否 | `save` 成功后 |
| `onLoad` | `(document: DirectorDocument) => void` | 否 | `load` 得到非 null 并应用后 |
| `onCapture` | `(blob: Blob, meta: CaptureMeta) => void` | 否 | 截图成功后（Host.media 之后） |
| `onRecord` | `(result: RecordingResult, meta: RecordMeta) => void` | 否 | 录像成功后 |
| `onImageCapture` | `(result: ImageCaptureResult) => void` | 否 | 截图成功；`result` 含 `blob` 与机位/尺寸/帧 |
| `onVideoExport` | `(result: VideoExportResult) => void` | 否 | 视频导出成功；`result` 含 `blob`、MIME、时长 |
| `onError` | `(error: DirectorStageError) => void` | 否 | 失败时；取消 `ABORTED` 不调用 |
| `onThemeChange` | `(theme: Theme) => void` | 否 | 用户或 `setTheme` 切换主题后 |

挂载后解析文档：`host.documents.load(documentKey)` → 若 `null` 则 `defaultDocument` → 若无则 `DirectorDocument.create()`。非法 JSON 抛 `DirectorStageError`，不静默降级未来版本。

首次挂载注入 theme CSS（`data-director-stage-theme="1"`），全页只注入一次。

### 5.5 DirectorStageHandle（ref）

组件必须已提交到 DOM。在 `useEffect`/`event` 中调用；render 期间不要调。卸载后 ref 上的方法抛 `NOT_MOUNTED`。

| 方法 | 行为 |
| :--- | :--- |
| `getDocument(): DirectorDocument` | 当前场景深拷贝，修改拷贝不影响内部 |
| `setDocument(doc): void` | 归一化后替换并入撤销栈 |
| `save(): Promise<void>` | `host.documents.save(documentKey, getDocument())`；成功 `onSave`，失败 `onError` 并 rethrow |
| `load(documentKey?: string): Promise<DirectorDocument \| null>` | 默认用 props.`documentKey`。`null` 不改当前文档 |
| `capture(options?: { cameraId?: string; frame?: number }): Promise<Blob>` | 干净截图（无网格/gizmo/标签）。随后若存在 `host.media.saveImage` 则 await |
| `record(options?: { signal?: AbortSignal }): Promise<RecordingResult>` | 真实浏览器编码，MIME 与扩展名一致。随后若存在 `saveVideo` 则 await |
| `getShotText(): string` | 当前活动机位镜头描述，随 `locale` |
| `writeShotText(): Promise<void>` | 若无 `host.onShotText` 则立即 resolve |
| `getTheme(): Theme` | 当前 `'dark'` 或 `'light'` |
| `setTheme(theme): void` | 非受控时立刻切换；受控时只触发 `onThemeChange` |

### 5.6 DirectorHostFactory

| 方法 | 行为 |
| :--- | :--- |
| `browser(options?: { prefix?: string }): DirectorHost` | 场景写入 `localStorage` 键 ``${prefix ?? 'director-stage'}:${documentKey}``。`saveImage`/`saveVideo` 用 `<a download>`。不实现 `onShotText`。 |
| `create(host: DirectorHost): DirectorHost` | 校验 `documents.load/save` 为函数后原样返回。缺 `documents` 抛错。 |

接入方自定义存储：

```ts
const host = DirectorHostFactory.create({
  documents: {
    async load(key) { return null },
    async save(key, document) { /* 自己的写入 */ },
  },
  media: {
    async saveImage(blob, meta) {},
    async saveVideo(blob, meta) {},
  },
  onShotText(text) {},
})

<DirectorStage documentKey="demo" host={host} />
```

没有第三种隐式 Host。`host` prop 缺方法时，`save`/`load` 抛 `INVALID_HOST`。规范用法是始终走工厂。

### 5.7 存储与媒体类型

```ts
interface DirectorDocumentStore {
  load(key: string): Promise<DirectorDocument | null>
  save(key: string, document: DirectorDocument): Promise<void>
}

interface DirectorMediaStore {
  saveImage?(blob: Blob, meta: CaptureMeta): Promise<void>
  saveVideo?(blob: Blob, meta: RecordMeta): Promise<void>
}

interface DirectorHost {
  documents: DirectorDocumentStore
  media?: DirectorMediaStore
  onShotText?(text: string): void | Promise<void>
}

interface CaptureMeta {
  key: string
  cameraId: string
  mimeType: string
  width: number
  height: number
}

interface RecordMeta {
  key: string
  cameraId: string
  mimeType: string
  extension: string
  duration: number
  width: number
  height: number
}

interface RecordingResult {
  blob: Blob
  mimeType: string
  extension: string
}

interface ImageCaptureResult extends CaptureMeta {
  blob: Blob
  frame: number
}

interface VideoExportResult extends RecordMeta {
  blob: Blob
}
```

`DirectorDocument.create()` 返回可被 `normalize` 的 v2 空场景（一台默认相机、默认画幅 16:9、时长 5s、fps 30、无人偶）。

### 5.8 错误

`DirectorStageError extends Error`，`code` 为稳定字符串：

| code | 何时 |
| :--- | :--- |
| `NOT_MOUNTED` | 组件未挂载或已卸载后调用 ref 方法 |
| `INVALID_DOCUMENT` | 未来版本或无法归一化 |
| `INVALID_HOST` | 工厂校验失败，或 save/load 时 Host 缺方法 |
| `SAVE_FAILED` | Host.save 抛错（`cause` 保留原错误） |
| `LOAD_FAILED` | Host.load 抛错 |
| `CAPTURE_FAILED` / `RECORD_FAILED` | 编码或 WebGL 失败 |
| `RECORD_UNAVAILABLE` | 浏览器无可用录像格式 |
| `ABORTED` | signal 取消 |

UI toast 展示文案；ref 调用方靠 throw。失败时先 `onError` 再 throw。`ABORTED` 只 throw，不 toast、不调 `onError`。

不使用 `CONTAINER_NOT_FOUND` / `ALREADY_MOUNTED` / `DESTROYED`（那是已废弃的类实例生命周期）。

## 6. 内部实现约束

从 hjwall **复制**后改 import，不保留对 `workflow-canvas`、`@/modules/upload`、`@/modules/asset` 的依赖。

必须复制：

- `pc-client/src/modules/director-stage/**`（`output.ts` 改为走 Host，删除画布落点）
- `pc-client/src/modules/workflow-canvas/lib/director-scene.ts`
- `pc-client/src/modules/workflow-canvas/lib/director-shot.ts`
- `pc-client/src/modules/workflow-canvas/lib/director-camera-presets.ts`
- `pc-client/src/modules/workflow-canvas/components/director/poses.ts`
- `pc-client/src/modules/workflow-canvas/components/director/pose-rig.ts`
- `pc-client/src/modules/workflow-canvas/components/director/object-colors.ts`
- `pc-client/src/styles/design-tokens.css`（整文件复制，禁止改色值）
- `pc-client/src/modules/director-stage/studio.css`
- `global/design/DESIGN.md`
- `pc-client/src/locales/zh-CN/directorStudio.json` 与 `en-US` 对应文件
- 机位预设等仍读 `workflow` 命名空间的键：抽进 core 的 locale，playground 不依赖 hjw i18n

必须删除或改写：

- `useCanvasStore` / `useCanvasIntegration` / `DirectorNodeData`
- `applyDirectorCapture`、`uploadApi`、`assetApi`
- 画布快捷键隔离中针对 React Flow 的逻辑改为：仅在组件根节点内 stopPropagation
- 只读画布 `mode !== 'live'` 门禁：开源包默认可编辑；第一版不提供只读 prop

公开组件 `DirectorStage` 包一层现有工作台：负责 Host、load/save、theme 注入、ref handle。内部文件不出现在 `index.ts`。

保留：程序化人偶与 36 道具、24 姿势、11 动作、12 运镜、多机位、时间轴、WASD/EQ、人物颜色、撤销重做。不移植 hjw 的 sessionStorage 草稿：未调用 `save()` 的编辑只在内存，刷新后从 `host.documents.load(documentKey)` 恢复。

AI 导航仍显示「尚未接入」，不发网络请求。

依赖（core）：

- peerDependencies：`react`、`react-dom`（18 或 19）、`three@0.185`、`@react-three/fiber@9`、`@react-three/drei@10`
- dependencies：`zustand@4`、`lucide-react`、`sonner`、`i18next`、`react-i18next`
- playground / examples 必须自行安装全部 peer，版本与当前 hjw 导演台对齐（React 19）

样式：首次挂载注入 tokens + `studio.css`。组件继续用现有 class（`director-studio`、`ds-*`）和 CSS 变量，不换另一套主题。

## 7. Playground、Examples、文档

### Playground

`apps/playground/src/main.tsx`：

```tsx
createRoot(document.getElementById('app')!).render(
  <DirectorStage
    documentKey="playground"
    host={DirectorHostFactory.browser()}
    locale={navigator.language.startsWith('zh') ? 'zh-CN' : navigator.language.startsWith('ja') ? 'ja-JP' : 'en-US'}
    style={{ height: '100vh' }}
  />,
)
```

无路由、无登录。页面标题「Director Stage」。`#app` 与 `html,body` 高度 100%。

### Examples

唯一 example 是独立 Vite + React 应用：[`examples/embed`](../../../examples/embed)。演示 `<DirectorStage />` 嵌入、`DirectorHostFactory.create`，以及 `onImageCapture` / `onVideoExport`。

根 README 用 `npm run example` 启动。

### docs/api.md

中文正文，标识符保持英文。章节顺序：安装 → 30 秒用法（React 组件）→ Props → Handle → 工厂 → Host 接口 → 错误码 → 非公开项。每个方法写参数、返回值、抛出的 `code`。与第 5 节冲突时以 `docs/api.md` 与 `index.ts` 为准。

## 8. Docker、Render 与 Vercel

镜像只构建 playground。

1. stage `node:20-alpine`：`npm ci`，`npm run build --workspace=apps/playground`（core 先编）。
2. stage `nginx:1.27-alpine`：拷贝 playground `dist` 到 `/usr/share/nginx/html`，拷贝 `nginx.conf.template` 与 `entrypoint.sh`。
3. `ENTRYPOINT` 读取 `PORT`（缺省 8080），`envsubst` 写入 `listen`，前台启动 nginx。
4. Render 注入的 `PORT` 必须生效；禁止只监听 80。

`docker-compose.yml`：build 当前 Dockerfile，`"8080:8080"`，`PORT=8080`。

`render.yaml`：

- `type: web`
- `name: director-stage`
- `runtime: docker`
- `dockerfilePath: ./Dockerfile`
- `healthCheckPath: /`

无磁盘、无环境密钥。一键：GitHub 仓库 → Render New Blueprint → 选该 `render.yaml`。

`vercel.json`：

- `installCommand`: `npm ci`
- `buildCommand`: `npm run build`（根目录 workspace，构建 playground）
- `outputDirectory`: `apps/playground/dist`
- `framework`: `null`（避免在仓库根误检 Vite 而把输出当成根目录 `dist`）
- SPA `rewrites`：`/(.*)` → `/index.html`（与 nginx `try_files` 同等）

一键：GitHub 仓库 → [Vercel New Project](https://vercel.com/new) 导入；Root Directory 必须是仓库根。无需环境变量。本地：`npx vercel`。

WebGL 不在容器内运行。健康检查只确认 HTML 200。

## 9. 测试与验收

core 带走并改写现有 vitest（去掉 canvas store mock，改为 Host mock）。至少覆盖：

- `DirectorDocument.create` 与 v1→v2 归一化
- `DirectorHostFactory.browser` 的 load/save 读写同一 key
- `DirectorHostFactory.create` 拒绝缺 `documents`
- `<DirectorStage />`：自定义 host 的 save、load null 不覆盖、卸载后 ref 方法抛 `NOT_MOUNTED`
- 动画/历史/颜色/键控：保留从 hjw 复制的纯逻辑测试

playground / examples 不做 E2E 门禁。本地 `npm test` 只跑 core。

验收：

- `npm run dev --workspace=apps/playground` 能打开完整工作台
- example 01~03 各自能跑
- `docker compose up --build` 后浏览器打开 `http://localhost:8080` 能进入导演台
- `docs/api.md` 列出的每个导出都能从 `@director-stage/core` import
- `package.json` / `LICENSE` / `NOTICE` 均为 Apache-2.0
- hjwall git status 不因本项目产生新改动

## 10. 文档与品牌

README：项目是什么、与 hjw 的关系（从业务产品复制的独立 Apache-2.0 包）、React 快速开始、链接到 `docs/api.md`、Docker、Render Blueprint、Vercel 一键部署、许可证说明。

根目录 `LICENSE` 使用 Apache License 2.0 官方全文。`NOTICE` 写版权与「本产品包含从 hjw 导演台复制的实现，按 Apache-2.0 再许可」一句，不复制 hjw 业务商标作为 npm 显示名。

`package.json` 的 `license` 字段为 `Apache-2.0`（core、playground、examples、根目录一致）。

包名 `@director-stage/core`，产品名 Director Stage。视觉仍用复制的 DESIGN.md 炭黑+翠绿。

## 11. 实施顺序（概要）

完整任务拆解在用户确认本 spec 之后，用 writing-plans 另写。逻辑顺序固定为：

1. 初始化 monorepo 与 Apache-2.0 LICENSE / NOTICE / DESIGN.md / tokens
2. 复制导演台源码并切断画布依赖，内部可先跑通工作台
3. 实现 Host 工厂与公开组件 `<DirectorStage />` + ref handle
4. 写 `docs/api.md`，收敛 `index.ts` 导出
5. playground + examples（均为 React）
6. 改写测试至通过
7. Dockerfile / compose / render.yaml / vercel.json
8. README

## 12. 已决问题

| 问题 | 决定 |
| :--- | :--- |
| 形态 | 库 + playground + examples |
| 存储 | 静态站 + Host 工厂，默认 localStorage |
| 对外用法 | React 组件 `<DirectorStage />` + ref；不提供类实例 API |
| 文档键 | `documentKey`，不用 React 的 `key` |
| 部署 | 单容器 nginx，Render Blueprint；Vercel 静态托管 playground dist |
| 与 hjwall | 只复制，不改、不回接 |
| 包名 | `@director-stage/core` |
| 路径 | `/Users/mac/Documents/director-stage` |
| 许可证 | Apache License 2.0 |
| API 文档 | `docs/api.md` |
