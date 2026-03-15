export type Profile = {
  id: string
  auth_id: string | null
  full_name: string
  email: string | null
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

// ==================== Inventory ====================

export type MaterialCategory = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type Material = {
  id: string
  sku: string
  name: string
  category_id: string | null
  unit: string
  current_stock: number
  min_stock_level: number
  cost_per_unit: number
  supplier_name: string | null
  supplier_contact: string | null
  location: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MaterialWithCategory = Material & {
  category: MaterialCategory | null
}

export type StockTransaction = {
  id: string
  material_id: string
  type: "purchase_in" | "production_out" | "adjustment" | "return"
  quantity: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type StockTransactionWithMaterial = StockTransaction & {
  material: Pick<Material, "id" | "name" | "sku" | "unit"> | null
}

export type PurchaseOrder = {
  id: string
  po_number: string
  supplier_name: string
  supplier_contact: string | null
  status: "draft" | "sent" | "partial" | "received" | "cancelled"
  order_date: string
  expected_date: string | null
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type PurchaseOrderItem = {
  id: string
  purchase_order_id: string
  material_id: string
  quantity_ordered: number
  quantity_received: number
  unit_price: number
  created_at: string
}

export type PurchaseOrderItemWithMaterial = PurchaseOrderItem & {
  material: Pick<Material, "id" | "name" | "sku" | "unit"> | null
}

export type PurchaseOrderDetail = PurchaseOrder & {
  items: PurchaseOrderItemWithMaterial[]
}

// ==================== Production & Quality ====================

export type ProductionStage = {
  id: string
  name: string
  sequence: number
  description: string | null
  created_at: string
}

export type ProductionTracking = {
  id: string
  order_id: string
  stage_id: string
  status: "pending" | "in_progress" | "completed" | "blocked"
  quantity_completed: number
  quantity_rejected: number
  assigned_to: string | null
  notes: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ProductionTrackingWithStage = ProductionTracking & {
  stage: ProductionStage
}

export type ProductionTrackingWithOrder = ProductionTracking & {
  stage: ProductionStage
  order: Pick<Order, "id" | "order_number" | "style_name" | "total_quantity" | "status">
}

export type OrderWithProduction = Order & {
  buyer: Pick<Buyer, "id" | "name" | "company"> | null
  production_tracking: ProductionTrackingWithStage[]
}

export type QualityCheck = {
  id: string
  order_id: string
  stage_id: string | null
  inspected_by: string | null
  quantity_inspected: number
  quantity_passed: number
  quantity_failed: number
  defect_type: string | null
  severity: "minor" | "major" | "critical" | null
  notes: string | null
  checked_at: string
  created_at: string
}

export type QualityCheckWithDetails = QualityCheck & {
  order: Pick<Order, "id" | "order_number" | "style_name"> | null
  stage: Pick<ProductionStage, "id" | "name"> | null
}

// ==================== Tasks ====================

export type Task = {
  id: string
  title: string
  description: string | null
  order_id: string | null
  stage_id: string | null
  assigned_to: string | null
  priority: "low" | "normal" | "high" | "urgent"
  status: "todo" | "in_progress" | "done" | "cancelled"
  due_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TaskWithDetails = Task & {
  order: Pick<Order, "id" | "order_number" | "style_name"> | null
  stage: Pick<ProductionStage, "id" | "name"> | null
}

// ==================== Notifications ====================

export type Notification = {
  id: string
  type: string
  title: string
  message: string
  reference_type: string | null
  reference_id: string | null
  is_read: boolean
  created_at: string
}

// ==================== Finance ====================

export type Invoice = {
  id: string
  invoice_number: string
  order_id: string | null
  buyer_id: string | null
  buyer_name: string
  buyer_address: string | null
  buyer_gst: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  status: "draft" | "sent" | "paid" | "partially_paid" | "cancelled"
  issue_date: string
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type InvoiceItem = {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  created_at: string
}

export type InvoiceDetail = Invoice & {
  order: Pick<Order, "id" | "order_number" | "style_name"> | null
  invoice_items: InvoiceItem[]
}

export type Payment = {
  id: string
  invoice_id: string
  amount: number
  method: "cash" | "bank_transfer" | "cheque" | "upi" | "other"
  reference: string | null
  payment_date: string
  notes: string | null
  created_at: string
}

export type PaymentWithInvoice = Payment & {
  invoice: Pick<Invoice, "id" | "invoice_number" | "buyer_name" | "total_amount"> | null
}

export type OrderCosting = {
  id: string
  order_id: string
  material_cost: number
  labor_cost: number
  overhead_cost: number
  other_cost: number
  total_cost: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrderCostingWithOrder = OrderCosting & {
  order: Pick<Order, "id" | "order_number" | "style_name" | "total_quantity"> | null
}

// ==================== HR ====================

export type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type WorkerShift = {
  id: string
  worker_id: string
  shift_id: string
  effective_from: string
  effective_to: string | null
  created_at: string
}

export type Attendance = {
  id: string
  worker_id: string
  date: string
  status: "present" | "absent" | "half_day" | "leave"
  check_in: string | null
  check_out: string | null
  overtime_hours: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type AttendanceWithWorker = Attendance & {
  worker: Pick<Profile, "id" | "full_name" | "department"> | null
}

export type Leave = {
  id: string
  worker_id: string
  leave_type: "sick" | "casual" | "earned" | "unpaid" | "other"
  from_date: string
  to_date: string
  days: number
  reason: string | null
  status: "pending" | "approved" | "rejected"
  approved_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export type LeaveWithWorker = Leave & {
  worker: Pick<Profile, "id" | "full_name" | "department"> | null
}

export type Payroll = {
  id: string
  worker_id: string
  period_start: string
  period_end: string
  working_days: number
  days_present: number
  overtime_hours: number
  daily_wage: number
  overtime_rate: number
  base_wage: number
  overtime_pay: number
  deductions: number
  bonus: number
  total_wage: number
  status: "draft" | "paid"
  notes: string | null
  created_at: string
  updated_at: string
}

export type PayrollWithWorker = Payroll & {
  worker: Pick<Profile, "id" | "full_name" | "department"> | null
}
