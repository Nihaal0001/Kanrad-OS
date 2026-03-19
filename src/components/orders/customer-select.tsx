"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CustomerForm } from "@/components/orders/customer-form"
import type { Customer } from "@/lib/supabase/types"

interface CustomerSelectProps {
  value: string
  onChange: (value: string) => void
  customers: Array<{ id: string; name: string; company: string | null }>
  placeholder?: string
  addLabel?: string
  addHref?: string | null
}

export function CustomerSelect({
  value,
  onChange,
  customers,
  placeholder = "Select a customer",
  addLabel = "Add Customer",
  addHref = null,
}: CustomerSelectProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [localCustomers, setLocalCustomers] = useState(customers)

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

  const handleCustomerCreated = useCallback(
    (newCustomer?: Customer) => {
      if (newCustomer) {
        setLocalCustomers((prev) => [
          { id: newCustomer.id, name: newCustomer.name, company: newCustomer.company },
          ...prev,
        ])
        onChange(newCustomer.id)
      }
    },
    [onChange]
  )

  return (
    <>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {localCustomers.map((customer) => (
            <SelectItem key={customer.id} value={customer.id}>
              {customer.name}
              {customer.company ? ` (${customer.company})` : ""}
            </SelectItem>
          ))}

          {localCustomers.length > 0 && <SelectSeparator />}

          {addHref ? (
            <Link
              href={addHref}
              className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-4 w-4" />
              {addLabel}
            </Link>
          ) : (
            <button
              type="button"
              className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              {addLabel}
            </button>
          )}
        </SelectContent>
      </Select>

      {!addHref && (
        <CustomerForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleCustomerCreated}
        />
      )}
    </>
  )
}
