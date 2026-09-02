/**
 * Coalesces frequent game snapshots. While a write is running only the newest
 * snapshot is retained, preventing a click-heavy session from building a long
 * chain of stale remote writes.
 */
export function createWriteBehind<T>(write: (value: T) => Promise<void>) {
  let pending: T | undefined
  let writing = false

  async function flush() {
    if (writing || pending === undefined) return
    writing = true
    try {
      while (pending !== undefined) {
        const snapshot = pending
        pending = undefined
        await write(snapshot)
      }
    } finally {
      writing = false
    }
  }

  return {
    enqueue(value: T) {
      pending = value
      return flush()
    },
    hasPending: () => pending !== undefined || writing,
  }
}
