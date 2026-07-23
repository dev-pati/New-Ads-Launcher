import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

function decodeSignedRequest(signedRequest: string): any {
  try {
    const [encodedSig, payload] = signedRequest.split('.')
    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex')
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    
    // Validate signature
    const appSecret = process.env.META_APP_SECRET
    if (!appSecret) {
      console.error("META_APP_SECRET is not set for data deletion callback")
      return null
    }
    
    const expectedSig = crypto.createHmac('sha256', appSecret).update(payload).digest('hex')
    
    if (sig !== expectedSig) {
      console.error("Bad signature in Facebook signed_request")
      return null
    }
    
    return data
  } catch (err) {
    console.error("Failed to parse signed_request", err)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const signedRequest = formData.get("signed_request") as string
    
    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 })
    }
    
    const data = decodeSignedRequest(signedRequest)
    if (!data) {
      return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 })
    }
    
    const fbUserId = data.user_id
    if (!fbUserId) {
      return NextResponse.json({ error: "No user_id found in signed_request" }, { status: 400 })
    }
    
    const supabase = createAdminClient()
    
    // Find the connection(s)
    const { data: connections } = await supabase
      .from("facebook_connections")
      .select("id, org_id")
      .eq("fb_user_id", fbUserId)
      
    if (connections && connections.length > 0) {
      // Hard delete from db. Row level cascade handles related pages/ad_accounts if properly set up,
      // but explicitly deleting the connection token is the core compliance requirement.
      await supabase
        .from("facebook_connections")
        .delete()
        .eq("fb_user_id", fbUserId)
        
      console.log(`Deleted FB data for fb_user_id: ${fbUserId}`)
    }
    
    const confirmationCode = crypto.randomBytes(12).toString("hex")
    
    // Meta requires a JSON response with url and confirmation_code
    return NextResponse.json({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/privacy-policy?deleted=true`,
      confirmation_code: confirmationCode
    })
  } catch (error) {
    console.error("Facebook data deletion callback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
