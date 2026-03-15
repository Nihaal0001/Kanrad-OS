"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2, Search } from "lucide-react"

import { cn, formatDate, friendlyError } from "@/lib/utils"
import { deleteQualityCheck } from "@/actions/production"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-amber-100 text-amber-800 border-amber-200",
  major: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
}

interface QCRow {
  id: string
  order_id: string
  quantity_inspected: number
  quantity_passed: number
  quantity_failed: number
  defect_type: string | null
  severity: string | null
  notes: string | null
  checked_at: string
  order: { id: string; order_number: string; style_name: string } | null
  stage: { id: string; name: string } | null
}

interface QualityChecksTableProps {
  checks: QCRow[]
}

const SEVERITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "critical", label: "Critical" },
] as const

export function QualityChecksTable({ checks }: QualityChecksTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let result = checks
    if (severityFilter !== "all") {
      result = result.filter((c) => c.severity === severityFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.order?.order_number.toLowerCase().includes(q) ||
          c.order?.style_name.toLowerCase().includes(q)
      )
    }
    return result
  }, [checks, severityFilter, search])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      const result = await deleteQualityCheck(id)
      setDeletingId(null)
      setConfirmId(null)

      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }

      toast.success("QC record deleted")
      router.refresh()
    },
    [router]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {SEVERITY_FILTERS.map((sf) => (
          <Button
            key={sf.value}
            variant={severityFilter === sf.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSeverityFilter(sf.value)}
            className={cn(
              "h-8 text-xs",
              severityFilter === sf.value && "font-semibold"
            )}
          >
            {sf.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No QC records found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Inspected</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Pass Rate</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((check) => {
                const passRate =
                  check.quantity_inspected > 0
                    ? Math.round(
                        (check.quantity_passed / check.quantity_inspected) * 100
                      )
                    : 0

                return (
                  <TableRow key={check.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/production/${check.order_id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {check.order?.order_number ?? "—"}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {check.order?.style_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {check.stage?.name ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(check.checked_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {check.quantity_inspected}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {check.quantity_passed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {check.quantity_failed}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          passRate >= 95
                            ? "text-emerald-600"
                            : passRate >= 80
                            ? "text-amber-600"
                            : "text-destructive"
                        )}
                      >
                        {passRate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {check.severity ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            SEVERITY_COLORS[check.severity]
                          )}
                        >
                          {check.severity}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === check.id}
                        onClick={() => setConfirmId(check.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => { if (!open) setConfirmId(null) }}
        title="Delete QC Record"
        description="Are you sure you want to delete this quality check record?"
        confirmLabel="Delete"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        loading={deletingId !== null}
      />
    </div>
  )
}
