import type { PropDefinition, PropPart } from './catalog'
import type { Vec3 } from '../scene/director-scene'

function project(point: Vec3): [number, number] {
  return [(point[0] - point[2]) * .866, -point[1] + (point[0] + point[2]) * .35]
}

function corners(part: PropPart) {
  return [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]].map((corner) => {
    let [x, y, z] = corner.map((value, index) => value * part.scale[index] / 2)
    const [rx, ry, rz] = part.rotation ?? [0, 0, 0]
    ;[y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)]
    ;[x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)]
    ;[x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)]
    return project([x + part.position[0], y + part.position[1], z + part.position[2]])
  })
}

/** Draws a lightweight isometric thumbnail from actual catalog geometry, without extra WebGL contexts.
 * @param props Original procedural prop definition and geometry.
 * @returns Token-colored SVG preview without a WebGL context.
 * @throws Never for catalog definitions.
 */
export function PropThumbnail({ definition }: { definition: PropDefinition }) {
  const parts = [...definition.parts].sort((a, b) => (a.position[0] + a.position[2]) - (b.position[0] + b.position[2]))
  const vertices = parts.map(corners)
  const all = vertices.flat()
  const minX = Math.min(...all.map(([x]) => x)), maxX = Math.max(...all.map(([x]) => x))
  const minY = Math.min(...all.map(([, y]) => y)), maxY = Math.max(...all.map(([, y]) => y))
  const pad = Math.max(maxX - minX, maxY - minY) * .14
  return <svg aria-hidden="true" viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`} style={{ width: '100%', height: '100%', padding: 8 }}>
    {parts.map((part, index) => {
      const points = vertices[index]
      if (part.shape === 'sphere') {
        const [cx, cy] = project(part.position)
        return <ellipse key={index} cx={cx} cy={cy} rx={Math.max(part.scale[0], part.scale[2]) * .5} ry={part.scale[1] * .5} fill="var(--color-bg-card-active)" stroke="currentColor" strokeWidth={.8} vectorEffect="non-scaling-stroke" />
      }
      return <g key={index}>{[[4, 5, 6, 7], [1, 2, 6, 5], [2, 3, 7, 6]].map((face, faceIndex) => <polygon key={faceIndex} points={face.map((vertex) => points[vertex].join(',')).join(' ')} fill={faceIndex === 0 ? 'var(--color-bg-action-btn)' : 'var(--color-bg-card-active)'} stroke="currentColor" strokeWidth={.7} vectorEffect="non-scaling-stroke" />)}</g>
    })}
  </svg>
}
