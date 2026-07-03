import { navigation, pageKeyFromHref } from "@/lib/constants"

export interface PermissionLeaf {
  key: string
  label: string
  href: string
  /** the coarse module this page used to share a permission string with */
  legacyModule?: string
}

export interface PermissionGroup {
  id: string
  title: string
  /** synthetic "grant everything in this section" key, for sections that map
   *  to a module with no single corresponding page (e.g. People → "hr") */
  masterKey?: string
  leaves: PermissionLeaf[]
}

/** Single source of truth for "what pages exist" — generated from the real
 *  nav structure so the role matrix and per-user picker can never drift from
 *  each other or from the actual sidebar again. */
export const PERMISSION_TREE: PermissionGroup[] = navigation.map((section) => ({
  id: section.id,
  title: section.title,
  masterKey: section.id === "people" ? "hr" : undefined,
  leaves: section.items
    .filter((item) => !!item.permission) // items with no permission (e.g. Scan QR) are always visible
    .map((item) => ({
      key: pageKeyFromHref(item.href),
      label: item.title,
      href: item.href,
      legacyModule: item.permission,
    })),
}))

/** Standalone toggles with no corresponding page — kept exactly as they
 *  behaved before this redesign (tasks/analytics gate AI tools & legacy
 *  nav quirks, not a visible sidebar page). */
export const LEGACY_ONLY_FLAGS: { key: string; label: string }[] = [
  { key: "tasks", label: "Tasks (AI assistant task tools)" },
  { key: "analytics", label: "Analytics (legacy)" },
]

export const ALL_PAGE_KEYS: string[] = [
  ...PERMISSION_TREE.flatMap((g) => [...(g.masterKey ? [g.masterKey] : []), ...g.leaves.map((l) => l.key)]),
  ...LEGACY_ONLY_FLAGS.map((f) => f.key),
]

/** Legacy coarse module -> every page key that falls under it today. Used to
 *  expand old grants into the new granular set (DB migration + fallback
 *  paths) so no one's access shrinks on cutover. */
export const MODULE_TO_PAGE_KEYS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  for (const group of PERMISSION_TREE) {
    for (const leaf of group.leaves) {
      if (!leaf.legacyModule) continue
      ;(map[leaf.legacyModule] ??= []).push(leaf.key)
    }
    if (group.masterKey) (map[group.masterKey] ??= []).push(group.masterKey)
  }
  return map
})()

/** key -> human label, across the tree + legacy flags. */
export const LABEL_BY_KEY: Map<string, string> = new Map([
  ...PERMISSION_TREE.flatMap((g) => [
    ...(g.masterKey ? ([[g.masterKey, `${g.title} (all)`]] as [string, string][]) : []),
    ...g.leaves.map((l) => [l.key, l.label] as [string, string]),
  ]),
  ...LEGACY_ONLY_FLAGS.map((f) => [f.key, f.label] as [string, string]),
])
