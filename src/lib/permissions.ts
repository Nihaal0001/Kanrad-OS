import type { UserRole } from "@/lib/constants"

export type Permission =
  | "dashboard" | "orders" | "inventory" | "production"
  | "tasks" | "finance" | "hr"
  | "notifications" | "settings" | "users" | "analytics"

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard", "orders", "inventory", "production",
  "tasks", "finance", "hr", "notifications", "settings", "users", "analytics",
]

export const MODULE_LABELS: Record<Permission, string> = {
  dashboard: "Dashboard",
  orders: "Orders & Customers",
  inventory: "Inventory",
  production: "Production",
  tasks: "Tasks",
  finance: "Finance",
  hr: "HR & Payroll",
  notifications: "Notifications",
  settings: "Settings",
  users: "User Management",
  analytics: "Analytics (Market Intel, Schedule, Forecasting)",
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  production_manager: "Production Manager",
  inventory_manager: "Inventory Manager",
  qc_head: "QC Head",
  floor_supervisor: "Floor Supervisor",
  worker: "Worker",
}

// Hardcoded fallback used only when the DB table doesn't exist yet
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ["dashboard","orders","inventory","production","tasks","finance","hr","notifications","settings","users","analytics"],
  production_manager: ["dashboard","orders","production","tasks","hr","notifications","settings","analytics"],
  inventory_manager: ["dashboard","orders","inventory","tasks","finance","notifications","settings","analytics"],
  qc_head: ["dashboard","production","tasks","notifications","settings"],
  floor_supervisor: ["dashboard","production","tasks","hr","notifications","settings"],
  worker: ["dashboard","tasks","notifications"],
}
