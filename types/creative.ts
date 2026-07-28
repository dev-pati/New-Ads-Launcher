export interface Creative {
  id: string
  file_name: string
  file_url: string
  media_type: "image" | "video"
  headline?: string
  primary_text?: string
  cta?: string
  link_url?: string
  fb_image_url?: string
  fb_thumbnail_url?: string
  fb_image_hash?: string
  fb_video_id?: string
  created_at?: string
  transcript?: string
  tags?: string[]
  status?: "pending" | "processing" | "ready" | "error"
  storage_path?: string | null
  ad_account_id?: string
}
