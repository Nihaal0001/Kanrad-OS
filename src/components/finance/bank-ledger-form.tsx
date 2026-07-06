"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { saveBankLedgerSetting } from "@/actions/tally"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export function BankLedgerForm({ defaultName }: { defaultName: string }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveBankLedgerSetting(formData)
      if (result?.error) {
        toast.error("Failed to save: " + result.error)
      } else {
        toast.success("Bank ledger updated — new receipts/payments will post here")
      }
    })
  }

  return (
    <form action={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1 space-y-2">
        <Label htmlFor="bank_ledger_name">Current bank ledger (Tally)</Label>
        <Input
          id="bank_ledger_name"
          name="name"
          defaultValue={defaultName}
          placeholder="e.g. SCB Current A/c No.45505313821"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  )
}
