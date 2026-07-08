import type { createAdminClient } from "@/lib/supabase/admin"

/** Master cartons consumed per finished piece, by product name — read off each
 *  product's BOM "Master Cartons" line (qty_required there is already
 *  cartons-per-piece, e.g. 0.1 = 1 carton per 10 pieces). Multiply by a
 *  quantity of pieces to get the carton count. */
export async function getMasterCartonRatios(
  supabase: ReturnType<typeof createAdminClient>,
  productNames: string[]
): Promise<Map<string, number>> {
  const ratios = new Map<string, number>()
  if (productNames.length === 0) return ratios

  const { data: category } = await supabase
    .from("material_categories")
    .select("id")
    .eq("name", "Master Cartons")
    .maybeSingle()
  if (!category) return ratios

  const { data: boms } = await supabase
    .from("bom_headers")
    .select("product_name, bom_items(qty_required, material:materials(category_id))")
    .in("product_name", productNames)
    .eq("is_active", true)

  for (const bom of boms ?? []) {
    for (const item of bom.bom_items ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mat = Array.isArray(item.material) ? item.material[0] : item.material as any
      if (mat?.category_id === category.id) {
        ratios.set(bom.product_name, (ratios.get(bom.product_name) ?? 0) + item.qty_required)
      }
    }
  }

  return ratios
}

/** Formats a carton count for display — omits decimals when it's a whole number. */
export function formatCartons(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
