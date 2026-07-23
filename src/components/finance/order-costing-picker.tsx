"use client"

import { useRouter } from "next/navigation"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface CostableOrder {
  id: string
  order_number: string
  product_variant: string | null
  customer_name: string | null
  hasCosting: boolean
}

export function OrderCostingPicker({ orders }: { orders: CostableOrder[] }) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Select Order</CardTitle>
        <CardDescription>
          Choose an order to cost it. Material prices come from Master Inventory (or this order&apos;s own PO price, where one exists).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={(id) => router.push(`/finance/costing/${id}`)}>
          <SelectTrigger className="h-11 text-base">
            <SelectValue placeholder="Select an order…" />
          </SelectTrigger>
          <SelectContent>
            {orders.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="font-medium">{o.order_number}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {o.product_variant}
                  {o.customer_name && ` · ${o.customer_name}`}
                </span>
                {!o.hasCosting && (
                  <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-600 text-[10px]">
                    Not Costed
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
