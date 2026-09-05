import { describe, expect, it } from 'vitest'
import { DIRECTOR_PROP_CATALOG } from './catalog'

const HIGH_RISE_IDS = ['office-tower', 'glass-tower', 'setback-tower', 'spire-tower', 'twin-towers', 'slab-tower'] as const

function bounds(parts: readonly { position: [number, number, number]; scale: [number, number, number] }[]) {
  return {
    top: Math.max(...parts.map((part) => part.position[1] + part.scale[1] / 2)),
    bottom: Math.min(...parts.map((part) => part.position[1] - part.scale[1] / 2)),
  }
}

describe('high-rise architecture props', () => {
  it('adds six grounded towers that read as skyscrapers beside a 1.75m character', () => {
    for (const id of HIGH_RISE_IDS) {
      const building = DIRECTOR_PROP_CATALOG.find((prop) => prop.id === id)
      expect(building, id).toBeDefined()
      expect(building!.category).toBe('建筑')
      expect(building!.parts.length).toBeGreaterThan(3)
      const { top, bottom } = bounds(building!.parts)
      expect(top, `${id} height`).toBeGreaterThanOrEqual(18)
      expect(bottom, `${id} ground`).toBeGreaterThanOrEqual(-0.05)
      expect(bottom, `${id} ground`).toBeLessThan(0.25)
    }
    expect(new Set(DIRECTOR_PROP_CATALOG.map((prop) => prop.id)).size).toBe(DIRECTOR_PROP_CATALOG.length)
  })
})
