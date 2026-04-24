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
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: "#080808" }}>

      {/* Champagne glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full" style={{
          width: 700, height: 700, top: -250, left: -200,
          background: "radial-gradient(circle, rgba(212,175,90,0.12) 0%, transparent 65%)",
          animation: "drift 12s ease-in-out infinite",
        }} />
        <div className="absolute rounded-full" style={{
          width: 500, height: 500, bottom: -150, right: -100,
          background: "radial-gradient(circle, rgba(212,175,90,0.08) 0%, transparent 65%)",
          animation: "drift 16s ease-in-out infinite reverse",
        }} />
      </div>

      {/* Subtle dot grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(circle, rgba(212,175,90,0.12) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
        opacity: 0.4,
      }} />

      {/* Left panel */}
      <div className="relative hidden lg:flex lg:w-[55%] flex-col justify-between p-16">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D4AF5A 0%, #A8862E 100%)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-xl font-bold tracking-widest" style={{ color: "#D4AF5A" }}>KANRAD</span>
        </div>

        {/* Center content */}
        <div className="space-y-10">
          {/* Large decorative element */}
          <div className="relative w-72 h-72">
            {[0, 20, 40, 60].map((inset) => (
              <div key={inset} className="absolute rounded-full" style={{
                inset,
                border: `1px solid rgba(212,175,90,${0.06 + inset * 0.003})`,
                animation: `spin ${20 + inset}s linear infinite ${inset % 2 === 0 ? "" : "reverse"}`,
              }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="110" height="110" viewBox="0 0 120 120" fill="none">
                <path d="M25 45 Q20 45 20 52 L24 95 Q24 100 30 100 L90 100 Q96 100 96 95 L100 52 Q100 45 95 45 Z"
                  fill="rgba(212,175,90,0.1)" stroke="rgba(212,175,90,0.4)" strokeWidth="1.5"/>
                <path d="M22 45 Q22 38 60 38 Q98 38 98 45 Z"
                  fill="rgba(212,175,90,0.15)" stroke="rgba(212,175,90,0.5)" strokeWidth="1.5"/>
                <rect x="52" y="29" width="16" height="11" rx="5"
                  fill="rgba(212,175,90,0.2)" stroke="rgba(212,175,90,0.6)" strokeWidth="1.5"/>
                <path d="M20 58 Q8 58 8 68 Q8 78 20 78" stroke="rgba(212,175,90,0.4)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M100 58 Q112 58 112 68 Q112 78 100 78" stroke="rgba(212,175,90,0.4)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M36 55 Q48 51 58 55" stroke="rgba(212,175,90,0.3)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
            </div>

            {/* Floating chips */}
            <div className="absolute -right-12 top-4 rounded-xl px-4 py-3" style={{ background: "rgba(212,175,90,0.08)", border: "1px solid rgba(212,175,90,0.15)", backdropFilter: "blur(12px)" }}>
              <p className="text-xs mb-1" style={{ color: "rgba(212,175,90,0.5)" }}>Active Orders</p>
              <p className="text-2xl font-bold" style={{ color: "#D4AF5A" }}>24</p>
            </div>
            <div className="absolute -left-12 bottom-10 rounded-xl px-4 py-3" style={{ background: "rgba(212,175,90,0.08)", border: "1px solid rgba(212,175,90,0.15)", backdropFilter: "blur(12px)" }}>
              <p className="text-xs mb-1" style={{ color: "rgba(212,175,90,0.5)" }}>In Production</p>
              <p className="text-2xl font-bold" style={{ color: "#D4AF5A" }}>8</p>
            </div>
          </div>

          <div className="space-y-4 max-w-sm">
            <h1 className="text-5xl font-bold leading-tight text-white">
              Factory<br />
              <span style={{ color: "#D4AF5A" }}>intelligence.</span>
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: "rgba(212,175,90,0.4)" }}>
              Manage orders, production, inventory, and finance — all in one place.
            </p>

            <div className="flex gap-4 pt-2">
              {["Orders", "Production", "Finance", "Inventory"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <div className="h-1 w-1 rounded-full" style={{ background: "#D4AF5A" }} />
                  <span className="text-xs" style={{ color: "rgba(212,175,90,0.35)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs" style={{ color: "rgba(212,175,90,0.2)" }}>
          © {new Date().getFullYear()} Kanrad Houseware
        </p>
      </div>

      {/* Divider */}
      <div className="absolute left-[55%] top-12 bottom-12 w-px hidden lg:block" style={{
        background: "linear-gradient(to bottom, transparent, rgba(212,175,90,0.15), transparent)"
      }} />

      {/* Right panel — form */}
      <div className="relative flex w-full lg:w-[45%] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-12">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D4AF5A 0%, #A8862E 100%)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-widest" style={{ color: "#D4AF5A" }}>KANRAD</span>
          </div>

          {/* Form card */}
          <div className="rounded-2xl p-8 space-y-7" style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(212,175,90,0.12)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 0 60px rgba(212,175,90,0.04), 0 40px 80px rgba(0,0,0,0.6)",
          }}>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-sm" style={{ color: "rgba(212,175,90,0.35)" }}>Sign in to your workspace</p>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5" style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171"
              }}>
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(212,175,90,0.4)" }}>
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@kanrad.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-12 w-full rounded-xl px-4 text-sm text-white placeholder:text-[#2a2a2a] transition-all outline-none"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,90,0.1)" }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,90,0.45)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(212,175,90,0.1)")}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(212,175,90,0.4)" }}>
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
                    className="flex h-12 w-full rounded-xl px-4 pr-12 text-sm text-white placeholder:text-[#2a2a2a] transition-all outline-none"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,90,0.1)" }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,90,0.45)")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(212,175,90,0.1)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: "rgba(212,175,90,0.3)" }}
                    onMouseEnter={(e) => ((e.currentTarget).style.color = "rgba(212,175,90,0.8)")}
                    onMouseLeave={(e) => ((e.currentTarget).style.color = "rgba(212,175,90,0.3)")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl text-sm font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                style={{
                  background: "linear-gradient(135deg, #D4AF5A 0%, #A8862E 100%)",
                  color: "#080808",
                  boxShadow: loading ? "none" : "0 4px 24px rgba(212,175,90,0.25)",
                }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: "rgba(212,175,90,0.2)" }}>
            Contact your administrator to get access.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
