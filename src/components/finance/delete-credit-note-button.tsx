"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { deleteCreditNote } from "@/actions/credit-notes"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

export function DeleteCreditNoteButton({ id, number }: { id: string; number: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCreditNote(id)
      setOpen(false)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Credit note deleted")
      router.push("/finance/credit-notes")
    })
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Credit Note"
        description={`Delete credit note ${number}? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
