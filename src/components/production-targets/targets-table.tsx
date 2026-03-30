"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import type { RecordActualFormData } from "@/lib/validators/production-targets"
import { recordActualProduction } from "@/actions/production-targets"
import { friendlyError, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ProductionTarget {
  id: string
  product_name: string
  daily_target_qty: number
  target_date: string
  actual_qty: number | null
  status: string
  created_at: string
}

interface TargetsTableProps {
  targets: ProductionTarget[]
}

function StatusBadge({ status }: { status: string }) {
  if (status === "met") {
    return <Badge variant="success">Met</Badge>
  }
  if (status === "not_met") {
    return <Badge variant="destructive">Not Met</Badge>
  }
  return <Badge variant="outline">Pending</Badge>
}

export function TargetsTable({ targets }: TargetsTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [recordId, setRecordId] = useState<string | null>(null)
  const [actualQty, setActualQty] = useState("")
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    if (statusFilter === "all") return targets
    return targets.filter((t) => t.status === statusFilter)
  }, [targets, statusFilter])

  async function handleRecord() {
    if (!recordId) return
    const qty = parseFloat(actualQty)
    if (isNaN(qty) || qty < 0) {
      toast.error("Enter a valid quantity")
      return
    }
    setLoading(true)
    const formData: RecordActualFormData = { actual_qty: qty }
    const result = await recordActualProduction(recordId, formData)
    setLoading(false)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Actual production recorded")
    setRecordId(null)
    setActualQty("")
    router.refresh()
  }

  const selectedTarget = targets.find((t) => t.id === recordId)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="met">Met</SelectItem>
            <SelectItem value="not_met">Not Met</SelectItem>
          </SelectContent>
        </Select>

        <p className="ml-auto text-sm text-muted-foreground">
          {filtered.length} target{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No targets found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Daily Target</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead className="text-right">Actual Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((target) => (
                <TableRow key={target.id}>
                  <TableCell className="font-medium">{target.product_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{target.daily_target_qty}</TableCell>
                  <TableCell className="text-sm">{formatDate(target.target_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {target.actual_qty !== null ? (
                      <span
                        className={cn(
                          "font-medium",
                          target.actual_qty >= target.daily_target_qty
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {target.actual_qty}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={target.status} />
                  </TableCell>
                  <TableCell>
                    {target.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setRecordId(target.id)
                          setActualQty(target.actual_qty?.toString() ?? "")
                        }}
                      >
                        Record Actual
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Record actual dialog */}
      <Dialog open={recordId !== null} onOpenChange={(open) => { if (!open) { setRecordId(null); setActualQty("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Actual Production</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selectedTarget && (
              <p className="text-sm text-muted-foreground">
                Product: <span className="font-medium text-foreground">{selectedTarget.product_name}</span>
                {" "}— Target: <span className="font-medium text-foreground">{selectedTarget.daily_target_qty}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="actual_qty">Actual Quantity Produced</Label>
              <Input
                id="actual_qty"
                type="number"
                min={0}
                step="1"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
                placeholder="Enter actual qty"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRecordId(null)} disabled={loading}>Cancel</Button>
              <Button onClick={handleRecord} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
