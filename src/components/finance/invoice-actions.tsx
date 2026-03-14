"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Trash2 } from "lucide-react"

import { deleteInvoice } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface InvoiceActionsProps {
  invoiceId: string
  status: string
  redirectAfterDelete?: boolean
}

export function InvoiceActions({ invoiceId, status, redirectAfterDelete }: InvoiceActionsProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return
    setDeleting(true)
    await deleteInvoice(invoiceId)
    if (redirectAfterDelete) {
      router.push("/finance/invoices")
    } else {
      router.refresh()
    }
  }

  if (status === "paid") return null

  return (
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
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete Invoice
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
