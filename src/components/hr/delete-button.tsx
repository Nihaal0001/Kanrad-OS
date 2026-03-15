"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

import { toast } from "sonner"
import { friendlyError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

interface DeleteButtonProps {
  title: string
  description: string
  onDelete: () => Promise<{ error?: string } | { success: boolean } | undefined>
  className?: string
}

export function DeleteButton({ title, description, onDelete, className }: DeleteButtonProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const result = await onDelete()
    setDeleting(false)
    setConfirmOpen(false)

    if (result && "error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }

    toast.success("Deleted successfully")
    router.refresh()
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className ?? "h-7 w-7 text-muted-foreground hover:text-destructive"}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={title}
        description={description}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  )
}
