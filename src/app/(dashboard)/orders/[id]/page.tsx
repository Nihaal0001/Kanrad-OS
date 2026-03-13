import { notFound } from "next/navigation"
import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"

import { getOrder } from "@/actions/orders"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { OrderDetail } from "@/lib/supabase/types"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { Button } from "@/components/ui/button"
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

  const totalQuantity = order.order_items?.reduce(
    (sum, item) => sum + item.quantity,
    0
  ) ?? 0

  const totalValue = order.order_items?.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  ) ?? 0

  return (
    <>
      <PageHeader title={order.order_number || "Order"}>
        <Link href={`/orders/${order.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Style Name</p>
                  <p className="font-medium">{order.style_name}</p>
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

              {/* Buyer Info */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Buyer Information
                </p>
                {order.buyer ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{order.buyer.name}</p>
                    </div>
                    {order.buyer.company && (
                      <div>
                        <p className="text-sm text-muted-foreground">Company</p>
                        <p className="text-sm">{order.buyer.company}</p>
                      </div>
                    )}
                    {order.buyer.phone && (
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="text-sm">{order.buyer.phone}</p>
                      </div>
                    )}
                    {order.buyer.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="text-sm">{order.buyer.email}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No buyer assigned
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

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>
                Size and color breakdown for this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.size}</TableCell>
                      <TableCell>{item.color}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
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
        </div>

        {/* Right Column */}
        <div className="space-y-6">
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

          {/* Quick Actions Card */}
          <OrderActions order={order} />
        </div>
      </div>
    </>
  )
}
