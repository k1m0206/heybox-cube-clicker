import { describe, expect, it } from 'vitest'
import {
  cancelExpedition,
  calculateExpeditionPower,
  claimExpeditionReward,
  completeExpedition,
  createDefaultExpeditionSave,
  createDistortionPreview,
  createExpeditionPreview,
  generateZoneNodes,
  getBlueprintMultiplier,
  getBlueprintSlotCount,
  getBlueprintUpgradeCost,
  getDistortionAvailableMaxLayer,
  getDistortionRuleId,
  getDistortionSourceZone,
  getEventForNode,
  getZoneMasteryLevel,
  launchExpedition,
  normalizeExpeditionSave,
  refreshExpeditionTime,
  resetExpeditionCycle,
  resolveExpeditionEvent,
} from './engine'

describe('expedition power curve', () => {
  it.each([
    [1e16, 9, 1674],
    [1e44, 20, 4639],
    [1e80, 20, 8239],
  ])('anchors cps %s with %s buildings', (effectiveAutoRate, uniqueBuildingCount, expected) => {
    const state = createDefaultExpeditionSave(0, true)
    expect(calculateExpeditionPower(state, { effectiveAutoRate, uniqueBuildingCount }, 0.25).power).toBe(expected)
  })
})

describe('expedition map', () => {
  it('is deterministic and keeps the fixed reward budget', () => {
    const first = generateZoneNodes(3, 12345)
    const second = generateZoneNodes(3, 12345)
    expect(second).toEqual(first)
    expect(first).toHaveLength(12)
    expect(first.filter(node => node.type === 'resource')).toHaveLength(8)
    expect(first.filter(node => node.type === 'anomaly')).toHaveLength(2)
    expect(first.filter(node => node.type === 'elite')).toHaveLength(1)
    expect(first.at(-1)?.type).toBe('boss')
  })
})

describe('expedition economy', () => {
  it('caps cube recovery at 95%', () => {
    const state = createDefaultExpeditionSave(0, true)
    state.tempUpgradeLevels.recovery = 8
    state.ownedRelicIds = ['returnBeacon']
    state.equippedRelicIds = ['returnBeacon']
    const node = generateZoneNodes(1, state.cycleSeed).find(candidate => candidate.type === 'resource')!
    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e20, uniqueBuildingCount: 12 }, node, 'safe', '15m', 0.25)
    expect(preview.returnRate).toBe(0.95)
    expect(preview.cubeReward).toBe(preview.allocatedCps * preview.effectiveDurationSeconds * 0.95)
  })

  it('grants first-clear cores only once', () => {
    const state = createDefaultExpeditionSave(0, true)
    const node = generateZoneNodes(1, state.cycleSeed).find(candidate => candidate.type === 'resource')!
    state.clearedNodeIds = Array.from({ length: node.index - 1 }, (_, index) => `z1-n${index + 1}`)
    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e30, uniqueBuildingCount: 20 }, node, 'standard', '15m', 0.25)
    const launched = launchExpedition(state, preview, 1000)
    const completed = completeExpedition(launched, launched.activeMission!.endAt)
    const claimed = claimExpeditionReward(completed).state
    expect(claimed.chronoCores).toBe(1)
    expect(claimed.firstClearNodeIds).toContain(node.id)
  })

  it('uses the exact route, duration, allocation, and node dust multipliers', () => {
    const state = createDefaultExpeditionSave(0, true)
    const node = generateZoneNodes(1, state.cycleSeed).find(candidate => candidate.type === 'resource')!
    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e30, uniqueBuildingCount: 20 }, node, 'anomaly', '1h', 0.5)
    expect(preview.stardustReward).toBe(Math.floor(12 * 1 * 3 * 1.5 * 1.35))
  })

  it('refunds all time sand in 30 seconds and half afterwards', () => {
    const state = createDefaultExpeditionSave(0, true)
    const node = generateZoneNodes(1, state.cycleSeed)[0]
    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e30, uniqueBuildingCount: 20 }, node, 'standard', '15m', 0.25)
    const early = launchExpedition(state, preview, 1_000)
    expect(cancelExpedition(early, 31_000).timeSand).toBe(100)
    const late = launchExpedition(state, preview, 1_000)
    expect(cancelExpedition(late, 31_001).timeSand).toBe(97.5)
  })

  it('makes reward claiming idempotent', () => {
    const state = createDefaultExpeditionSave(0, true)
    const node = generateZoneNodes(1, state.cycleSeed).find(candidate => candidate.type === 'resource')!
    state.clearedNodeIds = Array.from({ length: node.index - 1 }, (_, index) => `z1-n${index + 1}`)
    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e30, uniqueBuildingCount: 20 }, node, 'standard', '15m', 0.25)
    const launched = launchExpedition(state, preview, 1_000)
    const completed = completeExpedition(launched, launched.activeMission!.endAt)
    const first = claimExpeditionReward(completed)
    const second = claimExpeditionReward(first.state)
    expect(first.cubeReward).toBeGreaterThan(0)
    expect(second.cubeReward).toBe(0)
    expect(second.state).toBe(first.state)
  })

  it('unlocks the next zone after claiming a boss and caps repeat fragments', () => {
    const state = createDefaultExpeditionSave(0, true)
    const boss = generateZoneNodes(1, state.cycleSeed).at(-1)!
    state.clearedNodeIds = Array.from({ length: 11 }, (_, index) => `z1-n${index + 1}`)
    const firstPreview = createExpeditionPreview(state, { effectiveAutoRate: 1e30, uniqueBuildingCount: 20 }, boss, 'standard', '15m', 0.25)
    const firstMission = launchExpedition(state, firstPreview, 1_000)
    const firstClaim = claimExpeditionReward(completeExpedition(firstMission, firstMission.activeMission!.endAt)).state
    expect(firstClaim.highestZoneUnlocked).toBe(2)
    expect(firstClaim.chronoCores).toBe(4)

    firstClaim.coreFragments = 9
    firstClaim.coreFragmentsEarnedThisRebirth = 29
    const repeatPreview = createExpeditionPreview(firstClaim, { effectiveAutoRate: 1e30, uniqueBuildingCount: 20 }, boss, 'standard', '15m', 0.25)
    const repeatMission = launchExpedition(firstClaim, repeatPreview, 2_000)
    const repeatClaim = claimExpeditionReward(completeExpedition(repeatMission, repeatMission.activeMission!.endAt)).state
    expect(repeatClaim.coreFragmentsEarnedThisRebirth).toBe(30)
    expect(repeatClaim.coreFragments).toBe(0)
    expect(repeatClaim.chronoCores).toBe(5)
  })

  it('opens blueprint slots by zone and applies the five-level cap', () => {
    const state = createDefaultExpeditionSave(0, true)
    expect(getBlueprintSlotCount(state)).toBe(1)
    state.highestZoneUnlocked = 4
    expect(getBlueprintSlotCount(state)).toBe(2)
    state.highestZoneUnlocked = 8
    expect(getBlueprintSlotCount(state)).toBe(3)
    state.blueprintSlots[0] = { buildingId: 'robot', level: 5 }
    expect(getBlueprintMultiplier(state, 'robot')).toBe(1.5)
    expect(getBlueprintUpgradeCost(state.blueprintSlots[0])).toBe(0)
  })
})

describe('expedition persistence and time', () => {
  it('unlocks legacy rebirth saves during migration', () => {
    expect(normalizeExpeditionSave(undefined, 1000, true).unlocked).toBe(true)
  })

  it('regenerates time sand and rejects clock rollback', () => {
    const state = createDefaultExpeditionSave(1000, true)
    state.timeSand = 0
    const refreshed = refreshExpeditionTime(state, 1000 + 25 * 60 * 1000)
    expect(refreshed.state.timeSand).toBe(2)
    const rollback = refreshExpeditionTime({ ...refreshed.state, lastTrustedAt: 1_000_000 }, 1)
    expect(rollback.rollbackDetected).toBe(true)
  })

  it('caps offline time-sand regeneration at the relic-adjusted capacity', () => {
    const state = createDefaultExpeditionSave(1_000, true)
    state.timeSand = 0
    state.ownedRelicIds = ['timeBottle']
    state.equippedRelicIds = ['timeBottle']
    expect(refreshExpeditionTime(state, 1_000 + 100 * 60 * 60 * 1000).state.timeSand).toBe(130)
  })

  it('resets cycle data but preserves permanent progression', () => {
    const state = createDefaultExpeditionSave(1000, true)
    state.stardust = 1000
    state.chronoCores = 20
    state.firstClearNodeIds = ['z1-n1']
    state.ownedRelicIds = ['cycleCore']
    state.equippedRelicIds = ['cycleCore']
    state.tempUpgradeLevels.hull = 4
    const reset = resetExpeditionCycle(state, 2000)
    expect(reset.stardust).toBe(150)
    expect(reset.chronoCores).toBe(20)
    expect(reset.firstClearNodeIds).toEqual(['z1-n1'])
    expect(reset.tempUpgradeLevels.hull).toBe(0)
  })
})

describe('expedition events', () => {
  it('selects events deterministically and triggers each eligible node once per cycle', () => {
    let state = createDefaultExpeditionSave(0, true)
    state.cycleSeed = 24680
    const node = generateZoneNodes(1, state.cycleSeed).find(candidate => candidate.type === 'anomaly')!
    state.clearedNodeIds = Array.from({ length: node.index - 1 }, (_, index) => `z1-n${index + 1}`)
    expect(getEventForNode(state.cycleSeed, node.id)).toBe(getEventForNode(state.cycleSeed, node.id))

    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e40, uniqueBuildingCount: 20 }, node, 'standard', '15m', 0.25)
    state = completeExpedition(launchExpedition(state, preview, 1_000), 1_000 + preview.effectiveDurationSeconds * 1000)
    expect(state.pendingEvent?.eventId).toBe(getEventForNode(state.cycleSeed, node.id))
    expect(claimExpeditionReward(state)).toEqual({ state, cubeReward: 0 })

    state = claimExpeditionReward(resolveExpeditionEvent(state, 'a')).state
    const repeated = createExpeditionPreview(state, { effectiveAutoRate: 1e40, uniqueBuildingCount: 20 }, node, 'standard', '15m', 0.25)
    state = completeExpedition(launchExpedition(state, repeated, 2_000_000), 2_000_000 + repeated.effectiveDurationSeconds * 1000)
    expect(state.pendingEvent).toBeNull()
  })

  it('applies a selected event once and keeps cube recovery below the 95% hard cap', () => {
    const state = createDefaultExpeditionSave(0, true)
    const node = generateZoneNodes(1, state.cycleSeed).find(candidate => candidate.type === 'anomaly')!
    state.clearedNodeIds = Array.from({ length: node.index - 1 }, (_, index) => `z1-n${index + 1}`)
    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e40, uniqueBuildingCount: 20 }, node, 'safe', '15m', 0.25)
    const completed = completeExpedition(launchExpedition(state, preview, 1_000), 1_000 + preview.effectiveDurationSeconds * 1000)
    completed.pendingEvent = { ...completed.pendingEvent!, eventId: 'lostCargo' }

    const resolved = resolveExpeditionEvent(completed, 'b')
    const resolvedAgain = resolveExpeditionEvent(resolved, 'b')
    expect(resolved.pendingReward!.cubeReward).toBe(resolved.pendingReward!.allocatedCps * preview.effectiveDurationSeconds * 0.95)
    expect(resolvedAgain).toBe(resolved)
    expect(resolved.resolvedEventNodeIds).toEqual([node.id])
  })

  it('clamps accumulated cycle modifiers and returned stamina', () => {
    let state = createDefaultExpeditionSave(0, true)
    state.timeSand = 99
    const node = generateZoneNodes(1, state.cycleSeed).find(candidate => candidate.type === 'anomaly')!
    state.clearedNodeIds = Array.from({ length: node.index - 1 }, (_, index) => `z1-n${index + 1}`)
    const preview = createExpeditionPreview(state, { effectiveAutoRate: 1e40, uniqueBuildingCount: 20 }, node, 'standard', '15m', 0.25)
    state = completeExpedition(launchExpedition(state, preview, 1_000), 1_000 + preview.effectiveDurationSeconds * 1000)
    const reward = state.pendingReward!

    for (let index = 0; index < 12; index++) {
      state = {
        ...state,
        pendingReward: reward,
        pendingEvent: { missionId: reward.id, nodeId: `event-${index}`, eventId: 'timeWhirlpool' },
      }
      state = resolveExpeditionEvent(state, index === 0 ? 'a' : 'b')
    }
    expect(state.timeSand).toBeLessThanOrEqual(100)
    expect(state.cycleEventModifiers.powerMultiplier).toBe(0.9)
    expect(state.cycleEventModifiers.durationMultiplier).toBe(0.85)

    const normalized = normalizeExpeditionSave({
      ...state,
      cycleEventModifiers: { powerMultiplier: 99, dustMultiplier: 0, returnRateBonus: 1, durationMultiplier: 99 },
    }, 5_000, true)
    expect(normalized.cycleEventModifiers).toEqual({ powerMultiplier: 1.15, dustMultiplier: 0.85, returnRateBonus: 0.05, durationMultiplier: 1.1 })
  })
})

describe('zone mastery', () => {
  it('earns multiple challenges together, persists them, and caps bonuses at level five', () => {
    let state = createDefaultExpeditionSave(0, true)
    const boss = generateZoneNodes(1, state.cycleSeed).at(-1)!
    state.clearedNodeIds = Array.from({ length: 11 }, (_, index) => `z1-n${index + 1}`)
    const context = { effectiveAutoRate: 1e60, uniqueBuildingCount: 20 }

    for (const [routeId, allocation] of [['safe', 0.1], ['standard', 0.25], ['anomaly', 0.25]] as const) {
      const preview = createExpeditionPreview(state, context, boss, routeId, '15m', allocation)
      const launched = launchExpedition(state, preview, 1_000 + state.timeSand)
      state = claimExpeditionReward(completeExpedition(launched, launched.activeMission!.endAt)).state
    }

    expect(getZoneMasteryLevel(state, 1)).toBe(5)
    expect(new Set(state.zoneMastery['1'])).toEqual(new Set(['firstBoss', 'safeBoss', 'standardBoss', 'anomalyBoss', 'lightBoss']))
    const resource = generateZoneNodes(1, state.cycleSeed).find(node => node.type === 'resource')!
    const mastered = createExpeditionPreview(state, context, resource, 'standard', '15m', 0.25)
    const baseline = createExpeditionPreview({ ...state, zoneMastery: {} }, context, resource, 'standard', '15m', 0.25)
    expect(mastered.requiredPower).toBe(Math.ceil(baseline.requiredPower * 0.925))
    expect(mastered.stardustReward).toBe(Math.floor(baseline.stardustReward * 1.1))

    const reset = resetExpeditionCycle(state, 50_000)
    expect(getZoneMasteryLevel(reset, 1)).toBe(5)
  })
})

describe('distortion zones', () => {
  it('cycles source zones and rules and enforces sequential access', () => {
    const state = createDefaultExpeditionSave(0, true)
    state.distortionUnlocked = true
    expect(getDistortionSourceZone(1)).toBe(1)
    expect(getDistortionSourceZone(11)).toBe(1)
    expect([1, 2, 3, 4, 5].map(getDistortionRuleId)).toEqual(['denseGravity', 'timeFracture', 'matterLeak', 'energyNoise', 'denseGravity'])
    expect(getDistortionAvailableMaxLayer(state)).toBe(1)

    const context = { effectiveAutoRate: 1e150, uniqueBuildingCount: 20 }
    expect(createDistortionPreview(state, context, 2, 'standard', '15m', 0.25).canLaunch).toBe(false)
    const first = createDistortionPreview(state, context, 1, 'standard', '15m', 0.25)
    expect(first.requiredPower).toBe(9234)
    expect(first.stardustReward).toBe(Math.floor(12 * 10 * 2 * 1.12))
  })

  it('unlocks from the tenth-zone boss and grants milestone cores once', () => {
    let state = createDefaultExpeditionSave(0, true)
    state.highestZoneUnlocked = 10
    const boss = generateZoneNodes(10, state.cycleSeed).at(-1)!
    state.clearedNodeIds = Array.from({ length: 11 }, (_, index) => `z10-n${index + 1}`)
    const context = { effectiveAutoRate: 1e150, uniqueBuildingCount: 20 }
    const bossPreview = createExpeditionPreview(state, context, boss, 'standard', '15m', 0.25)
    let launched = launchExpedition(state, bossPreview, 1_000)
    state = claimExpeditionReward(completeExpedition(launched, launched.activeMission!.endAt)).state
    expect(state.distortionUnlocked).toBe(true)

    for (let layer = 1; layer <= 5; layer++) {
      const preview = createDistortionPreview(state, context, layer, 'standard', '15m', 0.25)
      launched = launchExpedition(state, preview, 10_000 + layer)
      state = claimExpeditionReward(completeExpedition(launched, launched.activeMission!.endAt)).state
    }
    expect(state.highestDistortionCleared).toBe(5)
    expect(state.distortionFirstClearLayers).toEqual([1, 2, 3, 4, 5])
    const coresAfterFirstClear = state.chronoCores

    const repeat = createDistortionPreview(state, context, 5, 'standard', '15m', 0.25)
    launched = launchExpedition(state, repeat, 20_000)
    state = claimExpeditionReward(completeExpedition(launched, launched.activeMission!.endAt)).state
    expect(state.chronoCores).toBe(coresAfterFirstClear)
  })
})

describe('v3 migration', () => {
  it('defaults old missions to standard mode and initializes expansion fields', () => {
    const base = createDefaultExpeditionSave(0, true)
    const node = generateZoneNodes(1, base.cycleSeed).find(candidate => candidate.type === 'resource')!
    base.clearedNodeIds = Array.from({ length: node.index - 1 }, (_, index) => `z1-n${index + 1}`)
    const preview = createExpeditionPreview(base, { effectiveAutoRate: 1e30, uniqueBuildingCount: 20 }, node, 'standard', '15m', 0.25)
    const mission = launchExpedition(base, preview, 1_000).activeMission!
    const oldMission = { ...mission } as Partial<typeof mission>
    delete oldMission.mode
    const migrated = normalizeExpeditionSave({ ...base, activeMission: oldMission, zoneMastery: undefined }, 2_000, true)
    expect(migrated.activeMission?.mode).toBe('standard')
    expect(migrated.zoneMastery).toEqual({})
    expect(migrated.pendingEvent).toBeNull()
    expect(migrated.distortionFirstClearLayers).toEqual([])
  })

  it('clears cycle event state while preserving mastery and distortion progress', () => {
    const state = createDefaultExpeditionSave(0, true)
    state.zoneMastery = { '3': ['firstBoss', 'safeBoss'] }
    state.distortionUnlocked = true
    state.highestDistortionCleared = 7
    state.distortionFirstClearLayers = [1, 2, 3, 4, 5, 6, 7]
    state.resolvedEventNodeIds = ['z1-n2']
    state.cycleEventModifiers = { powerMultiplier: 0.98, dustMultiplier: 1.05, returnRateBonus: -0.02, durationMultiplier: 0.96 }
    const reset = resetExpeditionCycle(state, 5_000)
    expect(reset.resolvedEventNodeIds).toEqual([])
    expect(reset.cycleEventModifiers).toEqual({ powerMultiplier: 1, dustMultiplier: 1, returnRateBonus: 0, durationMultiplier: 1 })
    expect(reset.zoneMastery).toEqual(state.zoneMastery)
    expect(reset.highestDistortionCleared).toBe(7)
  })
})
