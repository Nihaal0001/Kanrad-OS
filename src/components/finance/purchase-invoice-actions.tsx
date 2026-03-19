"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Trash2 } from "lucide-react"

import { toast } from "sonner"
import { deletePurchaseInvoice } from "@/actions/purchase-invoices"
import { friendlyError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

interface PurchaseInvoiceActionsProps {
  invoiceId: string
  status: string
  redirectAfterDelete?: boolean
  canDeletePaid?: boolean
}

export function PurchaseInvoiceActions({
  invoiceId,
  status,
  redirectAfterDelete,
  canDeletePaid = false,
}: PurchaseInvoiceActionsProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const result = await deletePurchaseInvoice(invoiceId)
    setDeleting(false)
    setConfirmOpen(false)

    if (result && "error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }

    toast.success("Purchase invoice deleted")
    if (redirectAfterDelete) {
      router.push("/finance/purchases")
    } else {
      router.refresh()
    }
  }

  if (status === "paid" && !canDeletePaid) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={deleting}
            onClick={(e) => e.preventDefault()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Purchase Invoice"
        description="Are you sure? This will also delete all associated payments."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  )
}
