/** Supplier bills fall due this many days after the day they are entered in the ERP. */
export const BILL_PAYMENT_DAYS = 45

/** Today's date (YYYY-MM-DD) in India, regardless of the server's timezone. */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Due date for a bill entered today: entry date + 45 days (not the supplier's invoice date). */
export function billDueDateFromToday(): string {
  return addDaysISO(todayIST(), BILL_PAYMENT_DAYS)
}
