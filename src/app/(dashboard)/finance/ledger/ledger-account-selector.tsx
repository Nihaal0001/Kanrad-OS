"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { ChartOfAccount } from "@/lib/supabase/types"

const TYPE_GROUP_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  cogs: "Cost of Goods Sold",
  expense: "Expenses",
}

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "cogs", "expense"]

export function LedgerAccountSelector({
  accounts,
  selectedCode,
}: {
  accounts: ChartOfAccount[]
  selectedCode: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/finance/ledger?${params.toString()}`)
    },
    [router, searchParams]
  )

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_GROUP_LABELS[type],
    items: accounts.filter((a) => a.type === type),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Select
        value={searchParams.get("account") ?? selectedCode}
        onValueChange={(v) => update("account", v)}
      >
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {grouped.map((group) => (
            <SelectGroup key={group.type}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.items.map((acc) => (
                <SelectItem key={acc.account_code} value={acc.account_code}>
                  <span className="font-mono text-muted-foreground">{acc.account_code}</span>
                  <span className="ml-2">{acc.name}</span>
                </SelectItem>
              ))}
            </SelectGroup>
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

      {(searchParams.get("from") || searchParams.get("to")) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("from")
            params.delete("to")
            router.push(`/finance/ledger?${params.toString()}`)
          }}
        >
          Clear dates
        </Button>
      )}
    </div>
  )
}
