"use client"

import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
    <div className="relative flex min-h-screen overflow-hidden bg-[#0f0e0c]">

      {/* Background texture / gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#2a1f0e_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#1a1208_0%,_transparent_60%)]" />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#c2622a 1px, transparent 1px), linear-gradient(90deg, #c2622a 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Left side — branding (hidden on mobile) */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-16">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#c2622a] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-dm-serif text-xl text-white tracking-wide">KANRAD</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-dm-serif text-5xl font-normal text-white leading-tight">
              Manufacturing,<br />
              <span className="text-[#c2622a]">simplified.</span>
            </h1>
            <p className="text-[#a89070] text-lg leading-relaxed max-w-sm">
              Manage orders, production, inventory, and finance — all in one place.
            </p>
          </div>

          <div className="flex gap-6 pt-2">
            {["Orders", "Production", "Finance", "Inventory"].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-[#c2622a]" />
                <span className="text-sm text-[#7a6a55]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#4a3f30]">© {new Date().getFullYear()} Kanrad Houseware</p>
      </div>

      {/* Right side — login form */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center px-6 py-12">

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-10">
            <div className="h-8 w-8 rounded-lg bg-[#c2622a] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-dm-serif text-lg text-white tracking-wide">KANRAD</span>
          </div>

          <div
            className="rounded-2xl p-8 space-y-7"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 0 60px rgba(194,98,42,0.08), 0 24px 48px rgba(0,0,0,0.4)",
            }}
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
              <p className="text-sm text-[#7a6a55]">Sign in to your workspace</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-medium uppercase tracking-widest text-[#7a6a55]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@kanrad.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-11 w-full rounded-xl px-4 py-2 text-sm text-white placeholder:text-[#4a3f30] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c2622a] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-medium uppercase tracking-widest text-[#7a6a55]">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-11 w-full rounded-xl px-4 py-2 text-sm text-white placeholder:text-[#4a3f30] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c2622a] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="relative h-11 w-full rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] overflow-hidden mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #c2622a 0%, #a04e20 100%)",
                  boxShadow: "0 4px 20px rgba(194,98,42,0.35)",
                }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-[#4a3f30]">
            Contact your administrator to create an account.
          </p>
        </div>
      </div>
    </div>
  )
}
