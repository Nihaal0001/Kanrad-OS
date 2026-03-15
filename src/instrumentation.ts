/**
 * Next.js instrumentation hook — runs once at server startup.
 * Validates that all required environment variables are present
 * so the app fails fast with a clear message instead of a cryptic
 * runtime error when a key is missing on Vercel or in local dev.
 */
export async function register() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]

  // AI keys are optional — features degrade gracefully when absent
  const recommended = ["GEMINI_API_KEY", "SARVAM_API_KEY"]

  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Copy .env.example to .env.local and fill in the values."
    )
  }

  const missingRecommended = recommended.filter((k) => !process.env[k])
  if (missingRecommended.length > 0) {
    console.warn(
      `[JUST CLOTHING] AI features will be disabled — missing env vars: ${missingRecommended.join(", ")}`
    )
  }
}
