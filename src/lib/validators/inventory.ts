import { z } from "zod"

export const materialSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  category_id: z.string().optional().or(z.literal("")),
  unit: z.string().min(1, "Unit is required"),
  min_stock_level: z.number().min(0, "Cannot be negative"),
  cost_per_unit: z.number().min(0, "Cannot be negative"),
  supplier_name: z.string().max(200).optional().or(z.literal("")),
  supplier_contact: z.string().max(200).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  // Aluminium circle fields — only set when is_circle is true
  is_circle: z.boolean().optional(),
  diameter_mm: z.number().positive("Diameter must be greater than 0").nullable().optional(),
  thickness_mm: z.number().positive("Thickness must be greater than 0").nullable().optional(),
  circle_type: z.enum(["ib", "non_ib"]).nullable().optional(),
})

export type MaterialFormData = z.infer<typeof materialSchema>

export const stockAdjustmentSchema = z.object({
  material_id: z.string().min(1, "Material is required"),
  type: z.enum(["purchase_in", "production_out", "adjustment", "return"]),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>

export const purchaseOrderSchema = z.object({
  supplier_name: z.string().min(1, "Supplier name is required").max(200),
  supplier_contact: z.string().max(200).optional().or(z.literal("")),
  order_date: z.string().min(1, "Order date is required"),
  expected_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  order_ids: z.array(z.string()).min(1, "Select at least one order this purchase order is for"),
  items: z
    .array(
      z.object({
        material_id: z.string().min(1, "Material is required"),
        quantity_ordered: z.number().min(0.01, "Quantity must be greater than 0"),
        unit_price: z.number().min(0, "Price cannot be negative"),
      })
    )
    .min(1, "At least one item is required"),
})

export type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>
