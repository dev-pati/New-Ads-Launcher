const ACCOUNT_STATUS: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled",
  7: "Pending risk review",
  8: "Pending settlement",
  9: "In grace period",
  100: "Pending closure",
  101: "Closed",
}

const DISABLE_REASONS: Record<number, string> = {
  0: "None",
  1: "Ads integrity policy",
  2: "Ads IP review",
  3: "Payment risk",
  4: "Gray account shutdown",
  5: "Ads AFC review",
  6: "Business integrity review",
  7: "Permanently closed",
  8: "Unused reseller account",
  9: "Unused account",
  10: "Umbrella ad account",
  11: "Business Manager integrity policy",
  12: "Misrepresented ad account",
  13: "Legal entity deshare",
  14: "Contextual thread review",
  15: "Compromised ad account",
}

export function describeAccountHealth(statusCode: number, disableReasonCode: number) {
  return {
    status: ACCOUNT_STATUS[statusCode] || `Status ${statusCode}`,
    disableReason: DISABLE_REASONS[disableReasonCode] || `Reason ${disableReasonCode}`,
    healthy: statusCode === 1 && disableReasonCode === 0,
  }
}
