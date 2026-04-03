import { createBrowserClient } from "@supabase/ssr"

const SUPABASE_URL = "https://bdskmkfubdmmzvntzzgu.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc2tta2Z1YmRtbXp2bnR6emd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjA0MTgsImV4cCI6MjA5MDMzNjQxOH0.ske_ZN9DDjA5XcnDXwwLaMNI3Pn0iXt2-eyPUB9hwzc"

export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  )
}
