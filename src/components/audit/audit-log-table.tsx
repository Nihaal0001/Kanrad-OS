"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { AuditLog } from "@/lib/supabase/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ACTION_COLORS: Record<string, string> = {
  created: "text-emerald-600 border-emerald-600/30",
  updated: "text-blue-600 border-blue-600/30",
  deleted: "text-red-600 border-red-600/30",
  status_changed: "text-amber-600 border-amber-600/30",
  approved: "text-emerald-600 border-emerald-600/30",
  rejected: "text-red-600 border-red-600/30",
}

const ENTITY_LABELS: Record<string, string> = {
  order: "Order",
  invoice: "Invoice",
  payment: "Payment",
  material: "Material",
  purchase_order: "Purchase Order",
  expense: "Expense",
  purchase_invoice: "Purchase Invoice",
  attendance: "Attendance",
  leave: "Leave",
  payroll: "Payroll",
}

function JsonPreview({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-muted-foreground text-xs">—</span>
  const entries = Object.entries(data).slice(0, 5)
  return (
    <div className="space-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <span className="text-muted-foreground shrink-0">{k}:</span>
          <span className="truncate max-w-[160px]">{String(v)}</span>
        </div>
      ))}
      {Object.keys(data).length > 5 && (
        <span className="text-muted-foreground">+{Object.keys(data).length - 5} more</span>
      )}
    </div>
  )
}

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const hasValues = log.old_values || log.new_values

  return (
    <>
      <TableRow className="group">
        <TableCell className="w-8 pr-0">
          {hasValues && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setExpanded((p) => !p)}
            >
              {expanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}
        </TableCell>
        <TableCell>
          <span className="text-xs font-medium">
            {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
          </span>
          {log.entity_label && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              {log.entity_label}
            </span>
          )}
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={`text-xs capitalize ${ACTION_COLORS[log.action] ?? ""}`}
          >
            {log.action.replace("_", " ")}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {log.changed_by_name ?? "—"}
        </TableCell>
      </TableRow>
      {expanded && hasValues && (
        <TableRow className="bg-muted/30">
          <TableCell />
          <TableCell colSpan={4}>
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              {log.old_values && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Before</p>
                  <JsonPreview data={log.old_values} />
                </div>
              )}
              {log.new_values && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">After</p>
                  <JsonPreview data={log.new_values} />
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

interface AuditLogTableProps {
  logs: AuditLog[]
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No audit entries found.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Audit logs are created automatically as you use the ERP.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-8" />
            <TableHead className="text-xs">Timestamp</TableHead>
            <TableHead className="text-xs">Entity</TableHead>
            <TableHead className="text-xs">Action</TableHead>
            <TableHead className="text-xs">By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <AuditRow key={log.id} log={log} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
