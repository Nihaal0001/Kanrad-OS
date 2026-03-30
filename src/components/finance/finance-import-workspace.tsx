"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Plus,
  Receipt,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import {
  submitFinanceImportBatch,
  updateFinanceImportItem,
  uploadFinanceImportBatch,
} from "@/actions/finance-import"
import type { FinanceImportBatchItem } from "@/lib/validators/finance-import"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type BatchItemRecord = {
  id: string
  status: "pending" | "reviewed" | "failed" | "submitted"
  target_type: "purchase_invoice" | "expense"
  file_name: string
  file_type: string
  file_url: string | null
  extraction_confidence: number | null
  extraction_warnings: string[] | null
  extraction_error: string | null
  review_data: FinanceImportBatchItem
  created_record_id: string | null
}

type BatchRecord = {
  id: string
  status: string
  finance_import_items: BatchItemRecord[]
}

interface FinanceImportWorkspaceProps {
  batch: BatchRecord | null
  targetHint?: "purchase_invoice" | "expense"
  purchaseOrders: { id: string; po_number: string; supplier_name: string }[]
  categories: { id: string; name: string }[]
  orders: { id: string; order_number: string; product_variant: string }[]
}

const STATUS_STYLES: Record<string, string> = {
  pending: "border-warning/25 bg-warning/10 text-warning",
  reviewed: "border-primary/25 bg-primary/10 text-primary",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
  submitted: "border-success/25 bg-success/10 text-success",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  failed: "Failed",
  submitted: "Submitted",
}

function formatPercent(value: number | null) {
  if (value == null) return "—"
  return `${Math.round(value * 100)}%`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTargetType(value: "purchase_invoice" | "expense") {
  return value === "purchase_invoice" ? "Purchase Invoice" : "Expense"
}

function ImportUploader({
  targetHint,
  existingBatchId,
}: {
  targetHint?: "purchase_invoice" | "expense"
  existingBatchId?: string
}) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [isPending, startTransition] = useTransition()

  function handleUpload() {
    if (files.length === 0) {
      toast.error("Choose at least one file to import")
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      for (const file of files) {
        formData.append("files", file)
      }
      if (targetHint) {
        formData.append("target_hint", targetHint)
      }
      if (existingBatchId) {
        formData.append("existing_batch_id", existingBatchId)
      }

      const result = await uploadFinanceImportBatch(formData)
      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }

      toast.success(existingBatchId ? "Documents added to batch" : "Documents uploaded for review")
      setFiles([])
      if ("data" in result && result.data) {
        router.push(`/finance/import?batch=${result.data.batchId}${targetHint ? `&target=${targetHint}` : ""}`)
      }
      router.refresh()
    })
  }

  return (
      <Card className="border-dashed border-sidebar-border/80 bg-sidebar-foreground/[0.02]">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-sidebar-accent/70 p-3 text-sidebar-accent-foreground">
            <Upload className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">
              {existingBatchId ? "Upload More Documents" : "Upload Supplier Invoices"}
            </h3>
            <p className="text-sm text-muted-foreground">
              PDF, PNG, JPG, or WEBP. Upload up to 10 files per batch and review everything before submission.
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-sidebar-border/80 bg-background px-4 py-7 text-center transition-colors hover:border-sidebar-accent/40 hover:bg-sidebar-accent/5 sm:px-6 sm:py-8">
          <FileUp className="mb-3 h-8 w-8 text-sidebar-accent-foreground" />
          <span className="font-medium">Drag and drop documents here</span>
          <span className="mt-1 text-sm text-muted-foreground">or click to choose files</span>
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 10))}
          />
        </label>

        {files.length > 0 && (
          <div className="rounded-2xl border border-sidebar-border/70 bg-background p-4">
            <p className="mb-3 text-sm font-medium">Selected files</p>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground">{Math.round(file.size / 1024)} KB</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button onClick={handleUpload} disabled={isPending || files.length === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isPending ? "Extracting..." : existingBatchId ? "Add to Batch" : "Extract"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DocumentPreview({ item }: { item: BatchItemRecord }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!item.file_url || imageFailed) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-sidebar-border/80 bg-card/40 p-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Source file</p>
          <div className="inline-flex max-w-full items-center rounded-full border border-sidebar-border/70 bg-background/80 px-3 py-1 text-sm text-muted-foreground">
            <span className="truncate">{item.file_name}</span>
          </div>
        </div>
      </div>
    )
  }

  if (item.file_type === "application/pdf") {
    return (
      <div className="overflow-hidden rounded-2xl border border-sidebar-border bg-card/70">
        <iframe
          title={item.file_name}
          src={item.file_url}
          className="h-[320px] w-full bg-transparent"
        />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.file_url}
      alt=""
      onError={() => setImageFailed(true)}
      className="h-[320px] w-full rounded-2xl border border-sidebar-border bg-card/70 object-contain"
    />
  )
}

export function FinanceImportWorkspace({
  batch,
  targetHint,
  purchaseOrders,
  categories,
  orders,
}: FinanceImportWorkspaceProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(batch?.finance_import_items?.[0]?.id ?? null)
  const [localBatch, setLocalBatch] = useState(batch)
  const [draftEdits, setDraftEdits] = useState<Record<string, FinanceImportBatchItem>>({})
  const [isPending, startTransition] = useTransition()
  const [isSwitchingDocument, startSwitchTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<"review" | "submit" | null>(null)

  const activeBatch = localBatch?.id === batch?.id ? localBatch : batch

  const selectedItem = useMemo(
    () => {
      const items = activeBatch?.finance_import_items ?? []
      const selected = items.find((item) => item.id === selectedId)
      return selected ?? items[0] ?? null
    },
    [activeBatch, selectedId]
  )

  const effectiveSelectedId = selectedItem?.id ?? null
  const draft =
    effectiveSelectedId && selectedItem
      ? draftEdits[effectiveSelectedId] ?? selectedItem.review_data
      : null

  const counts = useMemo(() => {
    const items = activeBatch?.finance_import_items ?? []
    return {
      pending: items.filter((item) => item.status === "pending").length,
      reviewed: items.filter((item) => item.status === "reviewed").length,
      failed: items.filter((item) => item.status === "failed").length,
      submitted: items.filter((item) => item.status === "submitted").length,
    }
  }, [activeBatch])

  const purchaseTotals = useMemo(() => {
    if (!draft || draft.target_type !== "purchase_invoice") return null

    const subtotal = draft.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    const taxAmount = subtotal * (draft.tax_rate / 100)
    const total = subtotal + taxAmount

    return { subtotal, taxAmount, total }
  }, [draft])

  function updateDraft(updater: (current: FinanceImportBatchItem) => FinanceImportBatchItem) {
    if (!effectiveSelectedId || !draft) return

    setDraftEdits((current) => ({
      ...current,
      [effectiveSelectedId]: updater(draft),
    }))
  }

  function persistReviewed() {
    if (!selectedItem || !draft) return

    setActiveAction("review")
    startTransition(async () => {
      const result = await updateFinanceImportItem(selectedItem.id, draft)
      if ("error" in result && result.error) {
        setActiveAction(null)
        toast.error(result.error)
        return
      }

      toast.success("Review saved")
      setLocalBatch((current) =>
        current
          ? {
              ...current,
              finance_import_items: current.finance_import_items.map((item) =>
                item.id === selectedItem.id
                  ? { ...item, status: "reviewed", target_type: draft.target_type, review_data: draft }
                  : item
              ),
            }
          : current
      )
      setDraftEdits((current) => {
        const next = { ...current }
        delete next[selectedItem.id]
        return next
      })
      setActiveAction(null)
      router.refresh()
    })
  }

  function createDrafts() {
    if (!activeBatch) return

    setActiveAction("submit")
    startTransition(async () => {
      const result = await submitFinanceImportBatch(activeBatch.id)
      if ("error" in result && result.error) {
        setActiveAction(null)
        toast.error(result.error)
        return
      }

      toast.success("Reviewed drafts created")
      setActiveAction(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <ImportUploader targetHint={targetHint} existingBatchId={activeBatch?.id} />

      {activeBatch && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-sidebar-border/70 bg-sidebar-foreground/[0.02] pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Review Queue</CardTitle>
              <Badge variant="outline">Batch {activeBatch.id.slice(0, 8)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 text-xs">
              <Badge className={STATUS_STYLES.pending}>{counts.pending} Pending</Badge>
              <Badge className={STATUS_STYLES.reviewed}>{counts.reviewed} Reviewed</Badge>
              <Badge className={STATUS_STYLES.failed}>{counts.failed} Failed</Badge>
              <Badge className={STATUS_STYLES.submitted}>{counts.submitted} Submitted</Badge>
            </div>
          </CardHeader>
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-2 p-3">
              {activeBatch.finance_import_items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => startSwitchTransition(() => setSelectedId(item.id))}
                  className={cn(
                    "w-full cursor-pointer rounded-2xl border px-5 py-4 text-left transition-all duration-200",
                    selectedItem?.id === item.id
                      ? "border-sidebar-accent/50 bg-sidebar-accent/10 shadow-sm ring-1 ring-sidebar-accent/15"
                      : "border-sidebar-border/70 hover:border-sidebar-accent/30 hover:bg-sidebar-foreground/[0.02] hover:translate-y-[-1px]"
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-all text-base font-medium sm:text-lg">{item.file_name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatTargetType(item.target_type)} · {formatPercent(item.extraction_confidence)}
                      </p>
                    </div>
                    <Badge className={cn("w-fit", STATUS_STYLES[item.status] ?? "bg-muted text-muted-foreground")}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </div>
                  {item.extraction_warnings?.length ? (
                    <p className="mt-2 text-xs text-warning">
                      {item.extraction_warnings[0]}
                    </p>
                  ) : null}
                  {item.extraction_error ? (
                    <p className="mt-2 text-xs text-destructive">{item.extraction_error}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {!selectedItem || !draft ? (
        <Card>
          <CardContent className="flex min-h-[360px] flex-col items-center justify-center p-6 text-center sm:min-h-[520px]">
            <div className="rounded-2xl bg-sidebar-accent/10 p-4 text-sidebar-accent-foreground">
              <Receipt className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No document selected</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Upload supplier invoices to create a review queue, then open each document to verify the extracted fields before creating drafts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          key={selectedItem.id}
          className={cn(
            "space-y-4 transition-all duration-200",
            isSwitchingDocument ? "translate-y-1 opacity-80" : "translate-y-0 opacity-100"
          )}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Document Review</p>
              <h2 className="break-all text-lg font-semibold tracking-tight sm:text-xl">{selectedItem.file_name}</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button variant="outline" onClick={persistReviewed} disabled={isPending} className="w-full sm:w-auto">
                {activeAction === "review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark Reviewed
              </Button>
              <Button onClick={createDrafts} disabled={isPending || !activeBatch} className="w-full sm:w-auto">
                {activeAction === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Reviewed Drafts
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-sidebar-border/70 bg-sidebar-foreground/[0.02]">
                <CardTitle className="text-base">Source Document</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <DocumentPreview item={selectedItem} />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Confidence {formatPercent(selectedItem.extraction_confidence)}</Badge>
                  <Badge className={STATUS_STYLES[selectedItem.status] ?? "bg-muted text-muted-foreground"}>
                    {STATUS_LABELS[selectedItem.status] ?? selectedItem.status}
                  </Badge>
                </div>
                {selectedItem.extraction_warnings?.length ? (
                  <div className="rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-warning">
                      <AlertTriangle className="h-4 w-4" />
                      Extraction Warnings
                    </div>
                    <ul className="space-y-1 break-words text-sm text-warning/90">
                      {selectedItem.extraction_warnings.map((warning, index) => (
                        <li key={`${selectedItem.id}-warning-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-sidebar-border/70 bg-sidebar-foreground/[0.02]">
                <CardTitle className="text-base">Reviewed Draft</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                    <div className="space-y-1.5">
                      <Label>Record Type</Label>
                      <Select
                        value={draft.target_type}
                        onValueChange={(value) =>
                          updateDraft((current) =>
                            value === "expense"
                              ? {
                                  target_type: "expense",
                                  category_id: "",
                                  order_id: "",
                                  amount: 0,
                                  expense_date: "",
                                  description: "",
                                  notes: "",
                                  receipt_url: current.target_type === "expense" ? current.receipt_url : selectedItem.file_url || "",
                                  category_suggestions: [],
                                  order_suggestions: [],
                                  warnings: current.warnings ?? [],
                                }
                              : {
                                  target_type: "purchase_invoice",
                                  purchase_order_id: "",
                                  supplier_name: "",
                                  supplier_gst: "",
                                  invoice_number: "",
                                  tax_rate: 0,
                                  place_of_supply: "",
                                  is_igst: false,
                                  invoice_date: "",
                                  due_date: "",
                                  notes: "",
                                  document_path: "",
                                  document_url: selectedItem.file_url || "",
                                  supplier_suggestions: [],
                                  purchase_order_suggestions: [],
                                  warnings: current.warnings ?? [],
                                  items: [{ description: "Line item", quantity: 1, unit_price: 0, hsn_code: "" }],
                                }
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="purchase_invoice">Purchase invoice</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {draft.target_type === "purchase_invoice" ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Supplier Name</Label>
                            <Input
                              value={draft.supplier_name}
                              onChange={(event) => updateDraft((current) => ({ ...current, supplier_name: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Supplier GSTIN</Label>
                            <Input
                              value={draft.supplier_gst}
                              onChange={(event) => updateDraft((current) => ({ ...current, supplier_gst: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Invoice Number</Label>
                            <Input
                              value={draft.invoice_number}
                              onChange={(event) => updateDraft((current) => ({ ...current, invoice_number: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Linked Purchase Order</Label>
                            <Select
                              value={draft.purchase_order_id || "none"}
                              onValueChange={(value) =>
                                updateDraft((current) => ({ ...current, purchase_order_id: value === "none" ? "" : value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="No PO" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No PO</SelectItem>
                                {purchaseOrders.map((po) => (
                                  <SelectItem key={po.id} value={po.id}>
                                    {po.po_number} — {po.supplier_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Invoice Date</Label>
                            <DatePicker
                              value={draft.invoice_date}
                              onChange={(value) => updateDraft((current) => ({ ...current, invoice_date: value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Due Date</Label>
                            <DatePicker
                              value={draft.due_date}
                              onChange={(value) => updateDraft((current) => ({ ...current, due_date: value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>GST Rate (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={draft.tax_rate}
                              onChange={(event) => updateDraft((current) => ({ ...current, tax_rate: Number(event.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Tax Mode</Label>
                            <Select
                              value={draft.is_igst ? "igst" : "gst"}
                              onValueChange={(value) => updateDraft((current) => ({ ...current, is_igst: value === "igst" }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gst">CGST + SGST</SelectItem>
                                <SelectItem value="igst">IGST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Place of Supply</Label>
                          <Input
                            value={draft.place_of_supply}
                            onChange={(event) => updateDraft((current) => ({ ...current, place_of_supply: event.target.value }))}
                          />
                        </div>

                        {draft.purchase_order_suggestions.length > 0 || draft.supplier_suggestions.length > 0 ? (
                          <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-foreground/[0.02] p-4 text-sm">
                            <p className="font-medium">Suggested Matches</p>
                            {draft.supplier_suggestions.length > 0 ? (
                              <p className="mt-2 break-words text-muted-foreground">
                                Supplier: {draft.supplier_suggestions.map((item) => item.label).join(" · ")}
                              </p>
                            ) : null}
                            {draft.purchase_order_suggestions.length > 0 ? (
                              <p className="mt-1 break-words text-muted-foreground">
                                Purchase orders: {draft.purchase_order_suggestions.map((item) => item.label).join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Label>Line Items</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                updateDraft((current: any) => ({
                                  ...current,
                                  items: [...(current.items ?? []), { description: "", quantity: 1, unit_price: 0, hsn_code: "" }],
                                }))
                              }
                            >
                              <Plus className="h-4 w-4" />
                              Add line
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {draft.items.map((line, index) => (
                              <div key={`${selectedItem.id}-${index}`} className="rounded-2xl border border-sidebar-border/70 p-3">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-sm font-medium text-foreground">Line Item {index + 1}</p>
                                  <div className="w-fit rounded-full border border-sidebar-border/70 bg-sidebar-foreground/[0.02] px-3 py-1 text-sm font-medium text-foreground">
                                    {formatCurrency(line.quantity * line.unit_price)}
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1.5 sm:col-span-2">
                                    <Label>Description</Label>
                                    <Input
                                      value={line.description}
                                      onChange={(event) =>
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        updateDraft((current: any) => ({
                                          ...current,
                                          items: current.items.map((item: any, itemIndex: number) =>
                                            itemIndex === index ? { ...item, description: event.target.value } : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Quantity</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={line.quantity}
                                      onChange={(event) =>
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        updateDraft((current: any) => ({
                                          ...current,
                                          items: current.items.map((item: any, itemIndex: number) =>
                                            itemIndex === index ? { ...item, quantity: Number(event.target.value) || 0 } : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Unit Price</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={line.unit_price}
                                      onChange={(event) =>
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        updateDraft((current: any) => ({
                                          ...current,
                                          items: current.items.map((item: any, itemIndex: number) =>
                                            itemIndex === index ? { ...item, unit_price: Number(event.target.value) || 0 } : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>HSN Code</Label>
                                    <Input
                                      value={line.hsn_code}
                                      onChange={(event) =>
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        updateDraft((current: any) => ({
                                          ...current,
                                          items: current.items.map((item: any, itemIndex: number) =>
                                            itemIndex === index ? { ...item, hsn_code: event.target.value } : item
                                          ),
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Line Total</Label>
                                    <div className="flex h-10 items-center rounded-md border border-sidebar-border/70 bg-muted/20 px-3 text-sm font-medium text-foreground">
                                      {formatCurrency(line.quantity * line.unit_price)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {purchaseTotals ? (
                          <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-foreground/[0.02] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-medium">Verification Summary</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Cross-check the extracted line values against the source document before marking it as reviewed.
                                </p>
                              </div>
                              <Badge variant="outline" className="w-fit">{draft.items.length} Line Items</Badge>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-xl border border-sidebar-border/60 bg-background/60 p-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Subtotal</p>
                                <p className="mt-2 text-lg font-semibold">{formatCurrency(purchaseTotals.subtotal)}</p>
                              </div>
                              <div className="rounded-xl border border-sidebar-border/60 bg-background/60 p-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tax</p>
                                <p className="mt-2 text-lg font-semibold">{formatCurrency(purchaseTotals.taxAmount)}</p>
                              </div>
                              <div className="rounded-xl border border-sidebar-border/60 bg-background/60 p-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Grand Total</p>
                                <p className="mt-2 text-lg font-semibold text-primary">{formatCurrency(purchaseTotals.total)}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-1.5">
                          <Label>Notes</Label>
                          <Textarea
                            rows={3}
                            value={draft.notes}
                            onChange={(event) => updateDraft((current) => ({ ...current, notes: event.target.value }))}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select
                              value={draft.category_id || "none"}
                              onValueChange={(value) =>
                                updateDraft((current) => ({ ...current, category_id: value === "none" ? "" : value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Unmapped</SelectItem>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Order</Label>
                            <Select
                              value={draft.order_id || "none"}
                              onValueChange={(value) =>
                                updateDraft((current) => ({ ...current, order_id: value === "none" ? "" : value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="No order" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No order</SelectItem>
                                {orders.map((order) => (
                                  <SelectItem key={order.id} value={order.id}>
                                    {order.order_number} — {order.product_variant}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Amount</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.amount}
                              onChange={(event) => updateDraft((current) => ({ ...current, amount: Number(event.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Expense Date</Label>
                            <DatePicker
                              value={draft.expense_date}
                              onChange={(value) => updateDraft((current) => ({ ...current, expense_date: value }))}
                            />
                          </div>
                        </div>

                        {(draft.category_suggestions.length > 0 || draft.order_suggestions.length > 0) && (
                          <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-foreground/[0.02] p-4 text-sm">
                            <p className="font-medium">Suggested Matches</p>
                            {draft.category_suggestions.length > 0 ? (
                              <p className="mt-2 text-muted-foreground">
                                Categories: {draft.category_suggestions.map((item) => item.label).join(" · ")}
                              </p>
                            ) : null}
                            {draft.order_suggestions.length > 0 ? (
                              <p className="mt-1 text-muted-foreground">
                                Orders: {draft.order_suggestions.map((item) => item.label).join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        )}

                        <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-foreground/[0.02] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">Verification Summary</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Confirm the extracted amount and mapping before creating the expense draft.
                              </p>
                            </div>
                            <Badge variant="outline">{formatCurrency(draft.amount)}</Badge>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Description</Label>
                          <Input
                            value={draft.description}
                            onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Notes</Label>
                          <Textarea
                            rows={4}
                            value={draft.notes}
                            onChange={(event) => updateDraft((current) => ({ ...current, notes: event.target.value }))}
                          />
                        </div>
                      </div>
                    )}

                <Separator />
                <p className="text-xs text-muted-foreground">
                  AI extraction is assistive only. Review all amounts, tax details, and mappings before marking the document as reviewed.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
