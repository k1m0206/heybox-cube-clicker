export type ChestUpgradeId =
  | 'capacity'
  | 'precisionTimer'
  | 'supplyRecovery'
  | 'highEnergySettlement'
  | 'timeWarp'
  | 'doubleSettlement'
  | 'emberCollection'

export type ChestRewardKind = 'production' | 'chestPoints' | 'heritage' | 'chronoCore'

export interface ChestUpgradeLevels {
  capacity: number
  precisionTimer: number
  supplyRecovery: number
  highEnergySettlement: number
  timeWarp: number
  doubleSettlement: number
  emberCollection: number
}

export interface ChestSave {
  available: number
  chestPoints: number
  lastRechargeAt: number
  totalOpened: number
  upgradeLevels: ChestUpgradeLevels
}

export interface ChestReward {
  kind: ChestRewardKind
  amount: number
  durationSeconds?: number
  baseDurationSeconds?: number
  upgradedTier?: boolean
  doubled?: boolean
  refundedChest?: boolean
  bonusChestPoints?: number
}

export interface ChestOpenResult {
  state: ChestSave
  reward: ChestReward | null
  cubeGain: number
  heritageGain: number
  chronoCoreGain: number
}
