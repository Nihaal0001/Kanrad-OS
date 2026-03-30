"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { updateIssueStatus } from "@/actions/issues"
import { friendlyError, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Issue {
  id: string
  module: string
  issue_type: string
  description: string
  severity: string
  status: string
  resolved_at: string | null
  created_at: string
}

interface IssuesTableProps {
  issues: Issue[]
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") {
    return <Badge className="bg-red-600 text-white hover:bg-red-700">Critical</Badge>
  }
  if (severity === "high") {
    return <Badge className="bg-orange-500 text-white hover:bg-orange-600">High</Badge>
  }
  return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Medium</Badge>
}

function StatusBadge({ status }: { status: string }) {
  if (status === "resolved") {
    return <Badge variant="success">Resolved</Badge>
  }
  if (status === "in_progress") {
    return <Badge variant="warning">In Progress</Badge>
  }
  return <Badge variant="outline">Open</Badge>
}

export function IssuesTable({ issues }: IssuesTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let result = issues
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter)
    if (severityFilter !== "all") result = result.filter((i) => i.severity === severityFilter)
    return result
  }, [issues, statusFilter, severityFilter])

  async function handleStatusChange(id: string, status: string) {
    setLoadingId(id)
    const result = await updateIssueStatus(id, status)
    setLoadingId(null)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success(`Issue ${status === "resolved" ? "resolved" : "updated"}`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>

        <p className="ml-auto text-sm text-muted-foreground">
          {filtered.length} issue{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No issues found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="w-[100px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((issue) => {
                const isLoading = loadingId === issue.id

                return (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {issue.module}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{issue.issue_type}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="line-clamp-2 text-sm text-muted-foreground">{issue.description}</p>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={issue.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={issue.status} />
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(issue.created_at)}</TableCell>
                    <TableCell>
                      {issue.status !== "resolved" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isLoading}>
                              {isLoading ? "..." : "Update"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {issue.status === "open" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(issue.id, "in_progress")}>
                                Mark In Progress
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-green-600 focus:text-green-700"
                              onClick={() => handleStatusChange(issue.id, "resolved")}
                            >
                              Mark Resolved
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
