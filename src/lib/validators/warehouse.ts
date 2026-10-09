import { z } from "zod"

export const warehouseSkuDispatchSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  item_name: z.string().min(1, "Item name is required"),
  brand: z.string().min(1, "Brand is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  bill_no: z.string().min(1, "Invoice number is required").max(100),
  notes: z.string().max(1000).optional().or(z.literal("")),
  // Which order's warehouse stock to dispatch from — null for unlinked/manual
  // stock. Required so a dispatch is always explicitly attributed.
  order_id: z.string().nullable(),
  // Client-generated per-submission id. The action inserts it into
  // warehouse_dispatch_requests before touching stock, so a duplicate
  // submission (double-click, retry) is a no-op instead of double-dispatching.
  request_id: z.string().uuid(),
})

export type WarehouseSkuDispatchFormData = z.infer<typeof warehouseSkuDispatchSchema>
