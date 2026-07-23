import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

function decodeSignedRequest(signedRequest: string): any {
  try {
    const [encodedSig, payload] = signedRequest.split('.')
    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex')
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    
    const appSecret = process.env.FACEBOOK_APP_SECRET
    if (!appSecret) {
      console.error("FACEBOOK_APP_SECRET is not set")
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
    
    // Inactivate or delete the connection. 
    // Usually Deauthorize = "remove active status, stop trying to use it"
    await supabase
      .from("facebook_connections")
      .update({ is_active: false })
      .eq("fb_user_id", fbUserId)
      
    console.log(`Deauthorized FB connection for fb_user_id: ${fbUserId}`)
        
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Facebook deauthorize callback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
