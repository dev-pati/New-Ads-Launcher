/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["xlsx"],
  // TEMPORARILY disabled: prevents useEffect double-firing in dev mode
  // → halves Meta API calls during development. Re-enable for production.
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
}

export default nextConfig
