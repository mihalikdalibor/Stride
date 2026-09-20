// Builds the CSS background for a day dot: a pie of the category colors of
// everything on that day. One equal slice per item, with same-category items
// merged into one contiguous arc (2 work + 1 gym → 2/3 work · 1/3 gym).
// Items without a category take a neutral gray slice.

export const NO_CAT_COLOR = 'var(--color-text-tertiary)'

// below ~6px a 7th slice is sub-pixel noise, so the tail is merged into gray
const MAX_SLICES = 6

const pct = (n: number) => `${Math.round(n * 100) / 100}%`

// `order` = the user's category color order, so the same mix of categories
// always draws the same dot; unknown colors and the neutral one sort last.
function rank(color: string, order: string[]): number {
  const i = order.indexOf(color)
  return i === -1 ? order.length : i
}

function merge(groups: [string, number][], color: string, count: number) {
  const existing = groups.find(g => g[0] === color)
  if (existing) existing[1] += count
  else groups.push([color, count])
}

// '#ff9500' | 'conic-gradient(#ff9500 0% 50%, var(--color-text-tertiary) 50% 100%)'
export function dotBackground(colors: (string | null)[], order: string[] = []): string {
  if (colors.length === 0) return 'transparent'

  const counts = new Map<string, number>()
  for (const c of colors) {
    const key = c ?? NO_CAT_COLOR
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  let groups: [string, number][] = [...counts].sort((a, b) => rank(a[0], order) - rank(b[0], order))

  if (groups.length > MAX_SLICES) {
    const kept = new Set(
      [...groups].sort((a, b) => b[1] - a[1]).slice(0, MAX_SLICES - 1).map(g => g[0]),
    )
    const rest = groups.filter(g => !kept.has(g[0])).reduce((s, g) => s + g[1], 0)
    groups = groups.filter(g => kept.has(g[0]))
    merge(groups, NO_CAT_COLOR, rest)
  }

  if (groups.length === 1) return groups[0][0]

  const total = colors.length
  let acc = 0
  const stops = groups.map(([color, n], i) => {
    const from = acc / total * 100
    acc += n
    const to = i === groups.length - 1 ? 100 : acc / total * 100
    return `${color} ${pct(from)} ${pct(to)}`
  })
  return `conic-gradient(${stops.join(', ')})`
}
