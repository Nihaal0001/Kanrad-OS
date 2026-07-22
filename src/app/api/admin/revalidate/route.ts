import { NextRequest, NextResponse } from "next/server"
import { revalidateTag, revalidatePath } from "next/cache"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  for (const tag of [
    "materials",
    "categories",
    "orders",
    "bom",
    "warehouse_items",
    "shipments",
    "purchase_orders",
    "stock_transactions",
  ]) {
    revalidateTag(tag, {})
  }
  for (const path of [
    "/inventory",
    "/master-inventory",
    "/inventory/purchase-orders",
    "/orders",
    "/products",
    "/warehouse",
    "/",
  ]) {
    revalidatePath(path)
  }
  return NextResponse.json({ success: true })
}
