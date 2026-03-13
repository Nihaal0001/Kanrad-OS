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
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  badge?: number
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    label: "",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Orders", href: "/orders", icon: ShoppingBag },
      { title: "Inventory", href: "/inventory", icon: Package },
      { title: "Production", href: "/production", icon: Factory },
      { title: "Quality", href: "/quality", icon: CheckCircle },
      { title: "Tasks", href: "/tasks", icon: ListTodo },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Invoices", href: "/finance/invoices", icon: FileText },
      { title: "Costing", href: "/finance/costing", icon: Calculator },
      { title: "Payments", href: "/finance/payments", icon: CreditCard },
    ],
  },
  {
    label: "HR",
    items: [
      { title: "Attendance", href: "/hr/attendance", icon: Clock },
      { title: "Leaves", href: "/hr/leaves", icon: CalendarDays },
      { title: "Payroll", href: "/hr/payroll", icon: Wallet },
      { title: "Shifts", href: "/hr/shifts", icon: RefreshCcw },
    ],
  },
  {
    label: "",
    items: [
      { title: "Notifications", href: "/notifications", icon: Bell },
      { title: "Settings", href: "/settings", icon: Settings },
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
