import { AdAccountsManager } from "@/components/ad-accounts/AdAccountsManager"

export default function AdAccountsPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#F1F4F7]">
      <div className="border-b border-[#DEE3E9] bg-white px-7 py-5">
        <h1 className="font-heading text-xl font-bold leading-tight text-[#1C2B33]">Ad Accounts</h1>
        <p className="mt-1 text-sm leading-5 text-[#5D6C7B]">
          Manage connected Meta ad accounts, ownership, spend caps, and sync snapshots.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-7 py-6">
        <AdAccountsManager />
      </div>
    </div>
  )
}
