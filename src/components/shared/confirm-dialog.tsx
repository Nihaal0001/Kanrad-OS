"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  destructive?: boolean
  loading?: boolean
  /**
   * Second verification step: the user must type this word before the button
   * unlocks. Defaults to the button label in capitals (DELETE, DEACTIVATE,
   * REMOVE) for destructive dialogs. Pass `false` to opt out.
   */
  requireText?: string | false
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, onOpenChange, loading = false } = props
  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so the typed text always starts empty */}
        <ConfirmBody {...props} />
      </DialogContent>
    </Dialog>
  )
}

function ConfirmBody({
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  destructive = true,
  loading = false,
  requireText,
}: ConfirmDialogProps) {
  const phrase = requireText === false ? null : requireText ?? (destructive ? confirmLabel.toUpperCase() : null)
  const [typed, setTyped] = useState("")
  const unlocked = !phrase || typed.trim().toLowerCase() === phrase.toLowerCase()

  function submit() {
    if (unlocked && !loading) onConfirm()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {phrase && (
        <div className="space-y-2">
          <label htmlFor="confirm-phrase" className="text-sm text-muted-foreground">
            Step 2 of 2 — type <span className="font-mono font-semibold text-foreground">{phrase}</span> to confirm
          </label>
          <Input
            id="confirm-phrase"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit() } }}
            placeholder={phrase}
            autoComplete="off"
            autoFocus
            disabled={loading}
          />
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={loading || !unlocked}>
          {loading ? "Please wait…" : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
