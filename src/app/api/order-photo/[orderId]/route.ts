export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Streams the original order-sheet photo same-origin (the CSP blocks images
// from the storage host, and the bucket is private).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // Reads through the user's session so order RLS still applies
  const { data: order } = await supabase
    .from("orders")
    .select("source_photo_path")
    .eq("id", orderId)
    .maybeSingle()
  if (!order?.source_photo_path) return new Response("Not found", { status: 404 })

  const { data, error } = await createAdminClient()
    .storage.from("order-photos")
    .download(order.source_photo_path)
  if (error || !data) return new Response("Not found", { status: 404 })

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  })
}
