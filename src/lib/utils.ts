import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * `setValueAs` helpers for optional numeric `<input>` fields in react-hook-form.
 *
 * A numeric input with `valueAsNumber: true` returns `NaN` when empty, and Zod
 * number schemas reject `NaN` — so an untouched optional field silently blocks
 * the whole form from saving. Use these with `setValueAs` (and WITHOUT
 * `valueAsNumber`, which would override `setValueAs`) so blanks become an
 * "absent" value the schema accepts, while real input parses to a number.
 *
 * Pick the variant that matches the Zod field: `...nullable()` → `numberOrNull`,
 * plain `.optional()` → `numberOrUndefined`.
 */
export function numberOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isNaN(n) ? null : n
}

export function numberOrUndefined(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined
  const n = typeof value === "number" ? value : Number(value)
  return Number.isNaN(n) ? undefined : n
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function friendlyError(message: string): string {
  if (!message) return "Something went wrong. Please try again."
  const m = message.toLowerCase()
  if (m.includes("duplicate key") || m.includes("unique constraint") || m.includes("already exists"))
    return "A record with these details already exists."
  if (m.includes("foreign key") || m.includes("violates foreign key") || m.includes("still referenced"))
    return "Cannot delete — this record is used by other data."
  if (m.includes("not null") || m.includes("null value in column"))
    return "A required field is missing or empty."
  if (m.includes("permission denied") || m.includes("insufficient privilege") || m.includes("rls"))
    return "You don't have permission to perform this action."
  if (m.includes("check constraint") || m.includes("violates check"))
    return "The data entered is outside the allowed range."
  if (m.includes("network") || m.includes("fetch failed") || m.includes("econnrefused"))
    return "Network error — check your connection and try again."
  return message
}

export function formatDateRelative(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

/** Check if a date string is in the past (overdue) */
export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false
  const d = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}
