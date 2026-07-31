const ROADMAP_ONLY_APPS = new Set(["tiktok", "snapchat", "pinterest"])

type AutomationStep = {
  actionConfig?: { appId?: string }
}

export function findRoadmapOnlyAutomationApp(steps: AutomationStep[] = []) {
  return steps
    .map(step => step.actionConfig?.appId)
    .find((appId): appId is string => !!appId && ROADMAP_ONLY_APPS.has(appId))
}
