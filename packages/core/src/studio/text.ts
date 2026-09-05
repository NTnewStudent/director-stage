import { useTranslation } from 'react-i18next'
import { labelEntityName, localizeCatalogEntry, type LabelEntity } from './labels'

/** Localizes built-in catalog presentation without renaming persisted user scene entities.
 * @description Takes no arguments; reads the current i18n locale.
 * @returns A lookup accepting one catalog entry and preserving its IDs and geometry.
 * @throws Never for catalog entries.
 */
export function useCatalogText() {
  const { i18n } = useTranslation('directorStudio')
  return <T extends { id: string; name: string; category: string; description: string }>(entry: T): T => localizeCatalogEntry(entry, i18n.language)
}

/** Returns a locale-aware workbench translator.
 * @description Takes no arguments; reads the directorStudio translation namespace.
 * @returns A lookup accepting one directorStudio translation key.
 * @throws Never for registered locale resources.
 */
export function useDirectorText() {
  const { t } = useTranslation('directorStudio')
  return (key: string) => t(key)
}

/** Present stored character, camera and prop names in the active UI language. */
export function useEntityLabel() {
  const { t, i18n } = useTranslation('directorStudio')
  return (entity: LabelEntity) => labelEntityName(entity, i18n.language, t)
}
