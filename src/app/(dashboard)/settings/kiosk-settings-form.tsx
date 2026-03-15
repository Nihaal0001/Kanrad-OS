"use client"

import { useTransition, useState } from "react"
import { toast } from "sonner"
import { MapPin, Navigation } from "lucide-react"
import { saveOfficeLocation } from "./actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface KioskSettingsFormProps {
  defaults: { lat: number; long: number; radius_m: number } | null
}

export function KioskSettingsForm({ defaults }: KioskSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [lat, setLat] = useState(String(defaults?.lat ?? ""))
  const [long, setLong] = useState(String(defaults?.long ?? ""))
  const [radiusM, setRadiusM] = useState(String(defaults?.radius_m ?? 50))
  const [locating, setLocating] = useState(false)

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported in this browser")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(6)))
        setLong(String(pos.coords.longitude.toFixed(6)))
        setLocating(false)
        toast.success("Location captured")
      },
      () => {
        setLocating(false)
        toast.error("Could not get location — check permissions")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveOfficeLocation(formData)
      if (result?.error) {
        toast.error("Failed to save: " + result.error)
      } else if (result?.success) {
        toast.success("Office location saved")
      }
    })
  }

  const hasCoords =
    lat && long && lat !== "0" && long !== "0"

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lat">Latitude</Label>
          <Input
            id="lat"
            name="lat"
            type="number"
            step="0.000001"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="12.971600"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="long">Longitude</Label>
          <Input
            id="long"
            name="long"
            type="number"
            step="0.000001"
            value={long}
            onChange={(e) => setLong(e.target.value)}
            placeholder="77.594600"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="radius_m">Geofence Radius (metres)</Label>
        <Input
          id="radius_m"
          name="radius_m"
          type="number"
          min="10"
          max="1000"
          value={radiusM}
          onChange={(e) => setRadiusM(e.target.value)}
          placeholder="50"
        />
        <p className="text-xs text-muted-foreground">
          Employees scanning outside this radius will be flagged
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseMyLocation}
          disabled={locating}
        >
          <Navigation className="h-4 w-4" />
          {locating ? "Locating..." : "Use my current location"}
        </Button>

        {hasCoords && (
          <a
            href={`https://maps.google.com/?q=${lat},${long}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <MapPin className="h-3 w-3" />
            View on Google Maps
          </a>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save location"}
        </Button>
      </div>
    </form>
  )
}
