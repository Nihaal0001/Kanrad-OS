"use client"

// Root-level error boundary — catches crashes in the root layout itself,
// where app/error.tsx can't. Must render its own <html>/<body> and can't
// rely on app components or global styles being available.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0d0d0d",
          color: "#fff",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Something went wrong</h2>
          <p style={{ margin: "0 0 4px", fontSize: 14, color: "#a3a3a3" }}>
            The app hit an unexpected error. Try again, or reload the page.
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#737373" }}>
              Error code: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #404040",
              background: "#171717",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
