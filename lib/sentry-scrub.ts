// Scrub Meta access_token= from Sentry payloads. TD-16 (tokens still in URL query
// strings) means this must run until that migration lands — do not remove.
export function scrubMetaToken(str: string): string {
  return str.replace(/access_token=[a-zA-Z0-9_-]+/g, "access_token=[SCRUBBED]")
}

export function scrubSentryEvent(event: any) {
  if (event.request?.url) event.request.url = scrubMetaToken(event.request.url)
  if (event.exception?.values) {
    for (const val of event.exception.values) {
      if (val.value) val.value = scrubMetaToken(val.value)
    }
  }
  return event
}

export function scrubSentryBreadcrumb(breadcrumb: any) {
  if (breadcrumb.message) breadcrumb.message = scrubMetaToken(breadcrumb.message)
  if (breadcrumb.data?.url) breadcrumb.data.url = scrubMetaToken(breadcrumb.data.url)
  return breadcrumb
}
