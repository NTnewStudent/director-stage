/**
 * REQ-174 场景对象配色（**纯函数，零 three / 零 React 依赖**）。
 *
 * @description 导演台里摆多具人偶时，全灰模分不清谁是谁 —— 每个对象按序分一档颜色。
 *   色值一律来自 REQ-170 协同 presence 色板（语义本来就是「区分多个参与者」），
 *   本文件不出现任何十六进制字面量。单独成文件是因为 `DirectorViewport.tsx`
 *   要满足 react-refresh 的「只导出组件」约束。
 */

/**
 * presence 色板中互不相同的 5 档。
 *
 * presence-5 / 6 / 7 分别是 1 / 3 的同色别名（`--color-success` 与 `--color-brand`
 * 同值、`--color-brand-hover`、`--color-warning-text`），取进来只会让两个对象撞色。
 */
const OBJECT_COLOR_TOKENS = [
  '--color-presence-1',
  '--color-presence-2',
  '--color-presence-3',
  '--color-presence-4',
  '--color-presence-8',
] as const

/**
 * 从 design token 读出场景对象配色。
 *
 * @description `--color-presence-N` 本身是 `var()` 别名，而部分引擎读自定义属性时
 *   不会代入嵌套 `var()` —— 取回来会是字面量 `var(--color-brand)`，喂给 three 会
 *   把人偶渲染成黑色。故拿到 `var(...)` 时再解一层。
 * @returns 解析后的色值数组；token 缺失时该项为空串
 */
export function readObjectColors(): string[] {
  const style = getComputedStyle(document.documentElement)
  return OBJECT_COLOR_TOKENS.map((name) => {
    const raw = style.getPropertyValue(name).trim()
    if (!raw.startsWith('var(')) return raw
    return style.getPropertyValue(raw.slice(4, raw.length - 1).trim()).trim()
  })
}

/**
 * 第 `index` 个场景对象的配色。
 *
 * @description 按**数组下标**而非 id 哈希取值：哈希会撞色，而撞色恰好是这里要解决的问题。
 *   代价是删掉中间的对象后，后面的会顺移一档 —— 相比「两个对象看起来一样」，这个代价小得多。
 * @param colors {@link readObjectColors} 的结果
 * @param index 对象在 `scene.objects` 中的下标
 * @returns 色值；`colors` 为空时返回空串（three 按默认白色处理）
 */
export function objectColor(colors: readonly string[], index: number): string {
  if (colors.length === 0) return ''
  return colors[((index % colors.length) + colors.length) % colors.length]
}
