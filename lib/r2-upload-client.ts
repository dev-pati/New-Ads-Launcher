export interface InitUploadParams {
  orgId: string
  actorId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export async function initR2Upload(params: InitUploadParams, idempotencyKey: string) {
  const portalApiBase = process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"
  const token = process.env.ADS_MEDIA_API_TOKEN
  if (!token) throw new Error("Missing ADS_MEDIA_API_TOKEN")

  const res = await fetch(`${portalApiBase}/api/integrations/ads/v1/media/uploads/init`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Failed to init upload")
  }
  return res.json()
}

export async function completeR2Upload(assetId: string, orgId: string, actorId: string, parts?: { partNumber: number; etag: string }[]) {
  const portalApiBase = process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"
  const token = process.env.ADS_MEDIA_API_TOKEN
  if (!token) throw new Error("Missing ADS_MEDIA_API_TOKEN")

  const body: any = { orgId, actorId, assetId }
  if (parts) body.parts = parts

  const res = await fetch(`${portalApiBase}/api/integrations/ads/v1/media/uploads/complete`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Failed to complete upload")
  }
  return res.json() // returns { descriptor }
}
