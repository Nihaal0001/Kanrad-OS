import {
  LayoutDashboard,
  Grid2x2,
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
  Receipt,
  BarChart3,
  IndianRupee,
  ArrowLeftRight,
  BookOpen,
  Scale,
  History,
  UserCircle,
  Truck,
  Undo2,
  Landmark,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  badge?: number
  permission?: string
}

export type NavSection = {
  id: string
  title: string
  icon: LucideIcon
  items: NavItem[]
}

export type MobilePrimaryTab = {
  id: "home" | "production" | "finance" | "more"
  title: string
  href: string
  icon: LucideIcon
}

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getActiveNavItem(
  pathname: string,
  items: NavItem[]
) {
  return items
    .filter((item) => isNavItemActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0] ?? null
}

export function isNavSectionActive(pathname: string, section: NavSection) {
  return getActiveNavItem(pathname, section.items) !== null
}

export function filterNavigationByPermissions(allowedPermissions?: string[]) {
  const allowed = new Set(allowedPermissions ?? [])

  return navigation
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || allowed.has(item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0)
}

export const navigation: NavSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard" },
      { title: "Notifications", href: "/notifications", icon: Bell, permission: "notifications" },
    ],
  },
  {
    id: "sales",
    title: "Sales",
    icon: FileText,
    items: [
      { title: "Orders", href: "/orders", icon: ShoppingBag, permission: "orders" },
      { title: "Customers", href: "/customers", icon: UserCircle, permission: "orders" },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    icon: Factory,
    items: [
      { title: "Suppliers", href: "/suppliers", icon: Truck, permission: "inventory" },
      { title: "Inventory", href: "/inventory", icon: Package, permission: "inventory" },
      { title: "Purchase Orders", href: "/inventory/purchase-orders", icon: ShoppingCart, permission: "inventory" },
      { title: "PO Approvals", href: "/inventory/approvals", icon: ClipboardCheck, permission: "inventory" },
      { title: "Production", href: "/production", icon: Factory, permission: "production" },
      { title: "Tasks", href: "/tasks", icon: ListTodo, permission: "tasks" },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    icon: IndianRupee,
    items: [
      { title: "Overview", href: "/finance", icon: IndianRupee, permission: "finance" },
      { title: "Sales", href: "/finance/invoices", icon: FileText, permission: "finance" },
      { title: "Purchases", href: "/finance/purchases", icon: Receipt, permission: "finance" },
      { title: "Expenses", href: "/finance/expenses", icon: Wallet, permission: "finance" },
      { title: "Payments", href: "/finance/payments", icon: CreditCard, permission: "finance" },
      { title: "Cash Flow", href: "/finance/cash-flow", icon: ArrowLeftRight, permission: "finance" },
      { title: "Costing", href: "/finance/costing", icon: Calculator, permission: "finance" },
      { title: "Reports", href: "/finance/reports", icon: BarChart3, permission: "finance" },
      { title: "Credit Notes", href: "/finance/credit-notes", icon: Undo2, permission: "finance" },
      { title: "Reconciliation", href: "/finance/bank-recon", icon: Landmark, permission: "finance" },
      { title: "Journal", href: "/finance/journal", icon: BookOpen, permission: "finance" },
      { title: "Ledger", href: "/finance/ledger", icon: Scale, permission: "finance" },
      { title: "Trial Balance", href: "/finance/trial-balance", icon: BarChart3, permission: "finance" },
    ],
  },
  {
    id: "people",
    title: "People",
    icon: Users,
    items: [
      { title: "Overview", href: "/hr", icon: Users, permission: "hr" },
      { title: "Attendance", href: "/hr/attendance", icon: Clock, permission: "hr" },
      { title: "QR Kiosk", href: "/kiosk", icon: QrCode, permission: "hr" },
      { title: "Scan QR", href: "/scan", icon: ScanLine },
      { title: "Leaves", href: "/hr/leaves", icon: CalendarDays, permission: "hr" },
      { title: "Payroll", href: "/hr/payroll", icon: CheckCircle, permission: "hr" },
      { title: "Shifts", href: "/hr/shifts", icon: RefreshCcw, permission: "hr" },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    icon: Settings,
    items: [
      { title: "Audit Log", href: "/audit", icon: History, permission: "settings" },
      { title: "Users", href: "/users", icon: Users, permission: "users" },
      { title: "Settings", href: "/settings", icon: Settings, permission: "settings" },
    ],
  },
]

export const mobilePrimaryTabs: MobilePrimaryTab[] = [
  { id: "home", title: "Home", href: "/", icon: LayoutDashboard },
  { id: "production", title: "Production", href: "/production", icon: Factory },
  { id: "finance", title: "Finance", href: "/finance", icon: IndianRupee },
  { id: "more", title: "More", href: "/more", icon: Grid2x2 },
]

export function getActiveMobileTab(pathname: string) {
  if (pathname === "/") return "home"
  if (pathname === "/production" || pathname.startsWith("/production/")) return "production"
  if (pathname === "/finance" || pathname.startsWith("/finance/")) return "finance"

  return "more"
}

export function getMobileMoreSections(allowedPermissions?: string[]) {
  const primaryTabHrefs = new Set(["/", "/production", "/finance"])

  return filterNavigationByPermissions(allowedPermissions)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !primaryTabHrefs.has(item.href)),
    }))
    .filter((section) => section.items.length > 0)
}

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
