/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["xlsx"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
}

export default nextConfig
