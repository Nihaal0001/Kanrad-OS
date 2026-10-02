"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserMinus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { removeWorker } from "@/actions/hr"
import { friendlyError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

interface Worker {
  id: string
  full_name: string
  department: string | null
}

export function RemoveWorkerDialog({ workers }: { workers: Worker[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pendingWorker, setPendingWorker] = useState<Worker | null>(null)
  const [removing, setRemoving] = useState(false)

  async function handleConfirm() {
    if (!pendingWorker) return
    setRemoving(true)
    const result = await removeWorker(pendingWorker.id)
    setRemoving(false)
    setPendingWorker(null)

    if (result && "error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success(`${pendingWorker.full_name} removed`)
    router.refresh()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <UserMinus className="h-4 w-4" />
            Remove Worker
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>Remove Worker</DialogTitle>
            <DialogDescription>
              Removing a worker takes them off attendance and payroll going forward. Their past
              records are kept.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {workers.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground text-center">No workers to remove</p>
            ) : (
              workers.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 px-6 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{w.full_name}</p>
                    {w.department && <p className="truncate text-xs text-muted-foreground">{w.department}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingWorker(w)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingWorker}
        onOpenChange={(next) => !next && setPendingWorker(null)}
        title="Remove Worker"
        description={`Remove ${pendingWorker?.full_name ?? "this worker"} from attendance and payroll? Their past records will be kept.`}
        confirmLabel="Remove"
        onConfirm={handleConfirm}
        loading={removing}
      />
    </>
  )
}
