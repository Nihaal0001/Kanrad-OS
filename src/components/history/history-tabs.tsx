"use client"

import { useState } from "react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ── Type definitions ────────────────────────────────────────

interface HistoryOrder {
  id: string
  order_number: string
  product_variant: string | null
  status: string
  quantity: number | null
  created_at: string
  customer: { name: string; company: string | null } | null
}

interface HistoryBatch {
  id: string
  batch_number: string | null
  status: string
  created_at: string
  order: { order_number: string; product_variant: string | null } | null
}

interface HistoryPO {
  id: string
  po_number: string | null
  supplier_name: string | null
  status: string
  total_amount: number | null
  created_at: string
}

interface HistoryShipment {
  id: string
  shipment_number: string | null
  customer_name: string | null
  courier_name: string | null
  tracking_number: string | null
  status: string
  expected_delivery_date: string | null
  created_at: string
}

interface HistoryTransaction {
  id: string
  transaction_date: string | null
  description: string | null
  amount: number | null
  transaction_type: string | null
  payment_status: string | null
  created_at: string
}

interface HistoryTabsProps {
  orders: HistoryOrder[]
  batches: HistoryBatch[]
  purchaseOrders: HistoryPO[]
  shipments: HistoryShipment[]
  transactions: HistoryTransaction[]
}

// ── Empty row ───────────────────────────────────────────────

function EmptyRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-32 text-center text-sm text-muted-foreground">
        No records found.
      </TableCell>
    </TableRow>
  )
}

// ── Tab contents ─────────────────────────────────────────────

function OrdersTab({ orders }: { orders: HistoryOrder[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <EmptyRow cols={6} />
          ) : (
            orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                <TableCell>
                  {o.customer ? (
                    <span>
                      {o.customer.name}
                      {o.customer.company && (
                        <span className="ml-1 text-muted-foreground text-xs">({o.customer.company})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell>{o.product_variant ?? "--"}</TableCell>
                <TableCell className="text-right tabular-nums">{o.quantity ?? "--"}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
                <TableCell className="text-sm">{formatDate(o.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ProductionTab({ batches }: { batches: HistoryBatch[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch #</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.length === 0 ? (
            <EmptyRow cols={5} />
          ) : (
            batches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.batch_number ?? "--"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {b.order?.order_number ?? "--"}
                </TableCell>
                <TableCell>{b.order?.product_variant ?? "--"}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                <TableCell className="text-sm">{formatDate(b.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function PurchaseOrdersTab({ pos }: { pos: HistoryPO[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pos.length === 0 ? (
            <EmptyRow cols={5} />
          ) : (
            pos.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-mono text-xs">{po.po_number ?? "--"}</TableCell>
                <TableCell>{po.supplier_name ?? "--"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {po.total_amount !== null ? formatCurrency(po.total_amount) : "--"}
                </TableCell>
                <TableCell><StatusBadge status={po.status} /></TableCell>
                <TableCell className="text-sm">{formatDate(po.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function LogisticsTab({ shipments }: { shipments: HistoryShipment[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Courier</TableHead>
            <TableHead>Tracking #</TableHead>
            <TableHead>Delivered By</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.length === 0 ? (
            <EmptyRow cols={6} />
          ) : (
            shipments.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.shipment_number ?? "--"}</TableCell>
                <TableCell>{s.customer_name ?? "--"}</TableCell>
                <TableCell>{s.courier_name ?? "--"}</TableCell>
                <TableCell className="font-mono text-xs">{s.tracking_number ?? "--"}</TableCell>
                <TableCell className="text-sm">
                  {s.expected_delivery_date ? formatDate(s.expected_delivery_date) : "--"}
                </TableCell>
                <TableCell className="text-sm">{formatDate(s.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function FinanceTab({ transactions }: { transactions: HistoryTransaction[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <EmptyRow cols={5} />
          ) : (
            transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">
                  {t.transaction_date ? formatDate(t.transaction_date) : formatDate(t.created_at)}
                </TableCell>
                <TableCell className="max-w-[240px] truncate">{t.description ?? "--"}</TableCell>
                <TableCell>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                    {t.transaction_type ?? "--"}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.amount !== null ? formatCurrency(t.amount) : "--"}
                </TableCell>
                <TableCell>
                  {t.payment_status && <StatusBadge status={t.payment_status} />}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

export function HistoryTabs({
  orders,
  batches,
  purchaseOrders,
  shipments,
  transactions,
}: HistoryTabsProps) {
  const [activeTab, setActiveTab] = useState("orders")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-6 flex flex-wrap gap-1 h-auto">
        <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
        <TabsTrigger value="production">Production ({batches.length})</TabsTrigger>
        <TabsTrigger value="purchase-orders">Purchase Orders ({purchaseOrders.length})</TabsTrigger>
        <TabsTrigger value="logistics">Logistics ({shipments.length})</TabsTrigger>
        <TabsTrigger value="finance">Finance ({transactions.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="orders">
        <OrdersTab orders={orders} />
      </TabsContent>
      <TabsContent value="production">
        <ProductionTab batches={batches} />
      </TabsContent>
      <TabsContent value="purchase-orders">
        <PurchaseOrdersTab pos={purchaseOrders} />
      </TabsContent>
      <TabsContent value="logistics">
        <LogisticsTab shipments={shipments} />
      </TabsContent>
      <TabsContent value="finance">
        <FinanceTab transactions={transactions} />
      </TabsContent>
    </Tabs>
  )
}
