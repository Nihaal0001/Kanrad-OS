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
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: "#0a0906" }}>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full opacity-20"
          style={{
            width: 600, height: 600, top: -200, left: -150,
            background: "radial-gradient(circle, #c2622a 0%, transparent 70%)",
            animation: "pulse 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full opacity-10"
          style={{
            width: 400, height: 400, bottom: -100, right: -100,
            background: "radial-gradient(circle, #e8843a 0%, transparent 70%)",
            animation: "pulse 12s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute rounded-full opacity-10"
          style={{
            width: 300, height: 300, top: "50%", left: "35%",
            background: "radial-gradient(circle, #c2622a 0%, transparent 70%)",
            animation: "pulse 10s ease-in-out infinite 2s",
          }}
        />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "linear-gradient(#c2622a 1px, transparent 1px), linear-gradient(90deg, #c2622a 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Left panel — branding */}
      <div className="relative hidden lg:flex lg:w-[55%] flex-col justify-between p-16">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #c2622a, #a04e20)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-white tracking-widest">KANRAD</span>
        </div>

        {/* Center illustration area */}
        <div className="flex flex-col items-start gap-8">
          {/* Abstract cookware visual */}
          <div className="relative w-80 h-80">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full opacity-10" style={{ border: "1px solid #c2622a" }} />
            <div className="absolute inset-6 rounded-full opacity-15" style={{ border: "1px solid #c2622a" }} />
            <div className="absolute inset-12 rounded-full opacity-20" style={{ border: "1px solid #c2622a" }} />

            {/* Center pot silhouette */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                {/* Pot body */}
                <path d="M25 45 Q20 45 20 52 L24 95 Q24 100 30 100 L90 100 Q96 100 96 95 L100 52 Q100 45 95 45 Z" fill="#c2622a" fillOpacity="0.25" stroke="#c2622a" strokeOpacity="0.5" strokeWidth="1.5"/>
                {/* Lid */}
                <path d="M22 45 Q22 38 60 38 Q98 38 98 45 Z" fill="#c2622a" fillOpacity="0.35" stroke="#c2622a" strokeOpacity="0.6" strokeWidth="1.5"/>
                {/* Lid knob */}
                <rect x="52" y="30" width="16" height="10" rx="5" fill="#c2622a" fillOpacity="0.5" stroke="#c2622a" strokeOpacity="0.7" strokeWidth="1.5"/>
                {/* Handles */}
                <path d="M20 58 Q8 58 8 68 Q8 78 20 78" stroke="#c2622a" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" fill="none"/>
                <path d="M100 58 Q112 58 112 68 Q112 78 100 78" stroke="#c2622a" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" fill="none"/>
                {/* Shine */}
                <path d="M35 55 Q45 52 55 55" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
            </div>

            {/* Floating stat cards */}
            <div className="absolute -right-8 top-8 rounded-xl px-4 py-3 text-white" style={{ background: "rgba(194,98,42,0.15)", border: "1px solid rgba(194,98,42,0.2)", backdropFilter: "blur(10px)" }}>
              <p className="text-xs text-[#a89070]">Today's Orders</p>
              <p className="text-2xl font-bold">24</p>
            </div>
            <div className="absolute -left-8 bottom-16 rounded-xl px-4 py-3 text-white" style={{ background: "rgba(194,98,42,0.15)", border: "1px solid rgba(194,98,42,0.2)", backdropFilter: "blur(10px)" }}>
              <p className="text-xs text-[#a89070]">In Production</p>
              <p className="text-2xl font-bold">8</p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Manufacturing,<br />
              <span style={{ color: "#c2622a" }}>simplified.</span>
            </h1>
            <p className="text-[#7a6a55] text-lg leading-relaxed max-w-xs">
              Your complete factory management system — orders, production, inventory, and finance in one place.
            </p>
          </div>
        </div>

        <p className="text-xs text-[#3a3028]">© {new Date().getFullYear()} Kanrad Houseware. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="relative flex w-full lg:w-[45%] items-center justify-center px-6 py-12">

        {/* Vertical divider (desktop) */}
        <div className="absolute left-0 top-16 bottom-16 w-px hidden lg:block" style={{ background: "linear-gradient(to bottom, transparent, rgba(194,98,42,0.2), transparent)" }} />

        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #c2622a, #a04e20)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-widest">KANRAD</span>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8 space-y-6"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 0 80px rgba(194,98,42,0.06), 0 32px 64px rgba(0,0,0,0.5)",
            }}
          >
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-sm" style={{ color: "#6a5a48" }}>Sign in to your workspace</p>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "#6a5a48" }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@kanrad.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-12 w-full rounded-xl px-4 text-sm text-white placeholder:text-[#3a3028] transition-all focus-visible:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(194,98,42,0.6)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "#6a5a48" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex h-12 w-full rounded-xl px-4 pr-12 text-sm text-white placeholder:text-[#3a3028] transition-all focus-visible:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(194,98,42,0.6)")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                    style={{ color: "#4a3f30" }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#c2622a")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#4a3f30")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="relative h-12 w-full rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
                style={{
                  background: loading ? "#7a3d18" : "linear-gradient(135deg, #c2622a 0%, #a04e20 100%)",
                  boxShadow: loading ? "none" : "0 4px 24px rgba(194,98,42,0.4)",
                }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: "#3a3028" }}>
            Contact your administrator to get access.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.25; }
        }
      `}</style>
    </div>
  )
}
