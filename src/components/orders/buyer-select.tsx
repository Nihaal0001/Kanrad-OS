"use client"

import { useState, useCallback } from "react"
import { Plus } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BuyerForm } from "@/components/orders/buyer-form"
import type { Buyer } from "@/lib/supabase/types"

interface BuyerSelectProps {
  value: string
  onChange: (value: string) => void
  buyers: Array<{ id: string; name: string; company: string | null }>
}

export function BuyerSelect({ value, onChange, buyers }: BuyerSelectProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [localBuyers, setLocalBuyers] = useState(buyers)

  const handleValueChange = useCallback(
    (val: string) => {
      if (val === "__add_new__") {
        setFormOpen(true)
        return
      }
      onChange(val)
    },
    [onChange]
  )

  const handleBuyerCreated = useCallback(
    (newBuyer?: Buyer) => {
      if (newBuyer) {
        setLocalBuyers((prev) => [
          { id: newBuyer.id, name: newBuyer.name, company: newBuyer.company },
          ...prev,
        ])
        onChange(newBuyer.id)
      }
    },
    [onChange]
  )

  return (
    <>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a buyer" />
        </SelectTrigger>
        <SelectContent>
          {localBuyers.map((buyer) => (
            <SelectItem key={buyer.id} value={buyer.id}>
              {buyer.name}
              {buyer.company ? ` (${buyer.company})` : ""}
            </SelectItem>
          ))}

          {localBuyers.length > 0 && <SelectSeparator />}

          <button
            type="button"
            className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(e) => {
              e.preventDefault()
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add Buyer
          </button>
        </SelectContent>
      </Select>

      <BuyerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleBuyerCreated}
      />
    </>
  )
}
