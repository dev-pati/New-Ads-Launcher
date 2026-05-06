/** @type {import('next').NextConfig} */
const nextConfig = {
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
    middlewareClientMaxBodySize: "1gb",
  },
}

export default nextConfig
