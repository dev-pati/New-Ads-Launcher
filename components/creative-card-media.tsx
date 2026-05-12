"use client"
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react"
import { IconPhoto, IconVideo, IconLoader2, IconBrandGoogleDrive } from "@tabler/icons-react"
import { isMetaCdnUrl } from "@/lib/creative-media"

interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  fb_image_url?: string
  fb_thumbnail_url?: string
  fb_video_id?: string
}

export function CreativeCardMedia({ creative, className = "h-full w-full object-cover", compact = false }: { creative: Creative, className?: string, compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [imgFailed, setImgFailed] = useState(false)
  const isVideo = creative.media_type === "video"

  const isVideoFile = (url: string) => {
    const ext = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"]
    return ext.some(e => url.toLowerCase().includes(e)) || url.startsWith("blob:") || url.includes("fbcdn.net")
  }

  const videoSrc = creative.file_url || ""
  const isGDrive = videoSrc.includes("#gdrive")
  const cleanVideoSrc = videoSrc.replace("#gdrive", "")
  const stableImageUrl =
    creative.file_url && /^https?:/.test(cleanVideoSrc) && !isVideoFile(cleanVideoSrc) && !isMetaCdnUrl(cleanVideoSrc)
      ? cleanVideoSrc
      : null
  const metaThumb = stableImageUrl
    || ((creative.fb_thumbnail_url && /^https?:/.test(creative.fb_thumbnail_url) && !creative.fb_thumbnail_url.includes("rsrc.php"))
      ? creative.fb_thumbnail_url
      : (creative.fb_image_url && /^https?:/.test(creative.fb_image_url))
        ? creative.fb_image_url
        : (creative.file_url && /^https?:/.test(creative.file_url) && !isVideoFile(creative.file_url))
          ? creative.file_url
          : null)

  if (!isVideo) {
    const imgSrc = stableImageUrl || creative.fb_image_url || creative.fb_thumbnail_url || cleanVideoSrc
    return (
      <div className="relative h-full w-full">
        {imgSrc && !imgFailed ? (
          <img src={imgSrc} alt={creative.file_name} className={className} onError={() => setImgFailed(true)} />
        ) : (
          <div className={`${className} flex items-center justify-center bg-muted`}>
            <IconPhoto className="size-6 text-muted-foreground/40" />
          </div>
        )}
        {isGDrive && (
          <div className="absolute bottom-1.5 right-1.5 rounded bg-white p-0.5 shadow-sm">
            <IconBrandGoogleDrive className="size-3.5 text-[#4285F4]" />
          </div>
        )}
      </div>
    )
  }

  const playable = cleanVideoSrc && (/^(blob|data|https?):/.test(cleanVideoSrc) || cleanVideoSrc.startsWith("/")) && (isVideoFile(cleanVideoSrc) || isVideo)

  if (playable) {
    if (compact) {
      return (
        <div className="relative h-full w-full bg-muted/30">
          <video
            ref={videoRef}
            src={cleanVideoSrc + (cleanVideoSrc.includes("#t=") ? "" : "#t=0.1")}
            muted
            playsInline
            loop
            preload="metadata"
            poster={metaThumb || undefined}
            className={className}
            onMouseEnter={e => {
              const v = e.currentTarget
              if (v.preload !== "auto") v.preload = "auto"
              v.play().catch(() => {})
            }}
            onMouseLeave={e => {
              const v = e.currentTarget
              v.pause()
              try { v.currentTime = 0 } catch {}
            }}
          />
          {isGDrive && (
            <div className="absolute bottom-1 right-1 rounded bg-white/90 p-0.5 shadow-sm">
              <IconBrandGoogleDrive className="size-3 text-[#4285F4]" />
            </div>
          )}
          {!metaThumb && !cleanVideoSrc.includes("fbcdn.net") && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <IconVideo className="size-4 text-muted-foreground/20" />
             </div>
          )}
        </div>
      )
    }
    return (
      <div className="relative h-full w-full bg-muted/30">
        <video
          ref={videoRef}
          src={cleanVideoSrc ? (cleanVideoSrc + (cleanVideoSrc.includes("#t=") ? "" : "#t=0.1")) : undefined}
          muted
          playsInline
          loop
          preload="none"
          poster={metaThumb || undefined}
          className={className}
          onLoadedData={() => {
            if (videoRef.current) {
              try { videoRef.current.pause() } catch {}
            }
          }}
          onMouseEnter={e => {
            const v = e.currentTarget
            if (v.preload !== "auto") v.preload = "auto"
            v.play().catch(() => {})
          }}
          onMouseLeave={() => {
            if (videoRef.current) {
              videoRef.current.pause()
              try { videoRef.current.currentTime = 0 } catch {}
            }
          }}
        />
        {isGDrive && (
          <div className="absolute bottom-1.5 right-1.5 rounded bg-white/90 p-1 shadow-sm backdrop-blur-sm">
            <IconBrandGoogleDrive className="size-4 text-[#4285F4]" />
          </div>
        )}
        {!metaThumb && !cleanVideoSrc.includes("fbcdn.net") && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <IconVideo className="size-6 text-muted-foreground/20" />
           </div>
        )}
      </div>
    )
  }

  if (metaThumb && !imgFailed) {
    return (
      <div className="relative h-full w-full">
        <img src={metaThumb} alt={creative.file_name} className={className} onError={() => setImgFailed(true)} />
        {isGDrive && (
          <div className="absolute bottom-1.5 right-1.5 rounded bg-white/90 p-1 shadow-sm backdrop-blur-sm">
            <IconBrandGoogleDrive className="size-4 text-[#4285F4]" />
          </div>
        )}
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-1.5 bg-muted`}>
        {creative.fb_video_id ? (
          <>
            <IconLoader2 className={`${compact ? "size-3" : "size-5"} text-muted-foreground/40 animate-spin`} />
            {!compact && <span className="text-[10px] text-muted-foreground/60">Generating preview…</span>}
          </>
        ) : (
          <IconVideo className={`${compact ? "size-3.5" : "size-6"} text-muted-foreground/40`} />
        )}
      </div>
    )
  }

  return (
    <div className={`${className} flex items-center justify-center bg-muted`}>
      <IconPhoto className={`${compact ? "size-3.5" : "size-6"} text-muted-foreground/40`} />
    </div>
  )
}
