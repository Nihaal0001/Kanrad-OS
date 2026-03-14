"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Trash2 } from "lucide-react"

import { deletePayment } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface PaymentActionsProps {
  paymentId: string
}

export function PaymentActions({ paymentId }: PaymentActionsProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this payment? The invoice outstanding balance will be updated.")) return
    setDeleting(true)
    await deletePayment(paymentId)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={deleting}
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
          Delete Payment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
