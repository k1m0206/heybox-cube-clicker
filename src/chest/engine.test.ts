import { describe, expect, it } from 'vitest'
import {
  buyChestUpgrade, createDefaultChestSave, getChestCapacity, getChestRechargeMs, openChest, refreshChestState,
} from './engine'

describe('chest engine', () => {
  it('regenerates one chest per hour and respects capacity', () => {
    const state = { ...createDefaultChestSave(0), available: 10 }
    const refreshed = refreshChestState(state, 3 * 60 * 60 * 1000)
    expect(refreshed.available).toBe(12)
  })

  it('applies capacity and recharge upgrades', () => {
    let state = { ...createDefaultChestSave(0), chestPoints: 100 }
    state = buyChestUpgrade(state, 'capacity')
    state = buyChestUpgrade(state, 'precisionTimer')
    expect(getChestCapacity(state)).toBe(14)
    expect(getChestRechargeMs(state)).toBeCloseTo(60 * 60 * 1000 / 1.1)
  })

  it('uses the exact drop table boundaries', () => {
    const production = openChest(createDefaultChestSave(0), 10, () => 0, 0)
    expect(production.reward?.kind).toBe('production')
    expect(production.cubeGain).toBe(10 * 15 * 60)

    const core = openChest(createDefaultChestSave(0), 10, () => 0.999, 0)
    expect(core.reward).toMatchObject({ kind: 'chronoCore', amount: 1 })
  })

  it('grants chest points and heritage points from their ranges', () => {
    const chestPoints = openChest(createDefaultChestSave(0), 0, () => 0.60, 0)
    expect(chestPoints.reward).toMatchObject({ kind: 'chestPoints', amount: 1 })
    expect(chestPoints.state.chestPoints).toBe(1)

    const heritage = openChest(createDefaultChestSave(0), 0, () => 0.90, 0)
    expect(heritage.heritageGain).toBe(1)
  })

  it('combines production upgrades and reports every triggered bonus', () => {
    const state = createDefaultChestSave(0)
    state.upgradeLevels = {
      ...state.upgradeLevels,
      supplyRecovery: 2,
      highEnergySettlement: 2,
      timeWarp: 3,
      doubleSettlement: 3,
      emberCollection: 1,
    }
    const rolls = [0, 0, 0, 0]
    const result = openChest(state, 10, () => rolls.shift() ?? 1, 0)
    expect(result.reward).toMatchObject({
      kind: 'production',
      durationSeconds: 30 * 60,
      upgradedTier: true,
      doubled: true,
      refundedChest: true,
      bonusChestPoints: 1,
    })
    expect(result.cubeGain).toBe(10 * 30 * 60 * 1.2 * 2)
    expect(result.state.available).toBe(12)
    expect(result.state.chestPoints).toBe(1)
  })
})
