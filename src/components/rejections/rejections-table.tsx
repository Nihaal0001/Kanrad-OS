"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { approveRejectionReturn, type ApproveReturnFormData } from "@/actions/rejections"
import { friendlyError, formatDate } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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

interface Rejection {
  id: string
  stage: string
  item_name: string
  quantity: number
  reason: string
  return_type: string | null
  notes: string | null
  created_at: string
}

interface RejectionsTableProps {
  rejections: Rejection[]
}

const STAGE_LABELS: Record<string, string> = {
  production: "Production",
  warehouse: "Warehouse",
  logistics: "Logistics",
  client: "Client",
}

const RETURN_TYPE_LABELS: Record<string, string> = {
  loss: "Loss",
  return_to_usable: "Return to Usable",
  non_saleable: "Non-Saleable",
  saleable: "Saleable",
}

export function RejectionsTable({ rejections }: RejectionsTableProps) {
  const router = useRouter()
  const [stageFilter, setStageFilter] = useState("all")
  const [approveId, setApproveId] = useState<string | null>(null)
  const [returnType, setReturnType] = useState<ApproveReturnFormData["return_type"]>("loss")
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    if (stageFilter === "all") return rejections
    return rejections.filter((r) => r.stage === stageFilter)
  }, [rejections, stageFilter])

  async function handleApproveReturn() {
    if (!approveId) return
    setLoading(true)
    const result = await approveRejectionReturn(approveId, { return_type: returnType })
    setLoading(false)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Return type recorded")
    setApproveId(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="warehouse">Warehouse</SelectItem>
            <SelectItem value="logistics">Logistics</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>

        <p className="ml-auto text-sm text-muted-foreground">
          {filtered.length} rejection{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No rejections found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status / Return Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[100px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rejection) => (
                <TableRow key={rejection.id}>
                  <TableCell>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {STAGE_LABELS[rejection.stage] ?? rejection.stage}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{rejection.item_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{rejection.quantity}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {rejection.reason}
                  </TableCell>
                  <TableCell>
                    {rejection.return_type ? (
                      <StatusBadge status={rejection.return_type} />
                    ) : (
                      <span className="text-sm text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(rejection.created_at)}</TableCell>
                  <TableCell>
                    {!rejection.return_type && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setApproveId(rejection.id)
                          setReturnType("loss")
                        }}
                      >
                        Approve Return
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Approve return dialog */}
      <Dialog open={approveId !== null} onOpenChange={(open) => { if (!open) setApproveId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Return Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Return Type</Label>
              <Select
                value={returnType}
                onValueChange={(v) => setReturnType(v as ApproveReturnFormData["return_type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RETURN_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApproveId(null)} disabled={loading}>Cancel</Button>
              <Button onClick={handleApproveReturn} disabled={loading}>
                {loading ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
