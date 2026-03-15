"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { QrCode, RefreshCw, ArrowLeft } from "lucide-react"

export default function KioskPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(10)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    timerRef.current = null
    countdownRef.current = null
  }, [])

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
  }, [])

  const fetchToken = useCallback(async () => {
    if (document.visibilityState === "hidden") return
    try {
      const res = await fetch("/api/kiosk/token")
      const data = await res.json()
      setToken(data.token)
      setCountdown(Math.ceil(data.expiresIn / 1000))
      startCountdown()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fetchToken, data.expiresIn + 100)
    } catch {
      timerRef.current = setTimeout(fetchToken, 2000)
    }
  }, [startCountdown])

  useEffect(() => {
    fetchToken()

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Page became visible — fetch a fresh token immediately
        fetchToken()
      } else {
        // Page hidden — stop all timers and clear stale QR
        stopTimers()
        setToken(null)
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      stopTimers()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchToken, stopTimers])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const qrValue = token ? `${appUrl}/scan?token=${token}` : ""

  return (
    <div className="flex flex-col items-center gap-8 p-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-sm opacity-50 hover:opacity-100 transition-opacity"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Brand */}
      <div className="text-center">
        <h1 className="text-3xl font-serif font-bold tracking-tight">
          JUST CLOTHING
        </h1>
        <p className="mt-1 text-sm opacity-60">Attendance Kiosk</p>
      </div>

      {/* QR Code */}
      <div className="rounded-2xl bg-white p-6 shadow-2xl">
        {token ? (
          <QRCodeSVG
            value={qrValue}
            size={280}
            level="M"
            bgColor="#ffffff"
            fgColor="#1a1a1a"
          />
        ) : (
          <div className="flex h-[280px] w-[280px] items-center justify-center">
            <QrCode className="h-12 w-12 animate-pulse opacity-30" />
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">Scan to mark attendance</p>
        <p className="text-sm opacity-60">
          Open your phone camera and point it at the QR code
        </p>
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2 text-sm opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${countdown <= 2 ? "animate-spin" : ""}`} />
        <span>Refreshes in {countdown}s</span>
      </div>
    </div>
  )
}
