import { describe, expect, it } from 'vitest'
import {
  CLICK_COMBO_WINDOW_MS,
  advanceClickCombo,
  calculateManualClickGain,
  rollGoldenLuckBonus,
} from './click-engine'

describe('click progression engine', () => {
  it('builds combo by 2% inside the one-second window and respects its upgrade cap', () => {
    expect(advanceClickCombo(0, 0.1, 1000, 1500)).toBeCloseTo(0.02)
    expect(advanceClickCombo(0.1, 0.1, 1500, 1600)).toBeCloseTo(0.1)
    expect(advanceClickCombo(0.08, 0.5, 1000, 1000 + CLICK_COMBO_WINDOW_MS + 1)).toBe(0)
  })

  it('rolls one inclusive integer luck bonus for the whole golden period', () => {
    expect(rollGoldenLuckBonus(5, 0)).toBe(0)
    expect(rollGoldenLuckBonus(5, 0.999999)).toBe(5)
    expect(rollGoldenLuckBonus(0, 0.8)).toBe(0)
  })

  it('applies combo before the active golden multiplier', () => {
    expect(calculateManualClickGain(101, 0.1, 15)).toBe(111 * 15)
  })
})
