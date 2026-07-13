"use client"

import { useState, useRef, useEffect } from "react"
import {
  IconPlayerPlay, IconPlayerPause,
  IconChevronLeft, IconChevronRight, IconExternalLink,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { DiscoveryAd } from "@/types/inspo"

// Meta wordmark SVG inline (small)
function MetaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
    </svg>
  )
}

interface Props {
  ad: DiscoveryAd
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}

export function AdMediaPreview({ ad, hasPrev, hasNext, onPrev, onNext }: Props) {
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const isVideo = ad.mediaType === "video"
  const isRealVideoUrl = ad.mediaUrl.match(/\.(mp4|webm|mov|avi)(\?|$)/i)
  const previewUrl = ad.adSnapshotUrl || ad.mediaUrl
  const isThumbnailOnlyVideo = isVideo && !isRealVideoUrl

  // Reset play state when ad changes
  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [ad.id])

  function togglePlay() {
    const v = videoRef.current
    if (!v) {
      // Mock: just toggle visual state since picsum is not a real video
      setPlaying(p => !p)
      return
    }
    if (playing) { v.pause(); setPlaying(false) }
    else         { v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)) }
  }

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative">

      {/* Media area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-12 py-8 relative">

        {isVideo && isRealVideoUrl ? (
          <div className="relative max-h-full max-w-sm w-full">
            <video
              ref={videoRef}
              src={ad.mediaUrl}
              className="max-h-[65vh] w-full object-contain rounded-xl shadow-2xl"
              onTimeUpdate={e => {
                const v = e.currentTarget
                if (v.duration) setProgress(v.currentTime / v.duration * 100)
              }}
              onEnded={() => { setPlaying(false); setProgress(0) }}
              playsInline
            />
          </div>
        ) : (
          <div className={cn("relative max-h-full", isVideo ? "max-w-sm w-full" : "max-w-2xl w-full")}>
            <img
              src={ad.mediaUrl}
              alt={ad.headline || ad.brandName}
              className={cn(
                "object-contain rounded-xl shadow-2xl mx-auto",
                isVideo ? "max-h-[65vh] w-full" : "max-h-[75vh]"
              )}
            />

            {/* Video overlay for non-real-video mediaType */}
            {isVideo && (
              <button
                onClick={() => {
                  if (isThumbnailOnlyVideo) window.open(previewUrl, "_blank")
                  else togglePlay()
                }}
                className="absolute inset-0 flex items-center justify-center group"
                title={isThumbnailOnlyVideo ? "Open video in Meta Ad Library" : "Play video"}
              >
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors rounded-xl" />

                {/* Duration badge */}
                {ad.duration && (
                  <span className="absolute top-3 left-3 bg-black/70 text-white text-xs font-mono font-medium px-2 py-0.5 rounded-md z-10">
                    {ad.duration}
                  </span>
                )}

                {/* Play/pause button */}
                <div className={cn(
                  "relative z-10 size-16 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center",
                  "transition-all duration-200 group-hover:scale-110 group-hover:bg-black/70"
                )}>
                  {isThumbnailOnlyVideo
                    ? <IconExternalLink className="size-7 text-white" />
                    : playing
                    ? <IconPlayerPause className="size-7 text-white fill-white" />
                    : <IconPlayerPlay  className="size-7 text-white fill-white ml-1" />
                  }
                </div>
              </button>
            )}
          </div>
        )}

        {/* Real video progress bar */}
        {isVideo && isRealVideoUrl && (
          <div className="absolute bottom-20 left-12 right-12 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/80 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Prev arrow */}
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full flex items-center justify-center transition-all",
          hasPrev
            ? "bg-white/10 hover:bg-white/25 text-white cursor-pointer"
            : "opacity-0 pointer-events-none"
        )}
      >
        <IconChevronLeft className="size-5" />
      </button>

      {/* Next arrow */}
      <button
        onClick={onNext}
        disabled={!hasNext}
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full flex items-center justify-center transition-all",
          hasNext
            ? "bg-white/10 hover:bg-white/25 text-white cursor-pointer"
            : "opacity-0 pointer-events-none"
        )}
      >
        <IconChevronRight className="size-5" />
      </button>

      {/* Bottom bar: Meta Preview */}
      <div className="flex items-center justify-center py-3 border-t border-white/10 shrink-0">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
        >
          {/* Meta infinity logo simplified */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 12c0-2.8-2-5-4.5-5S3 9.2 3 12s2 5 4.5 5c1.5 0 2.8-.7 3.7-1.8"/>
            <path d="M12 12c0 2.8 2 5 4.5 5S21 14.8 21 12s-2-5-4.5-5c-1.5 0-2.8.7-3.7 1.8"/>
          </svg>
          Meta Preview
        </a>
      </div>
    </div>
  )
}
