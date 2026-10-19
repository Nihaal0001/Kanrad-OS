import { z } from "zod"

export const warehouseSkuDispatchSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  item_name: z.string().min(1, "Item name is required"),
  brand: z.string().min(1, "Brand is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  // Only required when the dispatch actually consumes order-linked stock —
  // that's the only case an invoice gets created, and it's only known once
  // the action computes the FIFO consumption plan (dispatch can span several
  // orders, or none, for unlinked/manual stock).
  bill_no: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  // Client-generated per-submission id. The action inserts it into
  // warehouse_dispatch_requests before touching stock, so a duplicate
  // submission (double-click, retry) is a no-op instead of double-dispatching.
  request_id: z.string().uuid(),
})

export type WarehouseSkuDispatchFormData = z.infer<typeof warehouseSkuDispatchSchema>
