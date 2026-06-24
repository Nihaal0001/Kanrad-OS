"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"

import { markAllPresent } from "@/actions/hr"
import { Button } from "@/components/ui/button"

export function MarkAllPresentButton({ date }: { date: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await markAllPresent(date)
      if (result && "error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.count === 0 ? "Everyone is already marked" : `Marked ${result.count} present`
      )
      router.refresh()
    })
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      <CheckCheck className="h-4 w-4" />
      {isPending ? "Marking…" : "Mark all present"}
    </Button>
  )
}
