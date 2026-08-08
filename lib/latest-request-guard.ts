export type LatestRequest = {
  signal: AbortSignal
  isCurrent: () => boolean
}

/** Cancels superseded reads so only the newest response may update UI state. */
export class LatestRequestGuard {
  private controller: AbortController | null = null
  private sequence = 0

  begin(): LatestRequest {
    this.controller?.abort()
    this.controller = new AbortController()
    const sequence = ++this.sequence

    return {
      signal: this.controller.signal,
      isCurrent: () => this.sequence === sequence,
    }
  }
}
