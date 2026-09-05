import { createRoot } from 'react-dom/client'
import { DirectorHostFactory, DirectorStage, type Locale } from '@director-stage/core'

const host = DirectorHostFactory.browser()
const allowed: Locale[] = ['zh-CN', 'en-US', 'ja-JP']
const requested = new URLSearchParams(location.search).get('locale')
const tag = navigator.language.toLowerCase()
const locale: Locale = allowed.find((item) => item === requested)
  ?? (tag.startsWith('zh') ? 'zh-CN' : tag.startsWith('ja') ? 'ja-JP' : 'en-US')

createRoot(document.getElementById('app')!).render(
  <DirectorStage documentKey="playground" host={host} defaultLocale={locale} style={{ height: '100vh' }} />,
)
