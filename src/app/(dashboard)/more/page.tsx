import Link from "next/link"
import { LogOut } from "lucide-react"

import { getRolePermissions } from "@/actions/users"
import { createClient } from "@/lib/supabase/server"
import { getFilteredFlatNavItems } from "@/lib/constants"
import { MobileLogout } from "@/components/layout/mobile-logout"

export default async function MobileMorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role = "worker"
  let department: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, department")
      .eq("auth_id", user.id)
      .maybeSingle()
    role = profile?.role ?? role
    department = profile?.department ?? null
  }

  // Same rule as the dashboard layout: admins use role permissions; other
  // users use their per-user tab grants (department), falling back to role.
  const allowedPermissions =
    role !== "admin" && department
      ? department.split(",").map((d) => d.trim()).filter(Boolean)
      : await getRolePermissions(role)
  const items = getFilteredFlatNavItems(allowedPermissions)

  return (
    <div className="p-2">
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card/80 px-3 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/25 hover:bg-primary/5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent/10 text-sidebar-accent-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
            </Link>
          )
        })}

        <MobileLogout />
      </div>
    </div>
  )
}
