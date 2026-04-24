"use client"

import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Login failed")
      setLoading(false)
      return
    }

    window.location.href = "/"
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#080808" }}>

      {/* Left — champagne panel */}
      <div
        className="hidden lg:flex w-[42%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a1508 0%, #0e0b04 60%, #080808 100%)" }}
      >
        {/* Top-left glow */}
        <div className="absolute top-0 left-0 w-96 h-96 pointer-events-none" style={{
          background: "radial-gradient(circle at top left, rgba(212,175,90,0.18) 0%, transparent 65%)"
        }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D4AF5A, #A8862E)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="font-bold tracking-[0.2em] text-sm" style={{ color: "#D4AF5A" }}>KANRAD</span>
        </div>

        {/* Main text */}
        <div className="relative space-y-6">
          <div style={{ color: "rgba(212,175,90,0.15)", fontSize: 120, fontWeight: 900, lineHeight: 1, letterSpacing: "-4px", userSelect: "none" }}>
            ERP
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-bold text-white leading-snug">
              Run your factory<br />
              <span style={{ color: "#D4AF5A" }}>smarter.</span>
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(212,175,90,0.35)", maxWidth: 260 }}>
              Orders, production, inventory and finance — unified in one system.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-2.5 pt-2">
            {[
              "Real-time production tracking",
              "Purchase order management",
              "Inventory & stock control",
              "Finance & invoicing",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: "rgba(212,175,90,0.15)" }} />
                <span className="text-xs" style={{ color: "rgba(212,175,90,0.4)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs" style={{ color: "rgba(212,175,90,0.18)" }}>
          © {new Date().getFullYear()} Kanrad Houseware
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

        {/* Subtle champagne corner glow */}
        <div className="absolute bottom-0 right-0 w-96 h-96 pointer-events-none" style={{
          background: "radial-gradient(circle at bottom right, rgba(212,175,90,0.06) 0%, transparent 65%)"
        }} />

        <div className="w-full max-w-[360px] relative">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D4AF5A, #A8862E)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-bold tracking-[0.2em] text-sm" style={{ color: "#D4AF5A" }}>KANRAD</span>
          </div>

          {/* Heading */}
          <div className="mb-10 space-y-1">
            <h1 className="text-3xl font-bold text-white">Sign in</h1>
            <p className="text-sm" style={{ color: "rgba(212,175,90,0.3)" }}>
              Enter your credentials to continue
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl px-4 py-3 text-sm flex items-start gap-2.5" style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.18)",
              color: "#f87171",
            }}>
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(212,175,90,0.45)" }}>
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@kanrad.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-xl px-4 text-sm text-white outline-none transition-all"
                style={{
                  background: "rgba(212,175,90,0.04)",
                  border: "1px solid rgba(212,175,90,0.12)",
                  caretColor: "#D4AF5A",
                }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(212,175,90,0.4)"; e.target.style.background = "rgba(212,175,90,0.06)" }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(212,175,90,0.12)"; e.target.style.background = "rgba(212,175,90,0.04)" }}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(212,175,90,0.45)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl px-4 pr-12 text-sm text-white outline-none transition-all"
                  style={{
                    background: "rgba(212,175,90,0.04)",
                    border: "1px solid rgba(212,175,90,0.12)",
                    caretColor: "#D4AF5A",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(212,175,90,0.4)"; e.target.style.background = "rgba(212,175,90,0.06)" }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(212,175,90,0.12)"; e.target.style.background = "rgba(212,175,90,0.04)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-opacity"
                  style={{ color: "rgba(212,175,90,0.3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(212,175,90,0.7)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(212,175,90,0.3)")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full" style={{ background: "rgba(212,175,90,0.08)" }} />

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl text-sm font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #D4AF5A 0%, #A8862E 100%)",
                color: "#080808",
                boxShadow: loading ? "none" : "0 2px 20px rgba(212,175,90,0.2)",
              }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs" style={{ color: "rgba(212,175,90,0.18)" }}>
            Contact your administrator to get access.
          </p>
        </div>
      </div>
    </div>
  )
}
