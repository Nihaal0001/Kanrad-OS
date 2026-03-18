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

const REF_TYPES = [
  { value: "invoice", label: "Sales Invoices" },
  { value: "payment", label: "Payments Received" },
  { value: "expense", label: "Expenses" },
  { value: "purchase_invoice", label: "Purchase Invoices" },
  { value: "purchase_payment", label: "Purchase Payments" },
  { value: "manual", label: "Manual" },
]

export function JournalFilters() {
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
      router.push(`/finance/journal?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasFilters = searchParams.size > 0

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Input
        placeholder="Search description..."
        className="w-56"
        defaultValue={searchParams.get("search") ?? ""}
        onBlur={(e) => update("search", e.target.value || undefined)}
        onKeyDown={(e) => {
          if (e.key === "Enter") update("search", (e.target as HTMLInputElement).value || undefined)
        }}
      />

      <Select
        value={searchParams.get("referenceType") ?? "all"}
        onValueChange={(v) => update("referenceType", v)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {REF_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2 items-center">
        <Input
          type="date"
          className="w-36"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value || undefined)}
        />
        <span className="text-muted-foreground text-sm">to</span>
        <Input
          type="date"
          className="w-36"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value || undefined)}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/finance/journal")}>
          Clear
        </Button>
      )}
    </div>
  )
}
