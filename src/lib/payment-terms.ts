/** Default payment terms: supplier bills fall due this many days after the day they are entered. */
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

/**
 * Due date for a bill entered today: entry date + the PO's payment terms
 * (45 days when the bill has no PO) — not the supplier's invoice date.
 */
export function billDueDateFromToday(paymentTerms: number | null | undefined = BILL_PAYMENT_DAYS): string {
  return addDaysISO(todayIST(), paymentTerms ?? BILL_PAYMENT_DAYS)
}
