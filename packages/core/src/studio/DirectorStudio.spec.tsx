import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forwardRef, useImperativeHandle } from 'react'
import { createDirectorDocument, type DirectorDocument } from './model'
import { upsertKeyframe } from './animation'
import { DirectorStage } from '../DirectorStage'
import { DirectorHostFactory } from '../host/factory'
import { DirectorStageError } from '../host/errors'
import type { DirectorHost } from '../host/types'
import { ensureDirectorI18n } from '../i18n/setup'
import type { DirectorViewportHandle, DirectorViewportProps } from './viewport/DirectorViewport'

const mocks = vi.hoisted(() => ({ text: vi.fn(), saveImage: vi.fn(), saveVideo: vi.fn(), viewportCapture: vi.fn(), record: vi.fn() }))
vi.mock('./viewport/recorder', () => ({ getRecordingFormat: () => ({ extension: 'webm', mimeType: 'video/webm' }) }))
vi.mock('./viewport/DirectorViewport', () => ({ default: forwardRef<DirectorViewportHandle, DirectorViewportProps>(function FakeViewport(props, ref) {
  useImperativeHandle(ref, () => ({ getEditorCamera: () => ({ position: [8, 3, 6], target: [0, 1, 0], focalLength: 35, roll: 0 }), resetView: vi.fn(), focusSelection: vi.fn(), setEditorCamera: vi.fn(), capture: mocks.viewportCapture, record: mocks.record }))
  return <div data-testid="fake-viewport" data-scene={JSON.stringify(props.scene)} />
}) }))

const documents = new Map<string, DirectorDocument>()
let host: DirectorHost
beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  ensureDirectorI18n('zh-CN')
  documents.clear()
  host = DirectorHostFactory.create({
    documents: {
      load: async (key) => documents.get(key) ?? null,
      save: async (key, document) => { documents.set(key, document) },
    },
    media: { saveImage: mocks.saveImage, saveVideo: mocks.saveVideo },
    onShotText: mocks.text,
  })
})
const scene = () => JSON.parse(screen.getByTestId('fake-viewport').getAttribute('data-scene')!) as DirectorDocument
const renderStudio = async (document?: DirectorDocument) => {
  const result = render(<DirectorStage documentKey="demo" host={host} defaultDocument={document} />)
  await screen.findByTestId('fake-viewport')
  return result
}
const editNumber = (name: string, value: string) => { const field = screen.getByRole('spinbutton', { name }); fireEvent.change(field, { target: { value } }); fireEvent.blur(field) }

describe('director workbench integration', () => {
  it.each(['blur', 'change'])('keeps preset ownership when a native picker restores its original value on %s', async (finish) => {
    await renderStudio()
    const input = screen.getByLabelText('自定义颜色') as HTMLInputElement
    const initial = input.value
    fireEvent.input(input, { target: { value: '#123456' } })
    expect(scene().objects[0].color).toBe('#123456')
    if (finish === 'change') fireEvent.change(input, { target: { value: initial } })
    else { input.value = initial; fireEvent.blur(input) }
    expect(scene().objects[0].color).toBeUndefined()
    expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled()
  })
  it('previews picker input live, commits once and preserves color through undo/save/reopen', async () => {
    const editor = await renderStudio()
    const input = screen.getByLabelText('自定义颜色')
    fireEvent.input(input, { target: { value: '#123456' } })
    fireEvent.input(input, { target: { value: '#abcdef' } })
    expect(scene().objects[0].color).toBe('#abcdef')
    fireEvent.change(input, { target: { value: '#abcdef' } })
    fireEvent.blur(screen.getByLabelText('自定义颜色'))
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(scene().objects[0].color).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: '重做' }))
    expect(scene().objects[0].color).toBe('#abcdef')
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(documents.get('demo')?.objects[0].color).toBe('#abcdef'))
    editor.unmount()
    await renderStudio()
    expect(scene().objects[0].color).toBe('#abcdef')
  })
  it('discards uncommitted preview when choosing a preset or another character', async () => {
    await renderStudio()
    fireEvent.input(screen.getByLabelText('自定义颜色'), { target: { value: '#123456' } })
    fireEvent.click(screen.getByRole('button', { name: '预设颜色 3' }))
    expect(scene().objects[0]).toMatchObject({ colorIndex: 2 })
    expect(scene().objects[0].color).toBeUndefined()
    fireEvent.input(screen.getByLabelText('自定义颜色'), { target: { value: '#123456' } })
    fireEvent.click(screen.getByRole('button', { name: '角色' }))
    fireEvent.click(screen.getByRole('button', { name: /添加角色/ }))
    expect(scene().objects.every((object) => !object.color)).toBe(true)
  })
  it.each(['lock', 'playing'])('blocks colors and clears an unfinished preview during %s', async (gate) => {
    await renderStudio()
    fireEvent.input(screen.getByLabelText('自定义颜色'), { target: { value: '#123456' } })
    if (gate === 'lock') fireEvent.click(within(screen.getByTestId('director-inspector')).getByRole('button', { name: '锁定 / 解锁' }))
    else fireEvent.click(screen.getByRole('button', { name: '播放 / 暂停' }))
    expect(screen.getByLabelText('自定义颜色')).toBeDisabled()
    expect(scene().objects[0].color).toBeUndefined()
  })
  it('flushes a pending custom color on explicit save without requiring a native blur', async () => {
    await renderStudio()
    fireEvent.input(screen.getByLabelText('自定义颜色'), { target: { value: '#123456' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(documents.get('demo')?.objects[0].color).toBe('#123456'))
  })
  it('mounts six navigation sections and an independent camera preview', async () => {
    await renderStudio()
    for (const name of ['对象', '角色', '道具', '机位', '动作', '运镜']) {
      const label = within(screen.getByRole('navigation')).getByRole('button', { name })
      expect(label).toBeInTheDocument()
      expect(label.querySelector('.ds-nav-label')).toHaveTextContent(name)
    }
    expect(screen.queryByRole('button', { name: 'AI识图' })).not.toBeInTheDocument()
    expect(screen.getByTestId('director-camera-preview')).toBeInTheDocument()
    expect(screen.getByTestId('director-timeline')).toBeInTheDocument()
  })
  it('adds a character, supports undo/redo, and saves version 2 only when requested', async () => {
    await renderStudio()
    fireEvent.click(screen.getByRole('button', { name: '角色' }))
    fireEvent.click(screen.getByRole('button', { name: /添加角色/ }))
    expect(scene().objects).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(scene().objects).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '重做' }))
    expect(scene().objects).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(documents.get('demo')).toMatchObject({ version: 2, objects: [{}, {}] }))
  })
  it('creates an independent camera from the editor view', async () => {
    await renderStudio()
    fireEvent.click(screen.getByRole('button', { name: '机位' }))
    fireEvent.click(screen.getByRole('button', { name: '从当前视角新建机位' }))
    expect(scene().cameras).toHaveLength(2)
    expect(scene().cameras[1].position).toEqual([8, 3, 6])
  })
  it('locks a character and prevents inspector transforms', async () => {
    await renderStudio()
    const inspector = within(screen.getByTestId('director-inspector'))
    fireEvent.click(inspector.getByRole('button', { name: '锁定 / 解锁' }))
    expect(inspector.getByRole('spinbutton', { name: '位置 · m X' })).toBeDisabled()
  })
  it('commits finite fields on blur and rejects non-finite/empty values', async () => {
    await renderStudio()
    editNumber('位置 · m X', '2.5')
    expect(scene().objects[0].position[0]).toBe(2.5)
    editNumber('位置 · m X', '')
    expect(scene().objects[0].position[0]).toBe(2.5)
  })
  it('does not restore unsubmitted edits after unmount without save', async () => {
    const editor = await renderStudio()
    editNumber('位置 · m X', '3')
    editor.unmount()
    await renderStudio()
    expect(scene().objects[0].position[0]).toBe(0)
  })
  it('isolates studio keyboard undo from bubbling', async () => {
    await renderStudio()
    editNumber('位置 · m X', '3')
    const underlying = vi.fn()
    window.addEventListener('keydown', underlying)
    try {
      fireEvent.keyDown(screen.getByTestId('director-studio'), { key: 'z', ctrlKey: true })
      expect(scene().objects[0].position[0]).toBe(0)
      expect(underlying).not.toHaveBeenCalled()
    } finally { window.removeEventListener('keydown', underlying) }
  })
  it('edits animated properties at the current frame and keeps prior keys', async () => {
    let initial = createDirectorDocument()
    const id = initial.objects[0].id
    initial = upsertKeyframe(initial, { targetId: id, channel: 'position', frame: 0, value: [0, 0, 0] })
    initial = upsertKeyframe(initial, { targetId: id, channel: 'position', frame: 100, value: [10, 0, 0] })
    await renderStudio(initial)
    editNumber('当前帧', '50')
    expect(scene().objects[0].position[0]).toBe(5)
    editNumber('位置 · m X', '7')
    expect(scene().keyframes.find((key) => key.frame === 50)?.value).toEqual([7, 0, 0])
  })
  it('adds a real action clip from the current frame', async () => {
    await renderStudio()
    editNumber('当前帧', '30')
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: '动作' }))
    fireEvent.click(screen.getByText('行走').closest('button')!)
    expect(scene().clips[0]).toMatchObject({ presetId: 'walk', startFrame: 30, endFrame: 120 })
  })
  it('copies derived shot language onto the clipboard and through the host hook', async () => {
    const clipboard = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: clipboard } })
    await renderStudio()
    fireEvent.click(screen.getByRole('button', { name: '复制镜头文本' }))
    await waitFor(() => expect(mocks.text).toHaveBeenCalledWith(expect.stringMatching(/镜头，.+机位，.+mm$/)))
    expect(clipboard).toHaveBeenCalledWith(mocks.text.mock.calls[0][0])
  })
  it('captures through host.media.saveImage', async () => {
    mocks.viewportCapture.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    await renderStudio()
    fireEvent.click(screen.getByRole('button', { name: '截图到画布 / 导出视频' }))
    fireEvent.click(screen.getByRole('button', { name: '截图到画布' }))
    await waitFor(() => expect(mocks.saveImage).toHaveBeenCalled())
  })
  it('delivers the screenshot blob to onImageCapture', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    mocks.viewportCapture.mockResolvedValue(blob)
    const onImageCapture = vi.fn()
    render(<DirectorStage documentKey="demo" host={host} onImageCapture={onImageCapture} />)
    await screen.findByTestId('fake-viewport')
    fireEvent.click(screen.getByRole('button', { name: '截图到画布 / 导出视频' }))
    fireEvent.click(screen.getByRole('button', { name: '截图到画布' }))
    await waitFor(() => expect(onImageCapture).toHaveBeenCalledTimes(1))
    expect(onImageCapture.mock.calls[0][0]).toMatchObject({
      blob, mimeType: 'image/png', key: 'demo', cameraId: scene().cameras[0].id, frame: 0, width: 1280, height: 720,
    })
  })
  it('emits onImageCapture from capture() on the component ref', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    mocks.viewportCapture.mockResolvedValue(blob)
    const onImageCapture = vi.fn()
    const ref = { current: null as null | import('../host/types').DirectorStageHandle }
    render(<DirectorStage ref={ref} documentKey="demo" host={host} onImageCapture={onImageCapture} />)
    await screen.findByTestId('fake-viewport')
    await ref.current!.capture()
    expect(onImageCapture).toHaveBeenCalledWith(expect.objectContaining({ blob, key: 'demo', frame: 0 }))
  })
  it('records through host.media.saveVideo', async () => {
    mocks.record.mockResolvedValue({ blob: new Blob(['video'], { type: 'video/webm' }), mimeType: 'video/webm', extension: 'webm' })
    await renderStudio()
    fireEvent.click(screen.getByRole('button', { name: '截图到画布 / 导出视频' }))
    fireEvent.click(screen.getByRole('button', { name: '录制并回传画布' }))
    await waitFor(() => expect(mocks.saveVideo).toHaveBeenCalled())
  })
  it('delivers the encoded video to onVideoExport', async () => {
    const video = { blob: new Blob(['video'], { type: 'video/webm' }), mimeType: 'video/webm', extension: 'webm' }
    mocks.record.mockResolvedValue(video)
    const onVideoExport = vi.fn()
    render(<DirectorStage documentKey="demo" host={host} onVideoExport={onVideoExport} />)
    await screen.findByTestId('fake-viewport')
    fireEvent.click(screen.getByRole('button', { name: '截图到画布 / 导出视频' }))
    fireEvent.click(screen.getByRole('button', { name: '录制并回传画布' }))
    await waitFor(() => expect(onVideoExport).toHaveBeenCalledTimes(1))
    expect(onVideoExport.mock.calls[0][0]).toMatchObject({
      ...video, key: 'demo', cameraId: scene().cameras[0].id, duration: 5, width: 1280, height: 720,
    })
  })
  it('cancels recording without saving media', async () => {
    const onVideoExport = vi.fn()
    mocks.record.mockImplementation(({ signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
    }))
    render(<DirectorStage documentKey="demo" host={host} onVideoExport={onVideoExport} />)
    await screen.findByTestId('fake-viewport')
    fireEvent.click(screen.getByRole('button', { name: '截图到画布 / 导出视频' }))
    fireEvent.click(screen.getByRole('button', { name: '录制并回传画布' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '录制并回传画布' })).not.toBeDisabled())
    expect(mocks.saveVideo).not.toHaveBeenCalled()
    expect(onVideoExport).not.toHaveBeenCalled()
  })
  it('does not keep an AI recognition surface', async () => {
    await renderStudio()
    expect(screen.queryByRole('button', { name: 'AI识图' })).not.toBeInTheDocument()
    expect(screen.queryByText('尚未接入')).not.toBeInTheDocument()
  })

  it('defaults to dark theme and switches from the header control', async () => {
    const onThemeChange = vi.fn()
    const { container } = render(<DirectorStage documentKey="demo" host={host} onThemeChange={onThemeChange} />)
    await screen.findByTestId('fake-viewport')
    const root = container.querySelector('[data-director-stage-theme]')
    expect(root).toHaveAttribute('data-director-stage-theme', 'dark')
    const switcher = screen.getByTestId('director-theme-switch')
    expect(switcher).toBeInTheDocument()
    fireEvent.click(within(switcher).getByRole('button', { name: '浅色' }))
    expect(root).toHaveAttribute('data-director-stage-theme', 'light')
    expect(onThemeChange).toHaveBeenCalledWith('light')
  })

  it('exposes getTheme/setTheme on the component ref', async () => {
    const ref = { current: null as null | import('../host/types').DirectorStageHandle }
    const { container } = render(<DirectorStage ref={ref} documentKey="demo" host={host} />)
    await screen.findByTestId('fake-viewport')
    expect(ref.current?.getTheme()).toBe('dark')
    ref.current?.setTheme('light')
    await waitFor(() => expect(container.querySelector('[data-director-stage-theme]')).toHaveAttribute('data-director-stage-theme', 'light'))
    expect(ref.current?.getTheme()).toBe('light')
  })

  it('keeps a controlled theme prop until the parent updates it', async () => {
    const onThemeChange = vi.fn()
    const { container } = render(<DirectorStage documentKey="demo" host={host} theme="dark" onThemeChange={onThemeChange} />)
    await screen.findByTestId('fake-viewport')
    fireEvent.click(within(screen.getByTestId('director-theme-switch')).getByRole('button', { name: '浅色' }))
    expect(onThemeChange).toHaveBeenCalledWith('light')
    expect(container.querySelector('[data-director-stage-theme]')).toHaveAttribute('data-director-stage-theme', 'dark')
  })
  it('preserves future documents rather than replacing them with defaults', async () => {
    documents.set('demo', { version: 9 } as never)
    render(<DirectorStage documentKey="demo" host={host} />)
    expect(await screen.findByText('场景版本不受支持，请使用更新的客户端打开。')).toBeInTheDocument()
    expect(screen.queryByTestId('fake-viewport')).not.toBeInTheDocument()
    expect(documents.get('demo')).toEqual({ version: 9 })
  })
  it('throws NOT_MOUNTED after unmount', async () => {
    const ref = { current: null as null | import('../host/types').DirectorStageHandle }
    const view = render(<DirectorStage ref={ref} documentKey="demo" host={host} />)
    await screen.findByTestId('fake-viewport')
    view.unmount()
    expect(() => ref.current?.getDocument()).toThrow(DirectorStageError)
    expect(() => ref.current?.getTheme()).toThrow(DirectorStageError)
    expect(() => ref.current?.setTheme('light')).toThrow(DirectorStageError)
    expect(() => ref.current?.getLocale()).toThrow(DirectorStageError)
    expect(() => ref.current?.setLocale('en-US')).toThrow(DirectorStageError)
  })
  it('switches chrome language from the header control', async () => {
    await renderStudio()
    fireEvent.click(within(screen.getByTestId('director-locale-switch')).getByRole('button', { name: 'EN' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Characters' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Copy shot text' })).toBeInTheDocument()
  })

  it('exposes getLocale/setLocale on the component ref', async () => {
    const ref = { current: null as null | import('../host/types').DirectorStageHandle }
    render(<DirectorStage ref={ref} documentKey="demo" host={host} />)
    await screen.findByTestId('fake-viewport')
    expect(ref.current?.getLocale()).toBe('zh-CN')
    ref.current?.setLocale('ja-JP')
    await waitFor(() => expect(screen.getByRole('button', { name: 'キャラクター' })).toBeInTheDocument())
    expect(ref.current?.getLocale()).toBe('ja-JP')
  })

  it('keeps a controlled locale until the parent updates it', async () => {
    const onLocaleChange = vi.fn()
    render(<DirectorStage documentKey="demo" host={host} locale="zh-CN" onLocaleChange={onLocaleChange} />)
    await screen.findByTestId('fake-viewport')
    fireEvent.click(within(screen.getByTestId('director-locale-switch')).getByRole('button', { name: 'EN' }))
    expect(onLocaleChange).toHaveBeenCalledWith('en-US')
    expect(screen.getByRole('button', { name: '角色' })).toBeInTheDocument()
  })

  it('renders Japanese chrome when locale is ja-JP', async () => {
    ensureDirectorI18n('zh-CN')
    documents.set('demo', createDirectorDocument())
    const view = render(<DirectorStage documentKey="demo" host={host} locale="ja-JP" />)
    await screen.findByTestId('fake-viewport')
    expect(screen.getByRole('button', { name: 'キャラクター' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '元に戻す' })).toBeInTheDocument()
    const outline = within(screen.getByTestId('director-outline'))
    expect(outline.getByRole('button', { name: 'キャラクター 1' })).toBeInTheDocument()
    expect(outline.getByRole('button', { name: 'カメラ 1' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '名前' })).toHaveValue('キャラクター 1')
    expect(screen.getByLabelText('カメラプレビュー')).toHaveTextContent('カメラ 1')
    view.unmount()
    ensureDirectorI18n('zh-CN')
  })
})
