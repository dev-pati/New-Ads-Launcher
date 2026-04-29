"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IconBrandFacebook } from "@tabler/icons-react"

interface FacebookConnectProps {
  isConnected: boolean
  userName?: string
  userPicture?: string
  onDisconnect?: () => void
}

export function FacebookConnect({
  isConnected,
  userName,
  userPicture,
  onDisconnect,
}: FacebookConnectProps) {
  const handleConnect = () => {
    window.location.href = "/api/auth/facebook"
  }

  if (isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBrandFacebook className="size-5 text-[#1877F2]" />
            Connected to Meta
          </CardTitle>
          <CardDescription>
            Your Facebook account is connected and ready to manage ads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {userPicture && (
                <img
                  src={userPicture}
                  alt={userName || "User"}
                  className="size-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{userName}</p>
                <p className="text-sm text-muted-foreground">Facebook Account</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect to Meta</CardTitle>
        <CardDescription>
          Connect your Facebook account to access your ad accounts and pages to
          launch ads directly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleConnect}
          className="bg-[#1877F2] text-white hover:bg-[#166FE5]"
        >
          <IconBrandFacebook className="size-4" />
          Connect with Facebook
        </Button>
      </CardContent>
    </Card>
  )
}
