// Global mutex over the world's data: backups, restores, steamcmd
// updates, and scheduled restarts all take it so two destructive
// operations can never interleave.

interface Waiter {
  label: string
  resolve: (release: () => void) => void
}

export class WorldLock {
  private holderLabel: string | null = null
  private queue: Waiter[] = []

  get holder(): string | null {
    return this.holderLabel
  }

  // Non-blocking: returns a release fn or null if held. Routes use this
  // to answer 409 instead of queueing user clicks.
  tryAcquire(label: string): (() => void) | null {
    if (this.holderLabel !== null) return null
    this.holderLabel = label
    return this.makeRelease()
  }

  // Blocking: queue until the lock frees. The scheduler uses this so a
  // nightly backup waits for a running update instead of failing.
  acquire(label: string): Promise<() => void> {
    const immediate = this.tryAcquire(label)
    if (immediate) return Promise.resolve(immediate)
    return new Promise((resolve) => {
      this.queue.push({ label, resolve })
    })
  }

  private makeRelease(): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      const next = this.queue.shift()
      if (next) {
        this.holderLabel = next.label
        next.resolve(this.makeRelease())
      } else {
        this.holderLabel = null
      }
    }
  }
}
