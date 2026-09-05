import { objectColor } from '../scene/object-colors'

/** Validate a user material color, not a UI theme color.
 * @param raw Untrusted persisted or picker value.
 * @returns Lowercase six-digit hex, or undefined for invalid input.
 * @throws Never.
 * @see docs/api-contracts/client/director-stage.md#RULE_DIRECTOR_CHARACTER_COLOR
 */
export function normalizeCharacterColor(raw: unknown): string | undefined {
  return typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : undefined
}

/** Resolve the material using the original modulo-index palette for legacy scenes.
 * @param object Object kind and authored color values.
 * @param colors Resolved design-token palette, shared with the picker.
 * @returns Custom mannequin color or the original preset color.
 * @throws Never.
 */
export function resolveCharacterColor(object: { kind: string; colorIndex: number; color?: string }, colors: readonly string[]): string {
  return (object.kind === 'mannequin' ? normalizeCharacterColor(object.color) : undefined) ?? objectColor(colors, object.colorIndex)
}
