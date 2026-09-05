import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './zh-CN.json'
import en from './en-US.json'
import ja from './ja-JP.json'
import type { Locale } from '../host/types'

const bundles = {
  'zh-CN': zh,
  'en-US': en,
  'ja-JP': ja,
} as const

function registerDirectorBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    if (!i18n.hasResourceBundle(lng, 'directorStudio')) {
      i18n.addResourceBundle(lng, 'directorStudio', resources, true, true)
    }
  }
}

/** Install directorStudio resources and switch language.
 * @param locale Requested UI language.
 * @returns The shared i18n instance.
 */
export function ensureDirectorI18n(locale: Locale = 'zh-CN') {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      lng: locale,
      fallbackLng: 'zh-CN',
      ns: ['directorStudio'],
      defaultNS: 'directorStudio',
      resources: {
        'zh-CN': { directorStudio: zh },
        'en-US': { directorStudio: en },
        'ja-JP': { directorStudio: ja },
      },
      interpolation: { escapeValue: false },
    })
  } else {
    registerDirectorBundles()
    if (i18n.language !== locale) void i18n.changeLanguage(locale)
  }
  return i18n
}
