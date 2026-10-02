"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { updatePayrollTeaAllowance } from "@/actions/hr"
import { friendlyError } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export function PayrollTeaAllowanceInput({ id, value }: { id: string; value: number }) {
  const router = useRouter()
  const [draft, setDraft] = useState(String(value))
  const [isPending, startTransition] = useTransition()

  function handleBlur() {
    const amount = Math.max(0, Number(draft) || 0)
    if (amount === value) {
      setDraft(String(amount))
      return
    }
    startTransition(async () => {
      const result = await updatePayrollTeaAllowance(id, amount)
      if (result && "error" in result && result.error) {
        toast.error(friendlyError(result.error))
        setDraft(String(value))
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="relative w-24 ml-auto">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        disabled={isPending}
        className="h-7 pl-5 text-right text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  )
}
