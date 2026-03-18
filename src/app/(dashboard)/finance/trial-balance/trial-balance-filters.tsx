"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function TrialBalanceFilters() {
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
      router.push(`/finance/trial-balance?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasFilters = searchParams.get("from") || searchParams.get("to")

  return (
    <div className="flex flex-wrap gap-3 items-center">
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
        <Button variant="ghost" size="sm" onClick={() => router.push("/finance/trial-balance")}>
          Clear
        </Button>
      )}
    </div>
  )
}
