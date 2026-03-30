type StyleItem = {
  product_variant: string | null | undefined
}

export function getUniqueOrderStyles(items: StyleItem[] | null | undefined) {
  const seen = new Set<string>()
  const styles: string[] = []

  for (const item of items ?? []) {
    const style = item.product_variant?.trim()
    if (!style) continue

    const key = style.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    styles.push(style)
  }

  return styles
}

export function getOrderStyleSummary(
  items: StyleItem[] | null | undefined,
  fallback?: string | null
) {
  const styles = getUniqueOrderStyles(items)
  if (styles.length > 0) return styles.join(", ")
  return fallback?.trim() || "—"
}
