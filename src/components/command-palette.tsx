"use client"

import { useState, useEffect, useTransition, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, ShoppingBag, Package, Users, Zap, Loader2, Sparkles } from "lucide-react"

import { globalSearch, type SearchResult } from "@/actions/search"
import { getSmartSuggestions, type Suggestion } from "@/actions/ai"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
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

  // Smart suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const suggestionsLoaded = useRef(false)

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setActiveIndex(0)
    } else {
      setTimeout(() => inputRef.current?.focus(), 50)
      if (!suggestionsLoaded.current) {
        setSuggestionsLoading(true)
        getSmartSuggestions().then((res) => {
          if ("suggestions" in res) setSuggestions(res.suggestions)
          setSuggestionsLoading(false)
          suggestionsLoaded.current = true
        })
      }
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
        <DialogTitle className="sr-only">Search</DialogTitle>
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
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Quick links + AI suggestions */}
        {showQuickLinks && (
          <div className="max-h-80 overflow-y-auto py-2">
            {suggestions.length > 0 && (
              <>
                <p className="px-4 pb-1 pt-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  AI Suggestions
                </p>
                {suggestions.map((s, i) => (
                  <button
                    key={`suggestion-${i}`}
                    onClick={() => navigate(s.href)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}
            {suggestionsLoading && (
              <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading AI suggestions…
              </div>
            )}

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

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
