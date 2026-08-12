export type ExpeditionAllocation = 0.1 | 0.25 | 0.5
export type ExpeditionRouteId = 'safe' | 'standard' | 'anomaly'
export type ExpeditionDurationId = '15m' | '1h' | '4h' | '12h'
export type ExpeditionNodeType = 'resource' | 'anomaly' | 'elite' | 'boss'
export type ExpeditionMode = 'standard' | 'distortion'
export type ExpeditionEventId =
  | 'lostCargo'
  | 'timeWhirlpool'
  | 'unstableCrystal'
  | 'driftingFleet'
  | 'ancientBeacon'
  | 'dimensionalTide'
  | 'brokenGate'
  | 'mirrorUniverse'
export type ExpeditionEventOptionId = 'a' | 'b'
export type ExpeditionMasteryChallengeId = 'firstBoss' | 'safeBoss' | 'standardBoss' | 'anomalyBoss' | 'lightBoss'
export type DistortionRuleId = 'denseGravity' | 'timeFracture' | 'matterLeak' | 'energyNoise'
export type ExpeditionTempUpgradeId = 'hull' | 'scanner' | 'recovery' | 'sail'
export type ExpeditionRelicId =
  | 'starChart'
  | 'dustPrism'
  | 'returnBeacon'
  | 'dimensionCompass'
  | 'safetyAnchor'
  | 'abyssContract'
  | 'timeBottle'
  | 'cycleCore'

export interface ExpeditionNode {
  id: string
  zone: number
  index: number
  type: ExpeditionNodeType
}

export interface ExpeditionBlueprintSlot {
  buildingId: string | null
  level: number
}

export interface ExpeditionMission {
  id: string
  nodeId: string
  zone: number
  nodeIndex: number
  nodeType: ExpeditionNodeType
  routeId: ExpeditionRouteId
  durationId: ExpeditionDurationId
  allocation: ExpeditionAllocation
  allocatedCps: number
  power: number
  requiredPower: number
  startAt: number
  endAt: number
  fullRefundUntil: number
  timeSandCost: number
  cubeReward: number
  stardustReward: number
  coreReward: number
  coreFragmentReward: number
  mode: ExpeditionMode
  distortionLayer?: number
  distortionRuleId?: DistortionRuleId
}

export interface ExpeditionReward extends ExpeditionMission {
  completedAt: number
}

export interface ExpeditionEventModifiers {
  powerMultiplier: number
  dustMultiplier: number
  returnRateBonus: number
  durationMultiplier: number
}

export interface PendingExpeditionEvent {
  missionId: string
  nodeId: string
  eventId: ExpeditionEventId
}

export interface ExpeditionSave {
  unlocked: boolean
  highestBuildingIndexEver: number
  highestZoneUnlocked: number
  timeSand: number
  timeSandUpdatedAt: number
  stardust: number
  chronoCores: number
  coreFragments: number
  coreFragmentsEarnedThisRebirth: number
  firstClearNodeIds: string[]
  clearedNodeIds: string[]
  cycleSeed: number
  tempUpgradeLevels: Record<ExpeditionTempUpgradeId, number>
  ownedRelicIds: ExpeditionRelicId[]
  equippedRelicIds: ExpeditionRelicId[]
  blueprintSlots: ExpeditionBlueprintSlot[]
  zoneMastery: Record<string, ExpeditionMasteryChallengeId[]>
  distortionUnlocked: boolean
  highestDistortionCleared: number
  distortionFirstClearLayers: number[]
  distortionSeed: number
  pendingEvent: PendingExpeditionEvent | null
  resolvedEventNodeIds: string[]
  cycleEventModifiers: ExpeditionEventModifiers
  activeMission: ExpeditionMission | null
  pendingReward: ExpeditionReward | null
  lastTrustedAt: number
}

export interface ExpeditionContext {
  effectiveAutoRate: number
  uniqueBuildingCount: number
}

export interface ExpeditionPreview {
  node: ExpeditionNode
  routeId: ExpeditionRouteId
  durationId: ExpeditionDurationId
  allocation: ExpeditionAllocation
  allocatedCps: number
  power: number
  requiredPower: number
  effectiveDurationSeconds: number
  timeSandCost: number
  returnRate: number
  cubeReward: number
  stardustReward: number
  coreReward: number
  coreFragmentReward: number
  canLaunch: boolean
  reason: string
  mode: ExpeditionMode
  distortionLayer?: number
  distortionRuleId?: DistortionRuleId
}
