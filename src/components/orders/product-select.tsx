"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"

export interface ProductOption {
  id: string
  name: string
  sku: string
}

interface ProductSelectProps {
  value: string
  onChange: (productName: string) => void
  products: ProductOption[]
  placeholder?: string
}

export function ProductSelect({ value, onChange, products, placeholder = "Select product…" }: ProductSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = products.find((p) => p.name === value)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen(true)}
      >
        {selected ? (
          <span className="truncate">
            {selected.name}
            <span className="ml-2 text-xs text-muted-foreground font-mono">{selected.sku}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">Select a product</DialogTitle>
          </DialogHeader>
          <Command
            className="rounded-none"
            filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput placeholder="Type product code or name…" />
            <CommandList className="max-h-[min(60vh,26rem)]">
              <CommandEmpty>No product found.</CommandEmpty>
              <CommandGroup>
                {products.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.sku} ${p.name}`}
                    className="cursor-pointer gap-3 px-3 py-3 text-[15px]"
                    onSelect={() => {
                      onChange(p.name)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("h-4 w-4 shrink-0", value === p.name ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
