"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function TallyExportCard() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + "01"

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(today)

  function handleExport() {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    window.location.href = `/api/export/tally-xml?${params.toString()}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tally Prime Export</CardTitle>
        <CardDescription>
          Export sales and purchase vouchers as a Tally-compatible XML file. Import it directly into Tally Prime via{" "}
          <em>Import Data → Vouchers</em>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4 max-sm:flex-col max-sm:items-stretch">
          <div className="space-y-1.5">
            <Label htmlFor="tally-from">From</Label>
            <Input
              id="tally-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40 max-sm:w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tally-to">To</Label>
            <Input
              id="tally-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40 max-sm:w-full"
            />
          </div>
          <Button onClick={handleExport} variant="outline" className="max-sm:w-full">
            <Download className="mr-2 h-4 w-4" />
            Download XML
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
