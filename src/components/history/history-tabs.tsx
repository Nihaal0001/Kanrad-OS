"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { Input } from "@/components/ui/input"
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
  total_quantity: number | null
  created_at: string
  customer: { name: string; company: string | null } | null
}

interface HistoryBatch {
  id: string
  log_date: string
  quantity_produced: number | null | undefined
  quantity_rejected: number | null | undefined
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
  invoice_number: string | null
  customer_name: string | null
  total_amount: number | null
  amount_paid: number | null
  status: string | null
  issue_date: string | null
  created_at: string
}

interface HistoryPayable {
  id: string
  invoice_number: string | null
  supplier_name: string | null
  total_amount: number | null
  amount_paid: number | null
  status: string | null
  invoice_date: string | null
  created_at: string
}

interface HistoryDispatch {
  id: string
  quantity: number
  bill_no: string | null
  dispatched_at: string
  notes: string | null
  created_at: string
  warehouse_item: { item_name: string; sku: string | null } | null
  order: { order_number: string } | null
}

interface HistoryTabsProps {
  orders: HistoryOrder[]
  batches: HistoryBatch[]
  purchaseOrders: HistoryPO[]
  shipments: HistoryShipment[]
  transactions: HistoryTransaction[]
  payables: HistoryPayable[]
  dispatches: HistoryDispatch[]
}

// ── Search helper ────────────────────────────────────────────

function matches(query: string, ...fields: (string | null | undefined)[]) {
  if (!query) return true
  const q = query.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(q))
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
                <TableCell className="text-right tabular-nums">{o.total_quantity ?? "--"}</TableCell>
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
            <TableHead>Date</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Produced</TableHead>
            <TableHead className="text-right">Rejected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.length === 0 ? (
            <EmptyRow cols={5} />
          ) : (
            batches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="text-sm">{formatDate(b.log_date)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {b.order?.order_number ?? "--"}
                </TableCell>
                <TableCell>{b.order?.product_variant ?? "--"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.quantity_produced != null ? b.quantity_produced.toLocaleString("en-IN") : "--"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.quantity_rejected ? b.quantity_rejected.toLocaleString("en-IN") : "--"}
                </TableCell>
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
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <EmptyRow cols={6} />
          ) : (
            transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.invoice_number ?? "--"}</TableCell>
                <TableCell>{t.customer_name ?? "--"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.total_amount !== null ? formatCurrency(t.total_amount) : "--"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.amount_paid !== null ? formatCurrency(t.amount_paid) : "--"}
                </TableCell>
                <TableCell>
                  {t.status && <StatusBadge status={t.status} />}
                </TableCell>
                <TableCell className="text-sm">
                  {t.issue_date ? formatDate(t.issue_date) : formatDate(t.created_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function PayablesTab({ payables }: { payables: HistoryPayable[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bill / Invoice #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payables.length === 0 ? (
            <EmptyRow cols={6} />
          ) : (
            payables.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.invoice_number ?? "--"}</TableCell>
                <TableCell>{p.supplier_name ?? "--"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.total_amount !== null ? formatCurrency(p.total_amount) : "--"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.amount_paid !== null ? formatCurrency(p.amount_paid) : "--"}
                </TableCell>
                <TableCell>
                  {p.status && <StatusBadge status={p.status} />}
                </TableCell>
                <TableCell className="text-sm">
                  {p.invoice_date ? formatDate(p.invoice_date) : formatDate(p.created_at)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function DispatchesTab({ dispatches }: { dispatches: HistoryDispatch[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Bill No.</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dispatches.length === 0 ? (
            <EmptyRow cols={6} />
          ) : (
            dispatches.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.warehouse_item?.item_name ?? "--"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {d.warehouse_item?.sku ?? "--"}
                </TableCell>
                <TableCell className="font-mono text-xs">{d.order?.order_number ?? "--"}</TableCell>
                <TableCell className="text-right tabular-nums">{d.quantity}</TableCell>
                <TableCell className="font-mono text-xs">{d.bill_no ?? "--"}</TableCell>
                <TableCell className="text-sm">{formatDate(d.dispatched_at)}</TableCell>
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
  payables,
  dispatches,
}: HistoryTabsProps) {
  const [activeTab, setActiveTab] = useState("orders")
  const [search, setSearch] = useState("")

  const filteredOrders = useMemo(
    () => orders.filter((o) => matches(search, o.order_number, o.product_variant, o.customer?.name, o.customer?.company)),
    [orders, search]
  )
  const filteredBatches = useMemo(
    () => batches.filter((b) => matches(search, b.order?.order_number, b.order?.product_variant)),
    [batches, search]
  )
  const filteredPOs = useMemo(
    () => purchaseOrders.filter((p) => matches(search, p.po_number, p.supplier_name)),
    [purchaseOrders, search]
  )
  const filteredShipments = useMemo(
    () => shipments.filter((s) => matches(search, s.shipment_number, s.customer_name, s.courier_name, s.tracking_number)),
    [shipments, search]
  )
  const filteredTransactions = useMemo(
    () => transactions.filter((t) => matches(search, t.invoice_number, t.customer_name)),
    [transactions, search]
  )
  const filteredPayables = useMemo(
    () => payables.filter((p) => matches(search, p.invoice_number, p.supplier_name)),
    [payables, search]
  )
  const filteredDispatches = useMemo(
    () => dispatches.filter((d) =>
      matches(search, d.warehouse_item?.item_name, d.warehouse_item?.sku, d.order?.order_number, d.bill_no)
    ),
    [dispatches, search]
  )

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="orders">Orders ({filteredOrders.length})</TabsTrigger>
          <TabsTrigger value="production">Production ({filteredBatches.length})</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders ({filteredPOs.length})</TabsTrigger>
          <TabsTrigger value="dispatches">Dispatches ({filteredDispatches.length})</TabsTrigger>
          <TabsTrigger value="logistics">Logistics ({filteredShipments.length})</TabsTrigger>
          <TabsTrigger value="finance">Finance ({filteredTransactions.length})</TabsTrigger>
          <TabsTrigger value="payables">Payables ({filteredPayables.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <OrdersTab orders={filteredOrders} />
        </TabsContent>
        <TabsContent value="production">
          <ProductionTab batches={filteredBatches} />
        </TabsContent>
        <TabsContent value="purchase-orders">
          <PurchaseOrdersTab pos={filteredPOs} />
        </TabsContent>
        <TabsContent value="dispatches">
          <DispatchesTab dispatches={filteredDispatches} />
        </TabsContent>
        <TabsContent value="logistics">
          <LogisticsTab shipments={filteredShipments} />
        </TabsContent>
        <TabsContent value="finance">
          <FinanceTab transactions={filteredTransactions} />
        </TabsContent>
        <TabsContent value="payables">
          <PayablesTab payables={filteredPayables} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
