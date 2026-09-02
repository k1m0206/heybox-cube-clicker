import { describe, expect, it } from 'vitest'
import { choosePreferredSave } from './save-selection'

describe('choosePreferredSave', () => {
  it('restores a richer remote save even when an empty local save is newer', () => {
    const local = { totalCubesEver: 0, totalClicks: 0, playerLevel: 1, lastSaveTime: 200 }
    const remote = { totalCubesEver: 1_000_000, totalClicks: 500, playerLevel: 12, lastSaveTime: 100 }
    expect(choosePreferredSave(local, remote)).toBe(remote)
  })

  it('keeps the richer local save when remote data is older in progress', () => {
    const local = { totalCubesEver: 2_000, totalClicks: 50, lastSaveTime: 100 }
    const remote = { totalCubesEver: 1_000, totalClicks: 100, lastSaveTime: 200 }
    expect(choosePreferredSave(local, remote)).toBe(local)
  })

  it('uses the newest timestamp when progress is equal', () => {
    const local = { totalCubesEver: 100, totalClicks: 10, lastSaveTime: 200 }
    const remote = { totalCubesEver: 100, totalClicks: 10, lastSaveTime: 100 }
    expect(choosePreferredSave(local, remote)).toBe(local)
  })

  it('returns the available copy when only one exists', () => {
    const remote = { totalCubesEver: 100 }
    expect(choosePreferredSave(undefined, remote)).toBe(remote)
    expect(choosePreferredSave(remote, undefined)).toBe(remote)
  })
})
