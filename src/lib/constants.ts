import {
  LayoutDashboard,
  Grid2x2,
  ShoppingBag,
  Package,
  Factory,
  CheckCircle,
  Calculator,
  CreditCard,
  Clock,
  CalendarDays,
  RefreshCcw,
  Bell,
  Settings,
  Users,
  ClipboardCheck,
  ShoppingCart,
  IndianRupee,
  History,
  Truck,
  Warehouse,
  XCircle,
  AlertTriangle,
  Archive,
  Send,
  TrendingUp,
  CalendarRange,
  Newspaper,
  Scale,
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

export function getActiveNavItem(pathname: string, items: NavItem[]) {
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

// Flat ordered list for mobile nav — exact order from user's list
export const flatNavItems: NavItem[] = [
  { title: "Dashboard",        href: "/",                          icon: LayoutDashboard, permission: "dashboard" },
  { title: "Master Inventory", href: "/master-inventory",          icon: Package,         permission: "inventory" },
  { title: "Purchase Orders",  href: "/inventory/purchase-orders", icon: ShoppingCart,    permission: "inventory" },
  { title: "Inventory",        href: "/inventory",                 icon: Archive,         permission: "inventory" },
  { title: "Orders",           href: "/orders",                    icon: ShoppingBag,     permission: "orders" },
  { title: "Production",       href: "/production",                icon: Factory,         permission: "production" },
  { title: "Warehouse",        href: "/warehouse",                 icon: Warehouse,       permission: "inventory" },
  { title: "BOM",              href: "/products",                  icon: Grid2x2,         permission: "inventory" },
  { title: "Approvals",        href: "/inventory/approvals",       icon: ClipboardCheck,  permission: "inventory" },
  { title: "Costing",          href: "/finance/costing",           icon: Calculator,      permission: "finance" },
  { title: "Logistics",        href: "/logistics",                 icon: Truck,           permission: "orders" },
  { title: "Finance",          href: "/finance",                   icon: IndianRupee,     permission: "finance" },
  { title: "Outstanding",      href: "/finance/outstanding",       icon: Scale,           permission: "finance" },
  { title: "Tally Sync",       href: "/finance/tally",             icon: RefreshCcw,      permission: "finance" },
  { title: "Rejections",       href: "/rejections",                icon: XCircle,         permission: "production" },
  { title: "History",          href: "/history",                   icon: History,         permission: "settings" },
  { title: "Reach Out",        href: "/reach-out",                 icon: Send,            permission: "settings" },
  { title: "Issues",           href: "/issues",                    icon: AlertTriangle,   permission: "settings" },
  { title: "Users",            href: "/users",                     icon: Users,           permission: "users" },
  { title: "Notifications",    href: "/notifications",             icon: Bell,            permission: "notifications" },
  { title: "Attendance",       href: "/hr/attendance",             icon: Clock,           permission: "hr" },
  { title: "Leaves",           href: "/hr/leaves",                 icon: CalendarDays,    permission: "hr" },
  { title: "Payroll",          href: "/hr/payroll",                icon: CheckCircle,     permission: "hr" },
  { title: "Settings",         href: "/settings",                  icon: Settings,        permission: "settings" },
]

export function getFilteredFlatNavItems(allowedPermissions?: string[]) {
  const allowed = new Set(allowedPermissions ?? [])
  return flatNavItems.filter((item) => !item.permission || allowed.has(item.permission))
}

// Desktop sidebar — grouped sections
export const navigation: NavSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard",     href: "/",              icon: LayoutDashboard, permission: "dashboard" },
      { title: "Notifications", href: "/notifications", icon: Bell,            permission: "notifications" },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    icon: Factory,
    items: [
      { title: "Orders",           href: "/orders",                    icon: ShoppingBag,  permission: "orders" },
      { title: "Production",       href: "/production",                icon: Factory,      permission: "production" },
      { title: "Logistics",        href: "/logistics",                 icon: Truck,        permission: "orders" },
      { title: "Rejections",       href: "/rejections",                icon: XCircle,      permission: "production" },
      { title: "Master Inventory", href: "/master-inventory",          icon: Package,      permission: "inventory" },
      { title: "Inventory",        href: "/inventory",                 icon: Archive,      permission: "inventory" },
      { title: "Purchase Orders",  href: "/inventory/purchase-orders", icon: ShoppingCart, permission: "inventory" },
      { title: "Approvals",        href: "/inventory/approvals",       icon: ClipboardCheck, permission: "inventory" },
      { title: "Warehouse",        href: "/warehouse",                 icon: Warehouse,    permission: "inventory" },
      { title: "BOM",              href: "/products",                  icon: Grid2x2,      permission: "inventory" },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    icon: IndianRupee,
    items: [
      { title: "Finance",     href: "/finance",             icon: IndianRupee, permission: "finance" },
      { title: "Costing",     href: "/finance/costing",     icon: Calculator,  permission: "finance" },
      { title: "Outstanding", href: "/finance/outstanding", icon: Scale,       permission: "finance" },
      { title: "Tally Sync",  href: "/finance/tally",       icon: RefreshCcw,  permission: "finance" },
    ],
  },
  {
    id: "people",
    title: "People",
    icon: Users,
    items: [
      { title: "Attendance", href: "/hr/attendance", icon: Clock,        permission: "hr" },
      { title: "Leaves",     href: "/hr/leaves",      icon: CalendarDays, permission: "hr" },
      { title: "Payroll",    href: "/hr/payroll",     icon: CheckCircle,  permission: "hr" },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: TrendingUp,
    items: [
      { title: "Market Intel",  href: "/market-intel",  icon: Newspaper,    permission: "dashboard" },
      { title: "Schedule",      href: "/schedule",      icon: CalendarRange, permission: "dashboard" },
      { title: "Forecasting",   href: "/forecasting",   icon: TrendingUp,   permission: "dashboard" },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    icon: Settings,
    items: [
      { title: "History",   href: "/history",   icon: History,       permission: "settings" },
      { title: "Reach Out", href: "/reach-out", icon: Send,          permission: "settings" },
      { title: "Issues",    href: "/issues",     icon: AlertTriangle, permission: "settings" },
      { title: "Users",     href: "/users",      icon: Users,         permission: "users" },
      { title: "Settings",  href: "/settings",   icon: Settings,      permission: "settings" },
    ],
  },
]

export const mobilePrimaryTabs: MobilePrimaryTab[] = [
  { id: "home",       title: "Home",       href: "/",           icon: LayoutDashboard },
  { id: "production", title: "Production", href: "/production", icon: Factory },
  { id: "finance",    title: "Finance",    href: "/finance",    icon: IndianRupee },
  { id: "more",       title: "More",       href: "/more",       icon: Grid2x2 },
]

export function getActiveMobileTab(pathname: string) {
  if (pathname === "/") return "home"
  if (pathname === "/production" || pathname.startsWith("/production/")) return "production"
  if (pathname === "/finance" || pathname.startsWith("/finance/")) return "finance"
  return "more"
}

export const productionStages = [
  "Raw Material Receipt",
  "Cutting / Pressing",
  "Forming / Shaping",
  "Assembly / Welding",
  "Surface Treatment",
  "Quality Check",
  "Packing",
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
