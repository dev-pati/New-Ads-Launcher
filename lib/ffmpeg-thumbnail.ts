import { readFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

// Lazily load fluent-ffmpeg + ffmpeg-static so missing binaries don't crash the module.
let _ffmpegReady = false
let _Ffmpeg: any = null

async function getFfmpeg(): Promise<any | null> {
  if (_ffmpegReady) return _Ffmpeg
  _ffmpegReady = true
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>
    const [{ default: Ffmpeg }, { default: ffmpegPath }] = await Promise.all([
      dynamicImport("fluent-ffmpeg"),
      dynamicImport("ffmpeg-static"),
    ])
    if (ffmpegPath) Ffmpeg.setFfmpegPath(ffmpegPath)
    _Ffmpeg = Ffmpeg
    return _Ffmpeg
  } catch (err) {
    console.warn("[ffmpeg-thumbnail] fluent-ffmpeg or ffmpeg-static not available:", err)
    return null
  }
}

// Extract the first video frame (at ~1 second) from a publicly accessible URL.
// Returns a JPEG buffer, or null if FFmpeg is unavailable or extraction fails.
export async function extractThumbnailFromUrl(videoUrl: string): Promise<Buffer | null> {
  const Ffmpeg = await getFfmpeg()
  if (!Ffmpeg) return null

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const tmpOut = join(tmpdir(), `thumb-${id}.jpg`)

  try {
    await new Promise<void>((resolve, reject) => {
      Ffmpeg(videoUrl)
        .inputOptions(["-ss 00:00:01"])   // keyframe seek before reading — fast for HTTP
        .outputOptions(["-frames:v 1", "-q:v 2"])
        .output(tmpOut)
        .on("end", resolve)
        .on("error", (err: Error) => reject(err))
        .run()
    })

    return await readFile(tmpOut)
  } catch (err) {
    console.error("[ffmpeg-thumbnail] extraction failed:", err)
    return null
  } finally {
    unlink(tmpOut).catch(() => {})
  }
}
