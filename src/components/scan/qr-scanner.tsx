"use client"

import { useEffect, useRef } from "react"

interface QrScannerProps {
  onScan: (result: string) => void
}

export function QrScanner({ onScan }: QrScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null)
  const scannedRef = useRef(false)

  useEffect(() => {
    const elementId = "qr-reader"
    let scanner: import("html5-qrcode").Html5Qrcode

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (scannedRef.current) return
            scannedRef.current = true
            onScan(decodedText)
            scanner.stop().catch(() => {})
          },
          () => {}
        )
        .catch((err) => {
          console.error("Failed to start QR scanner:", err)
        })
    })

    return () => {
      scannerRef.current?.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overflow-hidden rounded-xl">
      <div id="qr-reader" style={{ width: "100%" }} />
    </div>
  )
}
