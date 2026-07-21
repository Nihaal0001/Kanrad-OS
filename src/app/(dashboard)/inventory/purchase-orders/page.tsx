export const revalidate = 60

import Link from "next/link"
import { ShoppingCart, ClipboardCheck } from "lucide-react"

import { getPurchaseOrders } from "@/actions/inventory"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PurchaseOrdersTable } from "@/components/inventory/purchase-orders-table"

export default async function PurchaseOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle()
  const isAdmin = profile?.role === "admin"

  const [purchaseOrders, pendingCount] = await Promise.all([
    getPurchaseOrders(),
    getPurchaseOrders({ approval_status: "pending_approval" }).then((r) => r.length),
  ])

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Raised from an order's material shortage — see an order's detail page to create one"
      >
        {isAdmin && (
          <Button variant="outline" asChild>
            <Link href="/inventory/approvals" className="relative">
              <ClipboardCheck className="h-4 w-4" />
              Approvals
              {pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white font-semibold leading-none">
                  {pendingCount}
                </span>
              )}
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to Inventory</Link>
        </Button>
      </PageHeader>

      {purchaseOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders yet"
          description="Purchase orders are raised from an order's Material Shortage section, not here."
        />
      ) : (
        <PurchaseOrdersTable purchaseOrders={purchaseOrders} />
      )}
    </>
  )
}
