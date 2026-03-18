"use client"

import { useState } from "react"
import { FileJson, Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface Props {
  invoiceId: string
  invoiceNumber: string
  status: string
}

export function EInvoiceButton({ invoiceId, invoiceNumber, status }: Props) {
  const [payload, setPayload] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  async function fetchPayload() {
    if (payload) return
    setLoading(true)
    try {
      const res = await fetch(`/api/einvoice/${invoiceId}/json`)
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setPayload(JSON.stringify(json, null, 2))
    } catch {
      setPayload('{ "error": "Failed to generate e-invoice payload" }')
    } finally {
      setLoading(false)
    }
  }

  function handleOpen(v: boolean) {
    setOpen(v)
    if (v) fetchPayload()
  }

  async function handleCopy() {
    if (!payload) return
    await navigator.clipboard.writeText(payload)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === "cancelled" || status === "draft") return null

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileJson className="mr-2 h-4 w-4" />
          E-Invoice JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>E-Invoice Payload</DialogTitle>
            <Badge className="bg-amber-100 text-amber-700 text-xs">GST IRP Format</Badge>
          </div>
          <p className="text-sm text-muted-foreground pt-1">
            {invoiceNumber} — Upload this JSON to the{" "}
            <a
              href="https://einvoice1.gst.gov.in"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              GST IRP portal
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            to generate an IRN and QR code.
          </p>
        </DialogHeader>

        <div className="relative">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Generating payload…
            </div>
          ) : (
            <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-96 font-mono whitespace-pre-wrap break-all">
              {payload}
            </pre>
          )}

          {payload && !loading && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Note — IRN generation steps:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Copy this JSON payload</li>
            <li>Log in to the GST IRP portal (einvoice1.gst.gov.in)</li>
            <li>Use "Generate IRN" → paste payload or upload as file</li>
            <li>Download the signed invoice with QR code and attach to your records</li>
          </ol>
          <p className="mt-1 text-amber-700">
            E-invoicing is mandatory for taxpayers above ₹5 Cr aggregate turnover (AATO).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
