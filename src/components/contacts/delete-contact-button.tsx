"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { deleteCustomer } from "@/actions/customers"
import { deleteSupplier } from "@/actions/suppliers"

interface DeleteContactButtonProps {
  id: string
  mode: "customer" | "supplier"
  name: string
}

export function DeleteContactButton({ id, mode, name }: DeleteContactButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      const result = mode === "customer" ? await deleteCustomer(id) : await deleteSupplier(id)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${mode === "customer" ? "Customer" : "Supplier"} removed`)
        router.push(mode === "customer" ? "/customers" : "/suppliers")
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Remove ${mode === "customer" ? "Customer" : "Supplier"}`}
        description={`Remove ${name} from your directory? They will be soft-deleted and can be restored via the database.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
