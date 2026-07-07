"use client"

import { useState } from "react"
import { Search } from "lucide-react"

export interface OrderOption {
  id: string
  order_number: string
  product_variant: string
}

interface OrderMultiSelectProps {
  orders: OrderOption[]
  value: string[]
  onChange: (ids: string[]) => void
}

/** Checklist of active customer orders a purchase order is being raised to procure for. */
export function OrderMultiSelect({ orders, value, onChange }: OrderMultiSelectProps) {
  const [query, setQuery] = useState("")

  const filtered = orders.filter((o) => {
    const q = query.toLowerCase()
    return !q || o.order_number.toLowerCase().includes(q) || o.product_variant.toLowerCase().includes(q)
  })

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="rounded-lg border border-input">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search orders…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No matching orders</p>
        ) : (
          filtered.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={value.includes(o.id)}
                onChange={() => toggle(o.id)}
              />
              <span className="font-medium">{o.order_number}</span>
              <span className="text-xs text-muted-foreground">{o.product_variant}</span>
            </label>
          ))
        )}
      </div>
      {value.length > 0 && (
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">{value.length} order{value.length === 1 ? "" : "s"} selected</p>
      )}
    </div>
  )
}
