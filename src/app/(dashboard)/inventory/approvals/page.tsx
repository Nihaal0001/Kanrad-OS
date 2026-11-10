import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, CheckCircle2, XCircle, ShoppingCart, Scale } from "lucide-react"

import { getPurchaseOrders, getReceiptVarianceApprovals } from "@/actions/inventory"
import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { POApprovalButtons } from "@/components/inventory/po-approval-buttons"
import { ReceiptVarianceApprovalButtons } from "@/components/inventory/receipt-variance-approval-buttons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function POApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle()

  if (profile?.role !== "admin") {
    notFound()
  }

  const [pending, approved, rejected, receiptApprovalResult] = await Promise.all([
    getPurchaseOrders({ approval_status: "pending_approval" }),
    getPurchaseOrders({ approval_status: "approved" }),
    getPurchaseOrders({ approval_status: "rejected" }),
    getReceiptVarianceApprovals(),
  ])
  const receiptApprovals = receiptApprovalResult.data

  return (
    <>
      <PageHeader
        title="Purchase & Receipt Approvals"
        description="Approve purchase orders and actual receipt quantities before inventory changes"
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Purchase Orders", href: "/inventory/purchase-orders" },
          { label: "Approvals" },
        ]}
      >
        <Button variant="outline" asChild>
          <Link href="/inventory/purchase-orders">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="border-amber-300 bg-amber-500/5 text-center py-4">
          <CardContent className="p-0 space-y-1">
            <Clock className="h-5 w-5 text-amber-500 mx-auto" />
            <p className="text-2xl font-bold text-amber-600">{pending.length + receiptApprovals.length}</p>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-300 bg-emerald-500/5 text-center py-4">
          <CardContent className="p-0 space-y-1">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
            <p className="text-2xl font-bold text-emerald-600">{approved.length}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card className="border-red-300 bg-red-500/5 text-center py-4">
          <CardContent className="p-0 space-y-1">
            <XCircle className="h-5 w-5 text-red-500 mx-auto" />
            <p className="text-2xl font-bold text-red-500">{rejected.length}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Scale className="h-4 w-4 text-amber-500" />
            Receipt Quantity Changes
            {receiptApprovals.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white font-medium">
                {receiptApprovals.length}
              </span>
            )}
          </h2>
          {receiptApprovals.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-7">
              <p className="text-sm text-muted-foreground">No changed receipt quantities awaiting approval.</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO / Material</TableHead>
                    <TableHead className="text-right">Estimated</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptApprovals.map((request) => {
                    const po = Array.isArray(request.purchase_order) ? request.purchase_order[0] : request.purchase_order
                    const item = Array.isArray(request.item) ? request.item[0] : request.item
                    const material = Array.isArray(item?.material) ? item?.material[0] : item?.material
                    const actual = Number(request.current_received) + Number(request.requested_quantity)
                    const difference = actual - Number(request.expected_quantity)
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Link href={`/inventory/purchase-orders/${request.purchase_order_id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                            {po?.po_number ?? "Purchase order"}
                          </Link>
                          <p className="text-xs text-muted-foreground">{material?.name ?? "Material"} · {po?.supplier_name}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{Number(request.expected_quantity).toLocaleString("en-IN")} pcs</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{actual.toLocaleString("en-IN")} pcs</TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${difference > 0 ? "text-amber-600" : "text-blue-600"}`}>
                          {difference > 0 ? "+" : ""}{difference.toLocaleString("en-IN")} pcs
                        </TableCell>
                        <TableCell>{request.bill_no}</TableCell>
                        <TableCell><ReceiptVarianceApprovalButtons requestId={request.id} /></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending Approval
            {pending.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white font-medium">
                {pending.length}
              </span>
            )}
          </h2>
          {pending.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-10">
              <div className="text-center">
                <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No purchase orders awaiting approval.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/inventory/purchase-orders/${po.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </TableCell>
                      <TableCell>{po.supplier_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(po.order_date)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(po.total_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={po.status} />
                      </TableCell>
                      <TableCell>
                        <POApprovalButtons poId={po.id} approvalStatus={po.approval_status ?? "pending_approval"} isAdmin />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Approved section */}
        {approved.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Approved
            </h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approved.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/inventory/purchase-orders/${po.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </TableCell>
                      <TableCell>{po.supplier_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(po.order_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(po.total_amount)}</TableCell>
                      <TableCell><StatusBadge status={po.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.approval_notes ?? "--"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Rejected section */}
        {rejected.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Rejected
            </h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejected.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/inventory/purchase-orders/${po.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </TableCell>
                      <TableCell>{po.supplier_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(po.order_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(po.total_amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.approval_notes ?? "--"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
