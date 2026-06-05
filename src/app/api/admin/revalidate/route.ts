import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { tag } = await request.json().catch(() => ({ tag: "permissions" }))
  revalidateTag(tag ?? "permissions", {})

  return NextResponse.json({ ok: true, tag })
}
