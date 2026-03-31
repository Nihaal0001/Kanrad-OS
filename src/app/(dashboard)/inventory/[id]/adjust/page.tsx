import { redirect } from "next/navigation"

// Stock adjustments are no longer allowed manually.
// Stock only comes from Purchase Orders (receiving) or Production output.
export default function AdjustStockPage() {
  redirect("/inventory/purchase-orders")
}
