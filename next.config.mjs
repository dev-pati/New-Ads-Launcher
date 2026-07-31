import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["xlsx"],
  // TEMPORARILY disabled: prevents useEffect double-firing in dev mode
  // → halves Meta API calls during development. Re-enable for production.
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "1gb",
    },
    // Allow large video uploads via raw binary body (POST /api/creatives/upload-binary).
    // Default is 10MB which truncates videos → Meta receives corrupt file → no thumbnail.
    proxyClientMaxBodySize: "1gb",
  },
}

export default withSentryConfig(nextConfig, {
  // Only upload source maps in production builds with a SENTRY_AUTH_TOKEN.
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})

