import { notFound } from "next/navigation"
import Link from "next/link"
import { Pencil } from "lucide-react"

import { getOrder } from "@/actions/orders"
import { hasOrderCosting } from "@/actions/finance"
import { getMaterialsForOrders } from "@/actions/inventory"
import { formatDate, formatCurrency } from "@/lib/utils"
import { generatePortalToken } from "@/lib/portal"
import type { OrderDetail } from "@/lib/supabase/types"
import { getOrderStyleSummary, getUniqueOrderStyles } from "@/lib/order-styles"
import { isCircleKgItem, kgToPieces } from "@/lib/circle-calc"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { Button } from "@/components/ui/button"
import { SharePortalButton } from "@/components/orders/share-portal-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { OrderActions } from "@/components/orders/order-actions"
import { OrderAISummary } from "@/components/orders/order-ai-summary"
import { OrderShortagePO } from "@/components/orders/order-shortage-po"

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params
  let order: OrderDetail

  try {
    order = await getOrder(id)
  } catch {
    notFound()
  }

  const hasCosting = await hasOrderCosting(id)
  const materialsForOrder = await getMaterialsForOrders([id])
  const shortages = materialsForOrder
    .filter((m) => m.shortage > 0)
    .map((m) => ({
      id: m.id,
      name: m.name,
      sku: m.sku,
      unit: m.unit,
      shortage: m.shortage,
      cost_per_unit: m.cost_per_unit,
    }))

  const totalQuantity = order.order_items?.reduce(
    (sum, item) => sum + item.quantity,
    0
  ) ?? 0

  const totalValue = order.order_items?.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  ) ?? 0
  const styleSummary = getOrderStyleSummary(order.order_items, order.product_variant)
  const uniqueStyles = getUniqueOrderStyles(order.order_items)
  const salesContact = order.customer

  const portalToken = generatePortalToken(order.id)

  return (
    <>
      <PageHeader
        title={order.order_number || "Order"}
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: order.order_number || "Order" },
        ]}
      >
        <SharePortalButton orderId={order.id} token={portalToken} />
        <Link href={`/orders/${order.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Styles</p>
                  <p className="font-medium">{styleSummary}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <PriorityIndicator
                    priority={order.priority}
                    showLabel
                  />
                </div>
              </div>

              {order.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{order.description}</p>
                </div>
              )}

              <Separator />

              {/* Customer Info */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Customer Information
                </p>
                {salesContact ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{salesContact.name}</p>
                    </div>
                    {salesContact.company && (
                      <div>
                        <p className="text-sm text-muted-foreground">Company</p>
                        <p className="text-sm">{salesContact.company}</p>
                      </div>
                    )}
                    {salesContact.phone && (
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="text-sm">{salesContact.phone}</p>
                      </div>
                    )}
                    {salesContact.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="text-sm">{salesContact.email}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No customer assigned
                  </p>
                )}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Deadline</p>
                  <p className="font-medium">{formatDate(order.deadline)}</p>
                </div>
              </div>

              {order.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{order.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Dispatch Details — shown when dispatched */}
          {order.status === "dispatched" && (order.transporter_name || order.lr_number || order.vehicle_number || order.dispatch_date) && (
            <Card>
              <CardHeader>
                <CardTitle>Dispatch Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {order.transporter_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Transporter</p>
                    <p className="font-medium">{order.transporter_name}</p>
                  </div>
                )}
                {order.lr_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">LR Number</p>
                    <p className="font-mono text-sm">{order.lr_number}</p>
                  </div>
                )}
                {order.vehicle_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle Number</p>
                    <p className="font-mono text-sm">{order.vehicle_number}</p>
                  </div>
                )}
                {order.dispatch_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Dispatch Date</p>
                    <p>{formatDate(order.dispatch_date)}</p>
                  </div>
                )}
                {order.expected_delivery_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Delivery</p>
                    <p>{formatDate(order.expected_delivery_date)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>
                Style, size, and color breakdown for this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Style</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Coating</TableHead>
                    <TableHead className="text-right">Qty / Weight</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_items?.map((item) => {
                    const isKg = isCircleKgItem(item.thickness_mm, item.color)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_variant}</TableCell>
                        <TableCell className="font-medium">{item.size}</TableCell>
                        <TableCell>{item.color}</TableCell>
                        <TableCell className="text-right">
                          {item.quantity} {isKg ? "kg" : "pcs"}
                          {isKg && (() => {
                            const pcs = kgToPieces(item.quantity, item.size, item.thickness_mm, item.color)
                            return pcs ? <span className="block text-xs text-muted-foreground">≈ {pcs.toLocaleString()} pcs</span> : null
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Totals
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {totalQuantity}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(totalValue)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Material Shortage → Purchase Order */}
          <OrderShortagePO orderId={order.id} shortages={shortages} />
        </div>

        {/* Right Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <StatusBadge status={order.status} />
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{formatDate(order.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Styles</span>
                <span className="font-medium">{uniqueStyles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Items</span>
                <span className="font-medium">
                  {order.order_items?.length ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Quantity</span>
                <span className="font-medium">{totalQuantity}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-semibold">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <OrderAISummary orderId={order.id} />

          {/* Quick Actions Card */}
          <OrderActions order={order} hasCosting={hasCosting} />
        </div>
      </div>
    </>
  )
}
