"use client"

import { Trash2, ExternalLink, Star } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { TopStory } from "@/actions/market-intel"

export const NEWS_CATEGORIES = [
  { value: "cookware", label: "Cookware" },
  { value: "raw_material", label: "Raw Material" },
  { value: "industry", label: "Industry" },
  { value: "regulation", label: "Regulation" },
  { value: "general", label: "General" },
]

const CATEGORY_COLORS: Record<string, string> = {
  cookware: "bg-orange-500/15 text-orange-600 border-orange-500/20",
  raw_material: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  industry: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  regulation: "bg-purple-500/15 text-purple-600 border-purple-500/20",
  general: "bg-muted text-muted-foreground",
}

export type News = {
  id: string
  title: string
  summary: string | null
  url: string | null
  category: string
  source: string | null
  published_at: string
}

interface NewsSectionProps {
  news: News[]
  topStories: TopStory[]
  onDelete: (id: string) => void
  isPending: boolean
}

export function NewsSection({ news, topStories, onDelete, isPending }: NewsSectionProps) {
  return (
    <div className="space-y-4">
      {topStories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
              <Star className="h-3 w-3" /> Top Stories — AI picked
            </span>
            <div className="flex-1 h-px bg-primary/20" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {topStories.map(story => (
              <a
                key={story.id}
                href={story.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-primary/25 bg-primary/5 p-3 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", CATEGORY_COLORS[story.category] ?? CATEGORY_COLORS.general)}>
                    {NEWS_CATEGORIES.find(c => c.value === story.category)?.label ?? story.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{story.source ?? ""}</span>
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-2">{story.title}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {news.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          No news yet. News auto-fetches daily, or click &quot;Add News&quot; to add manually.
        </div>
      )}

      {news.filter(n => n.category === "cookware").length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-600">🍳 Cookware Industry</span>
            <div className="flex-1 h-px bg-orange-500/20" />
          </div>
          {news.filter(n => n.category === "cookware").map(item => (
            <NewsCard key={item.id} item={item} onDelete={onDelete} isPending={isPending} highlight />
          ))}
        </div>
      )}

      {news.filter(n => n.category !== "cookware").length > 0 && (
        <div className="space-y-2">
          {news.filter(n => n.category === "cookware").length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other News</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}
          {news.filter(n => n.category !== "cookware").map(item => (
            <NewsCard key={item.id} item={item} onDelete={onDelete} isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

function NewsCard({ item, onDelete, isPending, highlight }: {
  item: News
  onDelete: (id: string) => void
  isPending: boolean
  highlight?: boolean
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      highlight ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general)}>
              {NEWS_CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(item.published_at)}</span>
            {item.source && <span className="text-xs text-muted-foreground">· {item.source}</span>}
          </div>
          <h3 className={cn("font-semibold leading-snug", highlight && "text-orange-900 dark:text-orange-100")}>{item.title}</h3>
          {item.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5">
              Read more <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <button
          className="shrink-0 text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
          onClick={() => onDelete(item.id)} disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
