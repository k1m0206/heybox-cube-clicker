import type { ChestRewardKind, ChestUpgradeId } from './types'

export const BASE_CHEST_CAPACITY = 12
export const BASE_CHEST_RECHARGE_MS = 60 * 60 * 1000

export interface ChestDropEntry {
  kind: ChestRewardKind
  amount: number
  probability: number
}

export const CHEST_DROPS: ChestDropEntry[] = [
  { kind: 'production', amount: 15 * 60, probability: 0.24 },
  { kind: 'production', amount: 30 * 60, probability: 0.16 },
  { kind: 'production', amount: 60 * 60, probability: 0.10 },
  { kind: 'production', amount: 2 * 60 * 60, probability: 0.055 },
  { kind: 'production', amount: 4 * 60 * 60, probability: 0.025 },
  { kind: 'chestPoints', amount: 1, probability: 0.13 },
  { kind: 'chestPoints', amount: 2, probability: 0.095 },
  { kind: 'chestPoints', amount: 3, probability: 0.055 },
  { kind: 'heritage', amount: 1, probability: 0.06 },
  { kind: 'heritage', amount: 2, probability: 0.03 },
  { kind: 'heritage', amount: 3, probability: 0.01 },
  { kind: 'chronoCore', amount: 1, probability: 0.04 },
]

export interface ChestUpgradeConfig {
  id: ChestUpgradeId
  name: string
  description: string
  maxLevel: number
  costs: readonly number[]
}

export const CHEST_UPGRADES: ChestUpgradeConfig[] = [
  { id: 'capacity', name: '扩容舱', description: '宝箱存储上限每级 +2', maxLevel: 4, costs: [3, 7, 14, 25] },
  { id: 'precisionTimer', name: '精密计时', description: '宝箱恢复速度每级 +10%', maxLevel: 5, costs: [4, 8, 15, 26, 42] },
  { id: 'supplyRecovery', name: '补给回收', description: '产能奖励时有 10% / 20% 概率返还 1 个宝箱', maxLevel: 2, costs: [20, 45] },
  { id: 'highEnergySettlement', name: '高能结算', description: '产能奖励的 cube 每级 +10%', maxLevel: 5, costs: [3, 7, 14, 25, 40] },
  { id: 'timeWarp', name: '时间跃迁', description: '产能奖励有 3% / 6% / 10% 概率提升一档', maxLevel: 3, costs: [15, 35, 70] },
  { id: 'doubleSettlement', name: '双倍结算', description: '产能奖励有 2% / 4% / 6% 概率获得双倍 cube', maxLevel: 3, costs: [18, 42, 85] },
  { id: 'emberCollection', name: '余烬收集', description: '获得产能奖励时额外获得 1 点宝箱点数', maxLevel: 1, costs: [55] },
]

export const PRODUCTION_DURATIONS = [15 * 60, 30 * 60, 60 * 60, 2 * 60 * 60, 4 * 60 * 60] as const
