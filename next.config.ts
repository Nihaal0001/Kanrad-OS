import type { NextConfig } from "next";

const SUPABASE_HOST = "spwighzxkaeibutmijus.supabase.co"

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Allow microphone for the voice chat widget; block everything else
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          // Finding #1 — Content-Security-Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for hydration; unsafe-eval for dev HMR
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "media-src 'self' blob: data:",
              // Supabase REST + Auth + Storage, Gemini, Sarvam
              `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://generativelanguage.googleapis.com https://api.sarvam.ai`,
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
