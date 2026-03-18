"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const ENTITY_TYPES = [
  { value: "order", label: "Orders" },
  { value: "invoice", label: "Invoices" },
  { value: "payment", label: "Payments" },
  { value: "material", label: "Materials" },
  { value: "purchase_order", label: "Purchase Orders" },
  { value: "expense", label: "Expenses" },
  { value: "purchase_invoice", label: "Purchase Invoices" },
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leaves" },
  { value: "payroll", label: "Payroll" },
]

const ACTIONS = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "status_changed", label: "Status Changed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

export function AuditFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== "all") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/audit?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasFilters = searchParams.size > 0

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Select
        value={searchParams.get("entityType") ?? "all"}
        onValueChange={(v) => update("entityType", v)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All modules" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All modules</SelectItem>
          {ENTITY_TYPES.map((e) => (
            <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("action") ?? "all"}
        onValueChange={(v) => update("action", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All actions</SelectItem>
          {ACTIONS.map((a) => (
            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2 items-center">
        <Input
          type="date"
          className="w-36"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value || undefined)}
          placeholder="From"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <Input
          type="date"
          className="w-36"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value || undefined)}
          placeholder="To"
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/audit")}
        >
          Clear
        </Button>
      )}
    </div>
  )
}
