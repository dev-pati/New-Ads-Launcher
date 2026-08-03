import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  bulkDraftKey,
  orderedDrafts,
  parseBulkDrafts,
  removePublishedDrafts,
  stageBudgetDrafts,
  stageNameDrafts,
  stageStatusDrafts,
  type BulkEditableItem,
} from "../lib/ads-manager-bulk-drafts"

const campaign: BulkEditableItem = {
  id: "campaign-1",
  name: "Campaign 1",
  status: "PAUSED",
  daily_budget: "1000",
  budgetEligible: true,
}

const adSet: BulkEditableItem = {
  id: "adset-1",
  name: "Ad set 1",
  status: "ACTIVE",
  campaign_id: campaign.id,
  lifetime_budget: "5000",
  budgetEligible: true,
}

describe("Ads Manager bulk draft state", () => {
  it("stages status without mutating the live object and removes a reverted no-op", () => {
    const live = { ...campaign }
    const active = stageStatusDrafts({}, "campaign", [campaign], "ACTIVE")

    assert.equal(active[bulkDraftKey("campaign", campaign.id)].node.status, "ACTIVE")
    assert.deepEqual(campaign, live)

    const reverted = stageStatusDrafts(active, "campaign", [campaign], "PAUSED")
    assert.deepEqual(reverted, {})
  })

  it("preserves an existing status draft when a budget edit is added", () => {
    const statusDraft = stageStatusDrafts({}, "adset", [adSet], "PAUSED")
    const combined = stageBudgetDrafts(statusDraft, "adset", [adSet], 75.25)
    const node = combined[bulkDraftKey("adset", adSet.id)].node

    assert.equal(node.status, "PAUSED")
    assert.equal(node.lifetime_budget, "7525")
    assert.equal(node.daily_budget, undefined)
  })

  it("adds Name as a secondary edit on the same safe draft pipeline", () => {
    const named = stageNameDrafts({}, "campaign", [campaign], "Campaign renamed")
    assert.equal(named[bulkDraftKey("campaign", campaign.id)].node.name, "Campaign renamed")
    assert.deepEqual(stageNameDrafts(named, "campaign", [campaign], campaign.name), {})
  })

  it("excludes ineligible budget rows and never invents a budget type", () => {
    const controlled: BulkEditableItem = {
      ...adSet,
      id: "adset-controlled",
      budgetEligible: false,
      budgetBlockedReason: "Controlled by campaign budget",
    }
    const noBudget: BulkEditableItem = {
      ...adSet,
      id: "adset-no-budget",
      lifetime_budget: undefined,
      budgetEligible: true,
    }

    assert.deepEqual(stageBudgetDrafts({}, "adset", [controlled, noBudget], 20), {})
  })

  it("orders parent levels first and removes only successful publishes", () => {
    const campaignDrafts = stageStatusDrafts({}, "campaign", [campaign], "ACTIVE")
    const drafts = stageStatusDrafts(campaignDrafts, "adset", [adSet], "PAUSED")
    const ordered = orderedDrafts(Object.values(drafts))

    assert.deepEqual(ordered.map(draft => draft.level), ["campaign", "adset"])

    const remaining = removePublishedDrafts(drafts, [
      { id: campaign.id, level: "campaign", status: "published" },
      { id: adSet.id, level: "adset", status: "failed", message: "Meta rejected the budget" },
    ])
    assert.equal(remaining[bulkDraftKey("campaign", campaign.id)], undefined)
    assert.ok(remaining[bulkDraftKey("adset", adSet.id)])
  })

  it("fails closed when stored draft JSON is malformed", () => {
    assert.deepEqual(parseBulkDrafts("not-json"), {})
    assert.deepEqual(parseBulkDrafts("[]"), {})
  })
})
