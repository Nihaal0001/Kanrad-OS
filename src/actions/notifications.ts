"use server"

import { revalidatePath, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function getNotifications() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return data
}

export async function getUnreadCount() {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false)

  if (error) return 0
  return count ?? 0
}

export async function markAsRead(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/notifications")
  return { success: true }
}

export async function markAllAsRead() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false)

  if (error) return { error: error.message }

  revalidatePath("/notifications")
  return { success: true }
}

const _getDashboardStats = unstable_cache(
  async () => {
    const supabase = createAdminClient()

    const [
      { count: activeOrdersCount },
      { count: confirmedCount },
      { count: inProductionCount },
      { count: dueThisWeekCount },
      { count: lowStockCount },
      { data: recentOrders },
      { data: recentNotifications },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["confirmed", "in_production"]),

      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),

      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_production"),

      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["confirmed", "in_production"])
        .lte("deadline", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0])
        .gte("deadline", new Date().toISOString().split("T")[0]),

      supabase
        .from("materials")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .filter("current_stock", "lte", "min_stock_level"),

      supabase
        .from("orders")
        .select(`
          id, order_number, product_variant, total_quantity, deadline, status, priority,
          customer:customers(id, name, company)
        `)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("notifications")
        .select("id, type, message, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalizedOrders = (recentOrders ?? []).map((o: any) => ({
      ...o,
      customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
    }))

    return {
      activeOrdersCount: activeOrdersCount ?? 0,
      confirmedCount: confirmedCount ?? 0,
      inProductionCount: inProductionCount ?? 0,
      dueThisWeekCount: dueThisWeekCount ?? 0,
      lowStockCount: lowStockCount ?? 0,
      recentOrders: normalizedOrders,
      recentNotifications: recentNotifications ?? [],
    }
  },
  ["dashboard-stats"],
  { tags: ["dashboard", "orders", "materials"], revalidate: 60 }
)

export async function getDashboardStats() {
  return _getDashboardStats()
}
