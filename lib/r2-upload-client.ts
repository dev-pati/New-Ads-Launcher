export interface InitUploadParams {
  orgId: string
  actorId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface PortalUploadError extends Error {
  status?: number
}

function portalBase() {
  return process.env.CREATIVE_MEDIA_API_ORIGIN || "https://creative.patigroup.com"
}

function portalToken(): string {
  const token = process.env.ADS_MEDIA_API_TOKEN
  if (!token) {
    const err = new Error("Missing ADS_MEDIA_API_TOKEN") as PortalUploadError
    err.status = 503
    throw err
  }
  return token
}

async function portalJson(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}))
  const err = new Error(data?.error || fallback) as PortalUploadError
  err.status = res.status
  throw err
}

export async function initR2Upload(params: InitUploadParams, idempotencyKey: string) {
  const res = await fetch(`${portalBase()}/api/integrations/ads/v1/media/uploads/init`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${portalToken()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) await portalJson(res, "Failed to init upload")
  return res.json()
}

export async function signR2Upload(orgId: string, actorId: string, assetId: string) {
  const res = await fetch(`${portalBase()}/api/integrations/ads/v1/media/uploads/sign`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${portalToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orgId, actorId, assetId }),
  })

  if (!res.ok) await portalJson(res, "Failed to sign upload")
  return res.json()
}

export async function signR2UploadPart(orgId: string, actorId: string, assetId: string, partNumber: number) {
  const res = await fetch(`${portalBase()}/api/integrations/ads/v1/media/uploads/sign-part`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${portalToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orgId, actorId, assetId, partNumber }),
  })

  if (!res.ok) await portalJson(res, "Failed to sign upload part")
  return res.json()
}

export async function completeR2Upload(
  assetId: string,
  orgId: string,
  actorId: string,
  parts?: { partNumber: number; etag: string }[]
) {
  const body: Record<string, unknown> = { orgId, actorId, assetId }
  if (parts) body.parts = parts

  const res = await fetch(`${portalBase()}/api/integrations/ads/v1/media/uploads/complete`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${portalToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) await portalJson(res, "Failed to complete upload")
  return res.json() // { descriptor }
}

