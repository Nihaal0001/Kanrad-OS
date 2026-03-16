"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Search, Plus, Pencil, Trash2 } from "lucide-react"

import type { Buyer } from "@/lib/supabase/types"
import { friendlyError } from "@/lib/utils"
import { deleteBuyer } from "@/actions/buyers"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BuyerForm } from "@/components/orders/buyer-form"

interface BuyersTableProps {
  buyers: Buyer[]
}

export function BuyersTable({ buyers }: BuyersTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<Buyer | undefined>()

  const filteredBuyers = useMemo(() => {
    if (!search.trim()) return buyers
    const q = search.toLowerCase().trim()
    return buyers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.company?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.gst_number?.toLowerCase().includes(q)
    )
  }, [buyers, search])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      const result = await deleteBuyer(id)
      setDeletingId(null)
      setConfirmId(null)

      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }

      toast.success("Buyer deleted")
      router.refresh()
    },
    [router]
  )

  function openEdit(buyer: Buyer) {
    setEditingBuyer(buyer)
    setFormOpen(true)
  }

  function openCreate() {
    setEditingBuyer(undefined)
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search buyers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filteredBuyers.length} buyer{filteredBuyers.length !== 1 ? "s" : ""}
          </p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Buyer
          </Button>
        </div>
      </div>

      {/* Table */}
      {filteredBuyers.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No buyers found.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBuyers.map((buyer) => (
                <TableRow key={buyer.id}>
                  <TableCell className="font-medium">{buyer.name}</TableCell>
                  <TableCell>
                    {buyer.company || (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {buyer.email || (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {buyer.phone || (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {buyer.gst_number || (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={deletingId === buyer.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(buyer)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmId(buyer.id)}
                          disabled={deletingId === buyer.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BuyerForm
        buyer={editingBuyer}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => { if (!open) setConfirmId(null) }}
        title="Delete Buyer"
        description="Delete this buyer permanently? Orders linked to this buyer will lose their buyer reference."
        confirmLabel="Delete"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        loading={deletingId !== null}
      />
    </div>
  )
}
