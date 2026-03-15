"use server"

import { createClient } from "@/lib/supabase/server"

export type SearchResult = {
  id: string
  type: "order" | "material" | "worker"
  title: string
  subtitle: string
  href: string
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []

  // Finding #9 — escape LIKE wildcards to prevent performance attacks
  const q = query.trim().replace(/%/g, "\\%").replace(/_/g, "\\_")
  const supabase = await createClient()

  const [ordersRes, materialsRes, workersRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, style_name, status")
      .or(`order_number.ilike.%${q}%,style_name.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("materials")
      .select("id, name, sku, unit")
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("profiles")
      .select("id, full_name, department, role")
      .or(`full_name.ilike.%${q}%,department.ilike.%${q}%`)
      .limit(5),
  ])

  const results: SearchResult[] = []

  for (const order of ordersRes.data ?? []) {
    results.push({
      id: order.id,
      type: "order",
      title: order.order_number,
      subtitle: `${order.style_name} · ${order.status}`,
      href: `/orders/${order.id}`,
    })
  }

  for (const material of materialsRes.data ?? []) {
    results.push({
      id: material.id,
      type: "material",
      title: material.name,
      subtitle: `${material.sku} · ${material.unit}`,
      href: `/inventory/${material.id}`,
    })
  }

  for (const worker of workersRes.data ?? []) {
    results.push({
      id: worker.id,
      type: "worker",
      title: worker.full_name,
      subtitle: [worker.department, worker.role].filter(Boolean).join(" · "),
      href: `/hr/attendance`,
    })
  }

  return results
}

export async function getQuickLinks() {
  return [
    { label: "New Order", href: "/orders/new", shortcut: "O" },
    { label: "Mark Attendance", href: "/hr/attendance", shortcut: "A" },
    { label: "New Purchase Order", href: "/inventory/purchase-orders/new", shortcut: "P" },
    { label: "New Invoice", href: "/finance/invoices/new", shortcut: "I" },
    { label: "New Task", href: "/tasks", shortcut: "T" },
    { label: "Production Overview", href: "/production", shortcut: null },
    { label: "Quality Checks", href: "/quality", shortcut: null },
    { label: "Dashboard", href: "/", shortcut: null },
  ]
}
