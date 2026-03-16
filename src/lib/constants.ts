import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Factory,
  CheckCircle,
  ListTodo,
  FileText,
  Calculator,
  CreditCard,
  Clock,
  CalendarDays,
  Wallet,
  RefreshCcw,
  Bell,
  Settings,
  Users,
  QrCode,
  ScanLine,
  ClipboardCheck,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  badge?: number
  permission?: string
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    label: "",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard" },
      { title: "Orders", href: "/orders", icon: ShoppingBag, permission: "orders" },
      { title: "Inventory", href: "/inventory", icon: Package, permission: "inventory" },
      { title: "Purchase Orders", href: "/inventory/purchase-orders", icon: ShoppingCart, permission: "inventory" },
      { title: "PO Approvals", href: "/inventory/approvals", icon: ClipboardCheck, permission: "inventory" },
      { title: "Production", href: "/production", icon: Factory, permission: "production" },
      { title: "Tasks", href: "/tasks", icon: ListTodo, permission: "tasks" },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Invoices", href: "/finance/invoices", icon: FileText, permission: "finance" },
      { title: "Costing", href: "/finance/costing", icon: Calculator, permission: "finance" },
      { title: "Payments", href: "/finance/payments", icon: CreditCard, permission: "finance" },
    ],
  },
  {
    label: "HR",
    items: [
      { title: "Attendance", href: "/hr/attendance", icon: Clock, permission: "hr" },
      { title: "QR Kiosk", href: "/kiosk", icon: QrCode, permission: "hr" },
      { title: "Scan QR", href: "/scan", icon: ScanLine },
      { title: "Leaves", href: "/hr/leaves", icon: CalendarDays, permission: "hr" },
      { title: "Payroll", href: "/hr/payroll", icon: Wallet, permission: "hr" },
      { title: "Shifts", href: "/hr/shifts", icon: RefreshCcw, permission: "hr" },
    ],
  },
  {
    label: "",
    items: [
      { title: "Notifications", href: "/notifications", icon: Bell, permission: "notifications" },
      { title: "Users", href: "/users", icon: Users, permission: "users" },
      { title: "Settings", href: "/settings", icon: Settings, permission: "settings" },
    ],
  },
]

export const productionStages = [
  "Fabric Sourcing",
  "Cutting",
  "Stitching",
  "Quality Check",
  "Finishing",
  "Packing",
  "Dispatch",
] as const

export type ProductionStage = (typeof productionStages)[number]

export const orderStatuses = [
  "draft",
  "confirmed",
  "in_production",
  "completed",
  "dispatched",
  "cancelled",
] as const

export type OrderStatus = (typeof orderStatuses)[number]

export const taskStatuses = ["todo", "in_progress", "done", "cancelled"] as const
export type TaskStatus = (typeof taskStatuses)[number]

export const priorities = ["low", "normal", "high", "urgent"] as const
export type Priority = (typeof priorities)[number]

export const userRoles = [
  "admin",
  "production_manager",
  "inventory_manager",
  "qc_head",
  "floor_supervisor",
  "worker",
] as const

export type UserRole = (typeof userRoles)[number]
