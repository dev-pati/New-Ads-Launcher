import assert from "node:assert/strict"
import test from "node:test"
import { notificationCategoryForType } from "./category"

test("maps every notification family to its inbox category", () => {
  assert.equal(notificationCategoryForType("ad.launch_failed"), "ads")
  assert.equal(notificationCategoryForType("campaign.updated"), "ads")
  assert.equal(notificationCategoryForType("member.role_changed"), "profiles")
  assert.equal(notificationCategoryForType("media.upload_completed"), "apps")
  assert.equal(notificationCategoryForType("automation.failed"), "apps")
  assert.equal(notificationCategoryForType("request.assigned"), "business")
  assert.equal(notificationCategoryForType("template.created"), "business")
})
