import Link from "next/link"
import { Calculator, ChevronRight } from "lucide-react"

import { getOrderCostings } from "@/actions/finance"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

export default async function CostingPage() {
  // Fetch all orders (for "Add Costing" option), and existing costings
  const supabase = await createClient()
  const [costings, { data: orders }] = await Promise.all([
    getOrderCostings(),
    supabase
      .from("orders")
      .select("id, order_number, style_name, status")
      .in("status", ["in_production", "completed", "dispatched"])
      .order("created_at", { ascending: false }),
  ])

  const costedOrderIds = new Set(costings.map((c) => c.order_id))
  const uncostedOrders = (orders ?? []).filter((o) => !costedOrderIds.has(o.id))

  return (
    <>
      <PageHeader
        title="Order Costing"
        description="Per-order cost breakdown and analysis"
      />

      {costings.length === 0 && uncostedOrders.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No costing data"
          description="Cost breakdowns will appear here as orders are processed"
        />
      ) : (
        <div className="space-y-6">
          {/* Existing costings */}
          {costings.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Costed Orders
              </h2>
              <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
                <span>Order</span>
                <span>Materials</span>
                <span>Labor</span>
                <span>Overhead</span>
                <span>Total</span>
                <span />
              </div>
              {costings.map((c) => (
                <Link key={c.id} href={`/finance/costing/${c.order_id}`}>
                  <Card className="transition-colors hover:bg-accent/30">
                    <CardContent className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_40px] items-center gap-4 p-4">
                      <div>
                        <p className="text-sm font-medium">{c.order?.order_number ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.order?.style_name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">₹{formatCurrency(c.material_cost)}</p>
                      <p className="text-sm text-muted-foreground">₹{formatCurrency(c.labor_cost)}</p>
                      <p className="text-sm text-muted-foreground">₹{formatCurrency(c.overhead_cost)}</p>
                      <p className="text-sm font-semibold">₹{formatCurrency(c.total_cost)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Uncosted orders */}
          {uncostedOrders.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Orders Without Costing
              </h2>
              {uncostedOrders.map((o) => (
                <Card key={o.id} className="border-dashed">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{o.style_name}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/finance/costing/${o.id}`}>
                        <Calculator className="h-4 w-4" />
                        Add Costing
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
