import Link from "next/link"

import { getRolePermissions } from "@/actions/users"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getMobileMoreSections } from "@/lib/constants"

export default async function MobileMorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role = "worker"
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle()

    role = profile?.role ?? role
  }

  const allowedPermissions = await getRolePermissions(role)
  const sections = getMobileMoreSections(allowedPermissions)

  return (
    <div className="space-y-6">
      <PageHeader
        title="More"
        description="Quick access to the rest of your workspace on mobile."
      />

      <div className="grid gap-4">
        {sections.map((section) => {
          const SectionIcon = section.icon

          return (
            <Card key={section.id} className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="border-b border-border/60 bg-sidebar-foreground/[0.02] pb-4">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sidebar-accent/12 text-sidebar-accent-foreground">
                    <SectionIcon className="h-4 w-4" />
                  </span>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 p-3">
                {section.items.map((item) => {
                  const ItemIcon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 transition-colors hover:border-primary/25 hover:bg-primary/5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent/10 text-sidebar-accent-foreground">
                        <ItemIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
