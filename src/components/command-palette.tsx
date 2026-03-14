"use client"

import { useState, useEffect, useTransition, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, ShoppingBag, Package, Users, Zap, Loader2 } from "lucide-react"

import { globalSearch, type SearchResult } from "@/actions/search"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const QUICK_LINKS = [
  { label: "New Order", href: "/orders/new", shortcut: "N O" },
  { label: "Mark Attendance", href: "/hr/attendance", shortcut: null },
  { label: "New Purchase Order", href: "/inventory/purchase-orders/new", shortcut: null },
  { label: "New Invoice", href: "/finance/invoices/new", shortcut: null },
  { label: "Production Overview", href: "/production", shortcut: null },
]

const TYPE_ICONS = {
  order: ShoppingBag,
  material: Package,
  worker: Users,
}

const TYPE_LABELS = {
  order: "Order",
  material: "Material",
  worker: "Worker",
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setActiveIndex(0)
    } else {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch(query)
        setResults(res)
        setActiveIndex(0)
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false)
      router.push(href)
    },
    [onOpenChange, router]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    const items = query ? results : QUICK_LINKS
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = items[activeIndex]
      if (item) navigate(item.href)
    } else if (e.key === "Escape") {
      onOpenChange(false)
    }
  }

  const showQuickLinks = !query
  const showResults = !!query

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search orders, materials, workers…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Quick links */}
        {showQuickLinks && (
          <div className="max-h-80 overflow-y-auto py-2">
            <p className="px-4 pb-1 pt-2 text-xs font-medium text-muted-foreground">
              Quick actions
            </p>
            {QUICK_LINKS.map((link, i) => (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                  activeIndex === i ? "bg-accent text-accent-foreground" : "text-foreground"
                )}
              >
                <Zap className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{link.label}</span>
                {link.shortcut && (
                  <span className="ml-auto text-xs text-muted-foreground">{link.shortcut}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        {showResults && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.length === 0 && !isPending && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </p>
            )}
            {results.length > 0 && (
              <>
                {(["order", "material", "worker"] as const).map((type) => {
                  const group = results.filter((r) => r.type === type)
                  if (group.length === 0) return null
                  const Icon = TYPE_ICONS[type]
                  return (
                    <div key={type}>
                      <p className="px-4 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                        {TYPE_LABELS[type]}s
                      </p>
                      {group.map((result) => {
                        const globalIdx = results.indexOf(result)
                        return (
                          <button
                            key={result.id}
                            onClick={() => navigate(result.href)}
                            onMouseEnter={() => setActiveIndex(globalIdx)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                              activeIndex === globalIdx
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{result.title}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {result.subtitle}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center gap-3">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
