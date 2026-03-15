import { RefreshCcw } from "lucide-react"

import { getShifts, deleteShift } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ShiftForm } from "@/components/hr/shift-form"
import { DeleteButton } from "@/components/hr/delete-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default async function ShiftsPage() {
  const shifts = await getShifts()

  return (
    <>
      <PageHeader title="Shifts" description="Define and manage work shifts">
        <ShiftForm />
      </PageHeader>

      {shifts.length === 0 ? (
        <EmptyState
          icon={RefreshCcw}
          title="No shifts defined"
          description="Create shifts to organize your workforce"
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_80px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Name</span>
            <span>Start</span>
            <span>End</span>
            <span>Description</span>
            <span />
          </div>

          {shifts.map((shift) => (
            <Card key={shift.id}>
              <CardContent className="grid grid-cols-[1.5fr_1fr_1fr_1fr_80px] items-center gap-4 p-4">
                <p className="text-sm font-medium">{shift.name}</p>
                <p className="text-sm text-muted-foreground">{shift.start_time}</p>
                <p className="text-sm text-muted-foreground">{shift.end_time}</p>
                <p className="text-sm text-muted-foreground truncate">{shift.description ?? "—"}</p>
                <div className="flex items-center gap-1">
                  <ShiftForm
                    existing={shift}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Edit</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </Button>
                    }
                  />
                  <DeleteButton
                    title="Delete Shift"
                    description={`Delete the "${shift.name}" shift? This cannot be undone.`}
                    onDelete={() => deleteShift(shift.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
