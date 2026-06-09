import type { NextConfig } from "next";

const SUPABASE_HOST = "bdskmkfubdmmzvntzzgu.supabase.co"

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 600,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Allow camera (QR scan), microphone (voice chat), geolocation (attendance)
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          // Finding #1 — Content-Security-Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for hydration; unsafe-eval only needed for dev HMR
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "media-src 'self' blob: data:",
              "worker-src 'self' blob:",
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
