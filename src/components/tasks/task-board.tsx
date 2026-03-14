"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import type { TaskWithDetails } from "@/lib/supabase/types"
import { cn, formatDate } from "@/lib/utils"
import { updateTaskStatus, deleteTask } from "@/actions/tasks"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { TaskForm } from "@/components/tasks/task-form"

const COLUMNS = [
  { status: "todo", label: "To Do", color: "border-t-border" },
  { status: "in_progress", label: "In Progress", color: "border-t-amber-400" },
  { status: "done", label: "Done", color: "border-t-emerald-500" },
] as const

interface TaskBoardProps {
  tasks: TaskWithDetails[]
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  const router = useRouter()
  const [movingId, setMovingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleMove = useCallback(
    async (taskId: string, status: string) => {
      setMovingId(taskId)
      await updateTaskStatus(taskId, status)
      setMovingId(null)
      router.refresh()
    },
    [router]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this task?")) return
      setDeletingId(id)
      await deleteTask(id)
      setDeletingId(null)
      router.refresh()
    },
    [router]
  )

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status)
        return (
          <div key={col.status} className="flex flex-col gap-3">
            {/* Column header */}
            <div
              className={cn(
                "rounded-lg border-t-2 bg-secondary/40 px-4 py-3",
                col.color
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {colTasks.length}
                  </Badge>
                  <TaskForm defaultStatus={col.status} />
                </div>
              </div>
            </div>

            {/* Task cards */}
            <div className="flex flex-col gap-2 min-h-[200px]">
              {colTasks.length === 0 && (
                <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">No tasks</p>
                </div>
              )}
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "rounded-lg border border-border bg-card p-3 space-y-2 transition-opacity",
                    (movingId === task.id || deletingId === task.id) && "opacity-50"
                  )}
                >
                  {/* Title + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug flex-1">
                      {task.title}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <TaskForm
                          task={task}
                          trigger={
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          }
                        />
                        {col.status !== "todo" && (
                          <DropdownMenuItem
                            onClick={() => handleMove(task.id, "todo")}
                          >
                            Move to To Do
                          </DropdownMenuItem>
                        )}
                        {col.status !== "in_progress" && (
                          <DropdownMenuItem
                            onClick={() => handleMove(task.id, "in_progress")}
                          >
                            Move to In Progress
                          </DropdownMenuItem>
                        )}
                        {col.status !== "done" && (
                          <DropdownMenuItem
                            onClick={() => handleMove(task.id, "done")}
                          >
                            Move to Done
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Description */}
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityIndicator priority={task.priority} />
                    {task.order && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {task.order.order_number}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Due {formatDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
