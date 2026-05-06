"use client"

import { useRef, useState } from "react"
import { IconPhoto, IconVideo, IconLoader2 } from "@tabler/icons-react"

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
  const metaThumb = (creative.fb_thumbnail_url && /^https?:/.test(creative.fb_thumbnail_url) && !creative.fb_thumbnail_url.includes("rsrc.php")) 
    ? creative.fb_thumbnail_url 
    : (creative.fb_image_url && /^https?:/.test(creative.fb_image_url)) 
      ? creative.fb_image_url 
      : (creative.file_url && /^https?:/.test(creative.file_url) && !isVideoFile(creative.file_url)) 
        ? creative.file_url 
        : null

  if (!isVideo) {
    const imgSrc = creative.fb_image_url || creative.fb_thumbnail_url || videoSrc
    return imgSrc && !imgFailed ? (
      <img src={imgSrc} alt={creative.file_name} className={className} onError={() => setImgFailed(true)} />
    ) : (
      <div className={`${className} flex items-center justify-center bg-muted`}>
        <IconPhoto className="size-6 text-muted-foreground/40" />
      </div>
    )
  }

  const playable = videoSrc && /^(blob|data|https?):/.test(videoSrc) && isVideoFile(videoSrc)

  if (playable) {
    // Compact mode (list rows): only load first frame as poster initially.
    // Hover triggers play (loads full video on demand) — only the hovered video loads,
    // so 30+ rows don't all decode at once.
    if (compact) {
      return (
        <video
          ref={videoRef}
          src={videoSrc + (videoSrc.includes("#t=") ? "" : "#t=0.1")}
          muted
          playsInline
          loop
          preload="metadata"
          poster={metaThumb || undefined}
          className={className}
          onMouseEnter={e => {
            const v = e.currentTarget
            // Switch preload to auto on demand so the video can actually play
            if (v.preload !== "auto") v.preload = "auto"
            v.play().catch(() => {})
          }}
          onMouseLeave={e => {
            const v = e.currentTarget
            v.pause()
            try { v.currentTime = 0 } catch {}
          }}
        />
      )
    }
    return (
      <video
        ref={videoRef}
        src={videoSrc ? (videoSrc + (videoSrc.includes("#t=") ? "" : "#t=0.1")) : undefined}
        muted
        playsInline
        loop
        autoPlay
        preload="auto"
        poster={metaThumb || undefined}
        className={className}
        onLoadedData={() => {
          if (videoRef.current) {
            try { videoRef.current.pause() } catch {}
          }
        }}
        onMouseEnter={() => videoRef.current?.play().catch(() => {})}
        onMouseLeave={() => {
          if (videoRef.current) {
            videoRef.current.pause()
            try { videoRef.current.currentTime = 0 } catch {}
          }
        }}
      />
    )
  }

  if (metaThumb && !imgFailed) {
    return <img src={metaThumb} alt={creative.file_name} className={className} onError={() => setImgFailed(true)} />
  }

  if (creative.fb_video_id) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-1.5 bg-muted`}>
        <IconLoader2 className={`${compact ? "size-3" : "size-5"} text-muted-foreground/40 animate-spin`} />
        {!compact && <span className="text-[10px] text-muted-foreground/60">Generating preview…</span>}
      </div>
    )
  }

  return (
    <div className={`${className} flex items-center justify-center bg-muted`}>
      <IconVideo className={`${compact ? "size-3.5" : "size-6"} text-muted-foreground/40`} />
    </div>
  )
}
