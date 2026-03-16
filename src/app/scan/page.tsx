"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  AlertTriangle,
  QrCode,
  ArrowLeft,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { verifyAndRecordAttendance } from "@/actions/attendance-qr"

type ScanState =
  | { phase: "loading" }
  | { phase: "waiting" }
  | { phase: "submitting" }
  | {
      phase: "success"
      type: "IN" | "OUT"
      status: "Verified" | "Flagged"
      flag_reason: string | null
      employee_name: string
      timestamp: string
    }
  | { phase: "error"; message: string }

function ScanPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<ScanState>({ phase: "loading" })
  const [coords, setCoords] = useState<{ lat: number; long: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Get geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported")
      setState({ phase: "waiting" })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, long: pos.coords.longitude })
        setState({ phase: "waiting" })
      },
      (err) => {
        setLocationError(
          err.code === 1
            ? "Location access denied — attendance may be flagged"
            : "Could not get location"
        )
        setState({ phase: "waiting" })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleVerify = useCallback(
    async (token: string) => {
      setState({ phase: "submitting" })

      const result = await verifyAndRecordAttendance({
        token,
        lat: coords?.lat ?? 0,
        long: coords?.long ?? 0,
      })

      if (result.error) {
        setState({ phase: "error", message: result.error })
        return
      }

      if (result.data) {
        setState({ phase: "success", ...result.data })
      }
    },
    [coords]
  )

  // Auto-process if token comes from native camera scan (URL param)
  useEffect(() => {
    const urlToken = searchParams.get("token")
    if (urlToken && state.phase === "waiting") {
      handleVerify(urlToken)
    }
  }, [state.phase, searchParams, handleVerify])

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">Mark Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan the kiosk QR code with your phone camera
        </p>
      </div>

      {/* Location status */}
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0" />
        {locationError ? (
          <span className="text-amber-600">{locationError}</span>
        ) : coords ? (
          <span className="text-emerald-600">Location acquired</span>
        ) : (
          <span className="text-muted-foreground">Acquiring location…</span>
        )}
      </div>

      {/* Loading */}
      {state.phase === "loading" && (
        <Card>
          <CardContent className="flex h-48 items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Waiting — instructions */}
      {state.phase === "waiting" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
            <div className="rounded-2xl bg-muted p-5">
              <Camera className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Open your phone camera</p>
              <p className="text-sm text-muted-foreground">
                Point it at the QR code on the kiosk screen. It will open this page with your attendance automatically recorded.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              <span>The QR code refreshes every 10 seconds</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submitting */}
      {state.phase === "submitting" && (
        <Card>
          <CardContent className="flex h-48 flex-col items-center justify-center gap-3 p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying…</p>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {state.phase === "success" && (
        <Card className="border-emerald-500/30 bg-emerald-50">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <div>
              <p className="text-lg font-bold text-emerald-800">
                Marked {state.type} ✓
              </p>
              <p className="text-sm text-emerald-700">{state.employee_name}</p>
              <p className="mt-1 text-xs text-emerald-600">
                {new Date(state.timestamp).toLocaleString("en-IN")}
              </p>
            </div>
            {state.status === "Flagged" && state.flag_reason && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-left text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{state.flag_reason}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setState({ phase: "waiting" })}
            >
              Mark Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {state.phase === "error" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-destructive">{state.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState({ phase: "waiting" })}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ScanPageInner />
    </Suspense>
  )
}
