"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Wand2 } from "lucide-react"
import { toast } from "sonner"

import { generatePreviousMonthPayroll } from "@/actions/hr"
import { Button } from "@/components/ui/button"

export function GeneratePayrollButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await generatePreviousMonthPayroll()
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.count === 0
          ? "No new payroll to generate (already done or no salaries set)"
          : `Generated ${result.count} draft payroll record${result.count === 1 ? "" : "s"}`
      )
      router.refresh()
    })
  }

  return (
    <Button onClick={handleClick} disabled={isPending}>
      <Wand2 className="h-4 w-4" />
      {isPending ? "Generating…" : "Generate Payroll"}
    </Button>
  )
}
