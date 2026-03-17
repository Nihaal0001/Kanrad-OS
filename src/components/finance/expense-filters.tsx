"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"

interface Category {
  id: string
  name: string
}

interface ExpenseFiltersProps {
  categories: Category[]
  currentCategory?: string
  currentFrom?: string
  currentTo?: string
}

export function ExpenseFilters({
  categories,
  currentCategory,
  currentFrom,
  currentTo,
}: ExpenseFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [category, setCategory] = useState(currentCategory ?? "")
  const [from, setFrom] = useState(currentFrom ?? "")
  const [to, setTo] = useState(currentTo ?? "")

  const hasFilters = category || from || to

  function applyFilters() {
    const params = new URLSearchParams()
    if (category) params.set("category", category)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function clearFilters() {
    setCategory("")
    setFrom("")
    setTo("")
    router.push(pathname)
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="w-[170px]">
        <DatePicker value={from || undefined} onChange={setFrom} placeholder="From date" />
      </div>
      <div className="w-[170px]">
        <DatePicker value={to || undefined} onChange={setTo} placeholder="To date" />
      </div>

      <Button variant="outline" size="sm" onClick={applyFilters}>
        Filter
      </Button>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear
        </Button>
      )}
    </div>
  )
}
