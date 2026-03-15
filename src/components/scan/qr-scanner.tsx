"use client"

import { useEffect, useRef } from "react"
import { Html5Qrcode } from "html5-qrcode"

interface QrScannerProps {
  onScan: (result: string) => void
}

export function QrScanner({ onScan }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)

  useEffect(() => {
    const elementId = "qr-reader"

    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Only fire once per scan session
          if (scannedRef.current) return
          scannedRef.current = true
          onScan(decodedText)
          scanner.stop().catch(() => {})
        },
        () => {
          // Ignore per-frame decode errors (fires constantly when no QR visible)
        }
      )
      .catch((err) => {
        console.error("Failed to start QR scanner:", err)
      })

    return () => {
      scanner.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overflow-hidden rounded-xl">
      <div id="qr-reader" style={{ width: "100%" }} />
    </div>
  )
}
