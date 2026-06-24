import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { runMonthlyPayroll } from "@/lib/payroll-gen"

export const dynamic = "force-dynamic"

// Runs on the 10th of each month — generates draft payroll for the previous
// full calendar month from attendance + each worker's monthly salary.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const result = await runMonthlyPayroll(prev.getFullYear(), prev.getMonth())

  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  revalidatePath("/hr/payroll")
  return NextResponse.json({ ok: true, ...result })
}
