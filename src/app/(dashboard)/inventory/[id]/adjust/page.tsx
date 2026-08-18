import { notFound, redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getMaterial } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form"

interface AdjustStockPageProps {
  params: Promise<{ id: string }>
}

export default async function AdjustStockPage({ params }: AdjustStockPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") redirect(`/inventory/${id}`)

  let material
  try {
    material = await getMaterial(id)
  } catch {
    notFound()
  }

  return (
    <>
      <PageHeader
        title="Adjust Stock"
        description={`Adjusting ${material.name}`}
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: material.name, href: `/inventory/${material.id}` },
          { label: "Adjust Stock" },
        ]}
      />
      <StockAdjustmentForm material={material} />
    </>
  )
}
