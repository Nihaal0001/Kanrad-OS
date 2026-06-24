"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"

import { createWorkers } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"

export function AddWorkersSheet() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState("")
  const [department, setDepartment] = useState("")
  const [isPending, startTransition] = useTransition()

  const parsed = names.split("\n").map((n) => n.trim()).filter(Boolean)

  function handleSubmit() {
    if (parsed.length === 0) {
      toast.error("Enter at least one worker name")
      return
    }
    startTransition(async () => {
      const result = await createWorkers({ names: parsed, department: department.trim() || undefined })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.count} worker${result.count === 1 ? "" : "s"} added`)
      setNames("")
      setDepartment("")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Add Workers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Workers</DialogTitle>
          <DialogDescription>
            Paste your list — one worker name per line. They&apos;ll appear on the attendance screen straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="worker-names">Worker names (one per line) *</Label>
            <textarea
              id="worker-names"
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={8}
              placeholder={"Ramesh Kumar\nSita Devi\nArjun Patel"}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {parsed.length} worker{parsed.length === 1 ? "" : "s"} detected
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="worker-dept">Department <span className="font-normal text-muted-foreground">(optional, applies to all)</span></Label>
            <Input
              id="worker-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Pressing, Packing, Polishing"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || parsed.length === 0}>
            {isPending ? "Adding…" : `Add ${parsed.length || ""} ${parsed.length === 1 ? "Worker" : "Workers"}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
