import { describe, expect, it } from 'vitest'
import { createWriteBehind } from './write-behind'

describe('createWriteBehind', () => {
  it('keeps only the most recent snapshot queued during an active write', async () => {
    const writes: number[] = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const writer = createWriteBehind(async value => {
      writes.push(value)
      if (value === 1) await gate
    })

    const first = writer.enqueue(1)
    writer.enqueue(2)
    writer.enqueue(3)
    release()
    await first

    expect(writes).toEqual([1, 3])
  })
})
