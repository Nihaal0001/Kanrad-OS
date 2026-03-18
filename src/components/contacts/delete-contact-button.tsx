"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {mode === "customer" ? "Customer" : "Supplier"}</DialogTitle>
          <DialogDescription>
            Remove <strong>{name}</strong> from your directory? They will be soft-deleted and can be restored via the database.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
