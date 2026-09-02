import {
  BASE_CHEST_CAPACITY, BASE_CHEST_RECHARGE_MS, CHEST_DROPS, CHEST_UPGRADES, PRODUCTION_DURATIONS,
} from './config'
import type { ChestOpenResult, ChestReward, ChestSave, ChestUpgradeId, ChestUpgradeLevels } from './types'

const DEFAULT_UPGRADE_LEVELS: ChestUpgradeLevels = {
  capacity: 0,
  precisionTimer: 0,
  supplyRecovery: 0,
  highEnergySettlement: 0,
  timeWarp: 0,
  doubleSettlement: 0,
  emberCollection: 0,
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function integer(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)))
}

export function createDefaultChestSave(now = Date.now()): ChestSave {
  return {
    available: BASE_CHEST_CAPACITY,
    chestPoints: 0,
    lastRechargeAt: now,
    totalOpened: 0,
    upgradeLevels: { ...DEFAULT_UPGRADE_LEVELS },
  }
}

export function normalizeChestSave(value: unknown, now = Date.now()): ChestSave {
  const fallback = createDefaultChestSave(now)
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<ChestSave>
  const rawLevels = raw.upgradeLevels
  const upgradeLevels = { ...DEFAULT_UPGRADE_LEVELS }
  for (const upgrade of CHEST_UPGRADES) {
    upgradeLevels[upgrade.id] = Math.min(upgrade.maxLevel, integer(rawLevels?.[upgrade.id]))
  }
  const capacity = BASE_CHEST_CAPACITY + upgradeLevels.capacity * 2
  return {
    available: Math.min(capacity, integer(raw.available, capacity)),
    chestPoints: integer(raw.chestPoints),
    lastRechargeAt: finiteNumber(raw.lastRechargeAt, now),
    totalOpened: integer(raw.totalOpened),
    upgradeLevels,
  }
}

export function getChestCapacity(state: ChestSave): number {
  return BASE_CHEST_CAPACITY + state.upgradeLevels.capacity * 2
}

export function getChestRechargeMs(state: ChestSave): number {
  return BASE_CHEST_RECHARGE_MS / (1 + state.upgradeLevels.precisionTimer * 0.1)
}

export function refreshChestState(state: ChestSave, now = Date.now()): ChestSave {
  const capacity = getChestCapacity(state)
  if (state.available >= capacity) {
    return state.lastRechargeAt === now ? state : { ...state, available: capacity, lastRechargeAt: now }
  }
  const trustedNow = Math.max(state.lastRechargeAt, now)
  const rechargeMs = getChestRechargeMs(state)
  const regenerated = Math.floor(Math.max(0, trustedNow - state.lastRechargeAt) / rechargeMs)
  if (regenerated <= 0) return state
  const available = Math.min(capacity, state.available + regenerated)
  return {
    ...state,
    available,
    lastRechargeAt: available >= capacity ? trustedNow : state.lastRechargeAt + regenerated * rechargeMs,
  }
}

export function getNextChestSeconds(state: ChestSave, now = Date.now()): number {
  if (state.available >= getChestCapacity(state)) return 0
  const elapsed = Math.max(0, now - state.lastRechargeAt)
  return Math.max(0, Math.ceil((getChestRechargeMs(state) - elapsed) / 1000))
}

export function getChestUpgradeCost(state: ChestSave, id: ChestUpgradeId): number {
  const config = CHEST_UPGRADES.find(candidate => candidate.id === id)
  if (!config) return 0
  return config.costs[state.upgradeLevels[id]] ?? 0
}

export function buyChestUpgrade(state: ChestSave, id: ChestUpgradeId): ChestSave {
  const config = CHEST_UPGRADES.find(candidate => candidate.id === id)
  if (!config) return state
  const level = state.upgradeLevels[id]
  const cost = config.costs[level]
  if (level >= config.maxLevel || cost === undefined || state.chestPoints < cost) return state
  return {
    ...state,
    chestPoints: state.chestPoints - cost,
    upgradeLevels: { ...state.upgradeLevels, [id]: level + 1 },
  }
}

function rollDrop(random: () => number): ChestReward {
  const roll = Math.min(0.999999999, Math.max(0, random()))
  let cumulative = 0
  for (const entry of CHEST_DROPS) {
    cumulative += entry.probability
    if (roll < cumulative) {
      return entry.kind === 'production'
        ? { kind: entry.kind, amount: entry.amount, durationSeconds: entry.amount, baseDurationSeconds: entry.amount }
        : { kind: entry.kind, amount: entry.amount }
    }
  }
  return { kind: 'chronoCore', amount: 1 }
}

function chanceForLevel(level: number, values: readonly number[]): number {
  return values[Math.min(values.length - 1, Math.max(0, level))] ?? 0
}

export function openChest(
  sourceState: ChestSave,
  worldAutoRate: number,
  random: () => number = Math.random,
  now = Date.now(),
): ChestOpenResult {
  let state = refreshChestState(sourceState, now)
  if (state.available <= 0) return { state, reward: null, cubeGain: 0, heritageGain: 0, chronoCoreGain: 0 }

  const reward = rollDrop(random)
  let cubeGain = 0
  let heritageGain = 0
  let chronoCoreGain = 0
  let chestPointsGain = 0
  let refundedChest = false

  if (reward.kind === 'production') {
    const warpChance = chanceForLevel(state.upgradeLevels.timeWarp, [0, 0.03, 0.06, 0.10])
    let durationSeconds = reward.durationSeconds ?? 0
    const durationIndex = PRODUCTION_DURATIONS.indexOf(durationSeconds as typeof PRODUCTION_DURATIONS[number])
    if (durationIndex >= 0 && durationIndex < PRODUCTION_DURATIONS.length - 1 && random() < warpChance) {
      durationSeconds = PRODUCTION_DURATIONS[durationIndex + 1]
      reward.upgradedTier = true
    }
    const doubleChance = chanceForLevel(state.upgradeLevels.doubleSettlement, [0, 0.02, 0.04, 0.06])
    reward.doubled = random() < doubleChance
    const productionMultiplier = (1 + state.upgradeLevels.highEnergySettlement * 0.1) * (reward.doubled ? 2 : 1)
    cubeGain = Math.max(0, worldAutoRate) * durationSeconds * productionMultiplier
    reward.durationSeconds = durationSeconds
    reward.amount = cubeGain

    const refundChance = chanceForLevel(state.upgradeLevels.supplyRecovery, [0, 0.10, 0.20])
    refundedChest = random() < refundChance
    reward.refundedChest = refundedChest
    chestPointsGain = state.upgradeLevels.emberCollection > 0 ? 1 : 0
    reward.bonusChestPoints = chestPointsGain
  } else if (reward.kind === 'chestPoints') {
    chestPointsGain = reward.amount
  } else if (reward.kind === 'heritage') {
    heritageGain = reward.amount
  } else {
    chronoCoreGain = reward.amount
  }

  const capacity = getChestCapacity(state)
  state = {
    ...state,
    available: Math.min(capacity, state.available - 1 + (refundedChest ? 1 : 0)),
    chestPoints: state.chestPoints + chestPointsGain,
    totalOpened: state.totalOpened + 1,
  }
  return { state, reward, cubeGain, heritageGain, chronoCoreGain }
}
