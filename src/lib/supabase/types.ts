export type Profile = {
  id: string
  full_name: string
  role: "admin" | "production_manager" | "inventory_manager" | "qc_head" | "floor_supervisor" | "worker"
  department: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Buyer = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  gst_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  order_number: string
  buyer_id: string | null
  style_name: string
  description: string | null
  total_quantity: number
  deadline: string
  priority: "low" | "normal" | "high" | "urgent"
  status: "draft" | "confirmed" | "in_production" | "completed" | "dispatched" | "cancelled"
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrderWithBuyer = Order & {
  buyer: Pick<Buyer, "id" | "name" | "company"> | null
}

export type OrderItem = {
  id: string
  order_id: string
  size: string
  color: string
  quantity: number
  unit_price: number
  created_at: string
}

export type OrderDetail = Order & {
  buyer: Buyer | null
  order_items: OrderItem[]
}

export type OrderMaterial = {
  id: string
  order_id: string
  material_id: string | null
  quantity_required: number
  quantity_allocated: number
  unit: string
  created_at: string
}
