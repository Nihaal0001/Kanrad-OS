import { notFound } from "next/navigation"

import { getPurchaseOrder } from "@/actions/inventory"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseOrderDetail } from "@/components/inventory/purchase-order-detail"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Download } from "lucide-react"

interface PurchaseOrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PurchaseOrderDetailPage({
  params,
}: PurchaseOrderDetailPageProps) {
  const { id } = await params

  let po
  try {
    po = await getPurchaseOrder(id)
  } catch {
    notFound()
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle()
  const isAdmin = profile?.role === "admin"

  return (
    <>
      <PageHeader
        title={po.po_number}
        description={`Supplier: ${po.supplier_name}`}
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Purchase Orders", href: "/inventory/purchase-orders" },
          { label: po.po_number },
        ]}
      >
        <Button variant="outline" asChild>
          <Link href={`/api/purchase-order/${po.id}/pdf`}>
            <Download className="h-4 w-4" />
            Download PDF
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/inventory/purchase-orders">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>
      <PurchaseOrderDetail po={po} isAdmin={isAdmin} />
    </>
  )
}
