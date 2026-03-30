"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CostCalculatorClient({ bomCost }: { bomCost: number }) {
  const [qty, setQty] = useState(100)

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="calc-qty" className="text-xs">Order Quantity</Label>
        <Input
          id="calc-qty"
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 0)}
          className="h-8"
        />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Material Cost</span>
        <span className="font-semibold tabular-nums">₹{formatCurrency(bomCost * qty)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        = ₹{formatCurrency(bomCost)} × {qty.toLocaleString("en-IN")} units
      </p>
    </div>
  )
}
