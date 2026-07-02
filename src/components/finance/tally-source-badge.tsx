import Link from "next/link"
import { Info, Link2 } from "lucide-react"

import { formatDateRelative } from "@/lib/utils"

interface TallySourceBadgeProps {
  isSample: boolean
  lastSyncedAt: string | null
}

/** Data-source strip for Tally-fed pages: sample-data warning until the first
 *  connector pull, then a "Linked to Tally" pill. */
export function TallySourceBadge({ isSample, lastSyncedAt }: TallySourceBadgeProps) {
  if (isSample) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
        <Info className="h-4 w-4 shrink-0" />
        Showing sample data. Run the Tally connector to pull your real accounts.
        <Link href="/finance/tally" className="ml-auto shrink-0 font-medium underline-offset-4 hover:underline">
          Sync status
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-5">
      <Link
        href="/finance/tally"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
      >
        <Link2 className="h-3.5 w-3.5" />
        Linked to Tally
        {lastSyncedAt && <span className="text-emerald-700/70 dark:text-emerald-400/70">· synced {formatDateRelative(lastSyncedAt)}</span>}
      </Link>
    </div>
  )
}
