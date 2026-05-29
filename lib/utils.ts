import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FB_CDN_PATTERNS = ["fbcdn.net", "scontent", "fbsbx.com", "cdninstagram.com"]

/** Returns proxied URL for Facebook CDN images to avoid 403 browser errors */
export function proxyFbImage(url: string | null | undefined): string {
  if (!url) return ""
  try {
    const { hostname } = new URL(url)
    if (FB_CDN_PATTERNS.some(p => hostname.includes(p))) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`
    }
  } catch {}
  return url
}
