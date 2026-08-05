import assert from "node:assert/strict"
import test from "node:test"
import { describeAccountHealth } from "./account-health"

test("only an active account without a disable reason is healthy", () => {
  assert.deepEqual(describeAccountHealth(1, 0), {
    status: "Active",
    disableReason: "None",
    healthy: true,
  })
  assert.deepEqual(describeAccountHealth(2, 1), {
    status: "Disabled",
    disableReason: "Ads integrity policy",
    healthy: false,
  })
})
