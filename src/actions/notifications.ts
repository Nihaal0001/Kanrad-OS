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
      { data: activeOrders },
      { data: dueThisWeek },
      { data: lowStockItems },
      { data: recentOrders },
      { data: recentNotifications },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id, status")
        .in("status", ["confirmed", "in_production"]),

      supabase
        .from("orders")
        .select("id")
        .in("status", ["confirmed", "in_production"])
        .lte("deadline", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0])
        .gte("deadline", new Date().toISOString().split("T")[0]),

      supabase
        .from("materials")
        .select("id, current_stock, min_stock_level")
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
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalizedOrders = (recentOrders ?? []).map((o: any) => ({
      ...o,
      customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
    }))

    return {
      activeOrdersCount: activeOrders?.length ?? 0,
      confirmedCount: activeOrders?.filter((o) => o.status === "confirmed").length ?? 0,
      inProductionCount: activeOrders?.filter((o) => o.status === "in_production").length ?? 0,
      dueThisWeekCount: dueThisWeek?.length ?? 0,
      lowStockCount: lowStockItems?.length ?? 0,
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
