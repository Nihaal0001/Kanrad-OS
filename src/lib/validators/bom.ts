import { z } from "zod"

export const bomItemSchema = z.object({
  material_id: z.string().min(1, "Material is required"),
  qty_required: z.number().positive("Quantity must be > 0"),
  unit: z.string().min(1, "Unit is required"),
  wastage_pct: z.number().min(0).max(100),
  notes: z.string().max(500).optional().or(z.literal("")),
})

export const bomSchema = z.object({
  product_sku: z.string().min(1, "Product SKU is required").max(50),
  product_name: z.string().min(1, "Product name is required").max(200),
  category: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(bomItemSchema).min(1, "At least one material is required"),
})

export type BomFormData = z.infer<typeof bomSchema>
export type BomItemFormData = z.infer<typeof bomItemSchema>
