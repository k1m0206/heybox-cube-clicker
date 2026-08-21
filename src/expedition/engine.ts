import {
  BASE_TIME_SAND_CAP,
  BLUEPRINT_LEVEL_COSTS,
  CLOCK_ROLLBACK_TOLERANCE_MS,
  CORE_FRAGMENT_EXCHANGE_SIZE,
  DISTORTION_MAX_LAYER,
  DISTORTION_MILESTONE_LAYERS,
  DISTORTION_RULE_IDS,
  DISTORTION_RULES,
  EXPEDITION_ALLOCATIONS,
  EXPEDITION_DURATIONS,
  EXPEDITION_EVENT_IDS,
  EXPEDITION_ROUTES,
  EXPEDITION_ZONES,
  MAX_CORE_FRAGMENTS_PER_REBIRTH,
  MAX_TIME_REGEN_MS,
  NODE_TYPE_CONFIG,
  RELICS,
  TIME_SAND_REGEN_MS,
} from './config'
import type {
  ExpeditionAllocation,
  ExpeditionBlueprintSlot,
  ExpeditionContext,
  ExpeditionDurationId,
  ExpeditionEventId,
  ExpeditionEventModifiers,
  ExpeditionEventOptionId,
  ExpeditionMasteryChallengeId,
  ExpeditionMission,
  ExpeditionNode,
  ExpeditionNodeType,
  ExpeditionPreview,
  ExpeditionRelicId,
  ExpeditionReward,
  ExpeditionRouteId,
  ExpeditionSave,
  ExpeditionTempUpgradeId,
} from './types'

const DEFAULT_TEMP_LEVELS: Record<ExpeditionTempUpgradeId, number> = {
  hull: 0,
  scanner: 0,
  recovery: 0,
  sail: 0,
}

export const DEFAULT_EVENT_MODIFIERS: ExpeditionEventModifiers = {
  powerMultiplier: 1,
  dustMultiplier: 1,
  returnRateBonus: 0,
  durationMultiplier: 1,
}

export function randomExpeditionSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0] || 1
  }
  return Math.max(1, Math.floor(Math.random() * 0xffffffff))
}

export function createDefaultExpeditionSave(now = Date.now(), unlocked = false): ExpeditionSave {
  return {
    unlocked,
    highestBuildingIndexEver: unlocked ? 8 : 0,
    highestZoneUnlocked: 1,
    timeSand: BASE_TIME_SAND_CAP,
    timeSandUpdatedAt: now,
    stardust: 0,
    chronoCores: 0,
    coreFragments: 0,
    coreFragmentsEarnedThisRebirth: 0,
    firstClearNodeIds: [],
    clearedNodeIds: [],
    cycleSeed: randomExpeditionSeed(),
    tempUpgradeLevels: { ...DEFAULT_TEMP_LEVELS },
    ownedRelicIds: [],
    equippedRelicIds: [],
    blueprintSlots: Array.from({ length: 3 }, (): ExpeditionBlueprintSlot => ({ buildingId: null, level: 0 })),
    zoneMastery: {},
    distortionUnlocked: false,
    highestDistortionCleared: 0,
    distortionFirstClearLayers: [],
    distortionSeed: randomExpeditionSeed(),
    pendingEvent: null,
    resolvedEventNodeIds: [],
    cycleEventModifiers: { ...DEFAULT_EVENT_MODIFIERS },
    activeMission: null,
    pendingReward: null,
    lastTrustedAt: now,
  }
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function integer(value: unknown, fallback = 0, minimum = 0): number {
  return Math.max(minimum, Math.floor(finiteNumber(value, fallback)))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function validRelics(value: unknown): ExpeditionRelicId[] {
  if (!Array.isArray(value)) return []
  const valid = new Set(Object.keys(RELICS))
  return [...new Set(value.filter((id): id is ExpeditionRelicId => typeof id === 'string' && valid.has(id)))]
}

const MASTERY_IDS = new Set<ExpeditionMasteryChallengeId>(['firstBoss', 'safeBoss', 'standardBoss', 'anomalyBoss', 'lightBoss'])

function normalizeZoneMastery(value: unknown): Record<string, ExpeditionMasteryChallengeId[]> {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, ExpeditionMasteryChallengeId[]> = {}
  for (let zone = 1; zone <= 10; zone++) {
    const raw = (value as Record<string, unknown>)[String(zone)]
    if (!Array.isArray(raw)) continue
    result[String(zone)] = [...new Set(raw.filter((id): id is ExpeditionMasteryChallengeId => typeof id === 'string' && MASTERY_IDS.has(id as ExpeditionMasteryChallengeId)))]
  }
  return result
}

function normalizeMission<T extends ExpeditionMission | ExpeditionReward>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as T
  const mode = raw.mode === 'distortion' ? 'distortion' : 'standard'
  const ruleId = raw.distortionRuleId && DISTORTION_RULE_IDS.includes(raw.distortionRuleId) ? raw.distortionRuleId : undefined
  return {
    ...raw,
    mode,
    distortionLayer: mode === 'distortion' ? clamp(integer(raw.distortionLayer, 1, 1), 1, DISTORTION_MAX_LAYER) : undefined,
    distortionRuleId: mode === 'distortion' ? ruleId : undefined,
  }
}

export function normalizeExpeditionSave(value: unknown, now = Date.now(), legacyUnlocked = false): ExpeditionSave {
  const fallback = createDefaultExpeditionSave(now, legacyUnlocked)
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<ExpeditionSave>
  const ownedRelicIds = validRelics(raw.ownedRelicIds)
  const equippedRelicIds = validRelics(raw.equippedRelicIds).filter(id => ownedRelicIds.includes(id)).slice(0, 3)
  const slots = Array.isArray(raw.blueprintSlots) ? raw.blueprintSlots.slice(0, 3) : []
  const rawModifiers = raw.cycleEventModifiers
  const activeMission = normalizeMission<ExpeditionMission>(raw.activeMission)
  const pendingReward = normalizeMission<ExpeditionReward>(raw.pendingReward)
  const pendingEvent = raw.pendingEvent
    && typeof raw.pendingEvent === 'object'
    && typeof raw.pendingEvent.missionId === 'string'
    && typeof raw.pendingEvent.nodeId === 'string'
    && EXPEDITION_EVENT_IDS.includes(raw.pendingEvent.eventId)
    ? raw.pendingEvent
    : null
  while (slots.length < 3) slots.push({ buildingId: null, level: 0 })
  return {
    ...fallback,
    unlocked: Boolean(raw.unlocked || legacyUnlocked),
    highestBuildingIndexEver: integer(raw.highestBuildingIndexEver, fallback.highestBuildingIndexEver),
    highestZoneUnlocked: Math.min(10, Math.max(1, integer(raw.highestZoneUnlocked, 1, 1))),
    timeSand: Math.max(0, finiteNumber(raw.timeSand, fallback.timeSand)),
    timeSandUpdatedAt: finiteNumber(raw.timeSandUpdatedAt, now),
    stardust: Math.max(0, integer(raw.stardust)),
    chronoCores: Math.max(0, integer(raw.chronoCores)),
    coreFragments: Math.max(0, integer(raw.coreFragments)),
    coreFragmentsEarnedThisRebirth: Math.min(MAX_CORE_FRAGMENTS_PER_REBIRTH, integer(raw.coreFragmentsEarnedThisRebirth)),
    firstClearNodeIds: Array.isArray(raw.firstClearNodeIds) ? [...new Set(raw.firstClearNodeIds.filter(id => typeof id === 'string'))] : [],
    clearedNodeIds: Array.isArray(raw.clearedNodeIds) ? [...new Set(raw.clearedNodeIds.filter(id => typeof id === 'string'))] : [],
    cycleSeed: integer(raw.cycleSeed, fallback.cycleSeed, 1),
    tempUpgradeLevels: {
      hull: Math.min(10, integer(raw.tempUpgradeLevels?.hull)),
      scanner: Math.min(10, integer(raw.tempUpgradeLevels?.scanner)),
      recovery: Math.min(8, integer(raw.tempUpgradeLevels?.recovery)),
      sail: Math.min(5, integer(raw.tempUpgradeLevels?.sail)),
    },
    ownedRelicIds,
    equippedRelicIds,
    blueprintSlots: slots.map(slot => ({
      buildingId: typeof slot?.buildingId === 'string' ? slot.buildingId : null,
      level: Math.min(5, integer(slot?.level)),
    })),
    zoneMastery: normalizeZoneMastery(raw.zoneMastery),
    distortionUnlocked: Boolean(raw.distortionUnlocked || (Array.isArray(raw.firstClearNodeIds) && raw.firstClearNodeIds.includes('z10-n12'))),
    highestDistortionCleared: clamp(integer(raw.highestDistortionCleared), 0, DISTORTION_MAX_LAYER),
    distortionFirstClearLayers: Array.isArray(raw.distortionFirstClearLayers)
      ? [...new Set(raw.distortionFirstClearLayers.map(layer => integer(layer)).filter(layer => layer >= 1 && layer <= DISTORTION_MAX_LAYER))]
      : [],
    distortionSeed: integer(raw.distortionSeed, fallback.distortionSeed, 1),
    pendingEvent: pendingReward && pendingEvent?.missionId === pendingReward.id ? pendingEvent : null,
    resolvedEventNodeIds: Array.isArray(raw.resolvedEventNodeIds) ? [...new Set(raw.resolvedEventNodeIds.filter(id => typeof id === 'string'))] : [],
    cycleEventModifiers: {
      powerMultiplier: clamp(finiteNumber(rawModifiers?.powerMultiplier, 1), 0.90, 1.15),
      dustMultiplier: clamp(finiteNumber(rawModifiers?.dustMultiplier, 1), 0.85, 1.25),
      returnRateBonus: clamp(finiteNumber(rawModifiers?.returnRateBonus, 0), -0.05, 0.05),
      durationMultiplier: clamp(finiteNumber(rawModifiers?.durationMultiplier, 1), 0.85, 1.10),
    },
    activeMission,
    pendingReward,
    lastTrustedAt: finiteNumber(raw.lastTrustedAt, now),
  }
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ result >>> 15, result | 1)
    result ^= result + Math.imul(result ^ result >>> 7, result | 61)
    return ((result ^ result >>> 14) >>> 0) / 4294967296
  }
}

export function generateZoneNodes(zone: number, cycleSeed: number): ExpeditionNode[] {
  const types: ExpeditionNodeType[] = [
    ...Array<ExpeditionNodeType>(8).fill('resource'),
    'anomaly', 'anomaly', 'elite',
  ]
  const random = seededRandom((cycleSeed ^ Math.imul(zone, 0x9e3779b1)) >>> 0)
  for (let index = types.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[types[index], types[swapIndex]] = [types[swapIndex], types[index]]
  }
  types.push('boss')
  return types.map((type, index) => ({ id: `z${zone}-n${index + 1}`, zone, index: index + 1, type }))
}

function hashText(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getEventForNode(cycleSeed: number, nodeId: string): ExpeditionEventId {
  const index = (cycleSeed ^ hashText(nodeId)) >>> 0
  return EXPEDITION_EVENT_IDS[index % EXPEDITION_EVENT_IDS.length]
}

export function getZoneMasteryChallenges(state: ExpeditionSave, zone: number): ExpeditionMasteryChallengeId[] {
  return state.zoneMastery[String(clamp(Math.floor(zone), 1, 10))] ?? []
}

export function getZoneMasteryLevel(state: ExpeditionSave, zone: number): number {
  return Math.min(5, getZoneMasteryChallenges(state, zone).length)
}

export function getDistortionSourceZone(layer: number): number {
  return ((clamp(Math.floor(layer), 1, DISTORTION_MAX_LAYER) - 1) % 10) + 1
}

export function getDistortionRuleId(layer: number) {
  return DISTORTION_RULE_IDS[(clamp(Math.floor(layer), 1, DISTORTION_MAX_LAYER) - 1) % DISTORTION_RULE_IDS.length]
}

export function getDistortionAvailableMaxLayer(state: ExpeditionSave): number {
  return state.distortionUnlocked ? Math.min(DISTORTION_MAX_LAYER, state.highestDistortionCleared + 1) : 0
}

export function hasRelic(state: ExpeditionSave, relicId: ExpeditionRelicId): boolean {
  return state.equippedRelicIds.includes(relicId)
}

export function getTimeSandCap(state: ExpeditionSave): number {
  return BASE_TIME_SAND_CAP + (hasRelic(state, 'timeBottle') ? 30 : 0)
}

export function refreshExpeditionTime(state: ExpeditionSave, now = Date.now()): { state: ExpeditionSave; rollbackDetected: boolean } {
  if (now < state.lastTrustedAt - CLOCK_ROLLBACK_TOLERANCE_MS) {
    return { state, rollbackDetected: true }
  }
  const trustedNow = Math.max(now, state.lastTrustedAt)
  const cap = getTimeSandCap(state)
  const elapsed = Math.min(MAX_TIME_REGEN_MS, Math.max(0, trustedNow - state.timeSandUpdatedAt))
  const regenerated = Math.floor(elapsed / TIME_SAND_REGEN_MS)
  let timeSand = state.timeSand
  let timeSandUpdatedAt = state.timeSandUpdatedAt
  if (regenerated > 0) {
    timeSand = Math.min(cap, state.timeSand + regenerated)
    timeSandUpdatedAt = timeSand >= cap ? trustedNow : state.timeSandUpdatedAt + regenerated * TIME_SAND_REGEN_MS
  }
  return {
    state: { ...state, timeSand, timeSandUpdatedAt, lastTrustedAt: trustedNow },
    rollbackDetected: false,
  }
}

export function getNodeBaseRequirement(node: ExpeditionNode): number {
  const zone = EXPEDITION_ZONES[node.zone - 1]
  if (!zone) return Number.POSITIVE_INFINITY
  if (node.type === 'boss') return zone.basePower + 650
  return Math.floor((zone.basePower + 40 * (node.index - 1)) * NODE_TYPE_CONFIG[node.type].difficultyMultiplier)
}

export function calculateExpeditionPower(
  state: ExpeditionSave,
  context: ExpeditionContext,
  allocation: ExpeditionAllocation,
): { power: number; allocatedCps: number } {
  const allocatedCps = Math.max(0, context.effectiveAutoRate * allocation)
  const uniqueCount = Math.min(20, Math.max(0, Math.floor(context.uniqueBuildingCount)))
  const diversityPerBuilding = hasRelic(state, 'dimensionCompass') ? 20 : 15
  const basePower = 100 * Math.log10(1 + allocatedCps)
    + diversityPerBuilding * uniqueCount
    + EXPEDITION_ALLOCATIONS[allocation].powerBonus
  const hullMultiplier = 1 + state.tempUpgradeLevels.hull * 0.05
  const relicMultiplier = hasRelic(state, 'starChart') ? 1.08 : 1
  return { power: Math.max(0, Math.floor(basePower * hullMultiplier * relicMultiplier * state.cycleEventModifiers.powerMultiplier)), allocatedCps }
}

export function getTempUpgradeCost(level: number): number {
  return Math.ceil(40 * Math.pow(1.65, Math.max(0, Math.floor(level))))
}

export function getBlueprintSlotCount(state: ExpeditionSave): number {
  if (state.highestZoneUnlocked >= 8) return 3
  if (state.highestZoneUnlocked >= 4) return 2
  return state.unlocked ? 1 : 0
}

export function getBlueprintMultiplier(state: ExpeditionSave, buildingId: string): number {
  const activeSlots = state.blueprintSlots.slice(0, getBlueprintSlotCount(state))
  const slot = activeSlots.find(candidate => candidate.buildingId === buildingId)
  return 1 + (slot?.level ?? 0) * 0.1
}

export function getBlueprintUpgradeCost(slot: ExpeditionBlueprintSlot): number {
  return slot.level >= BLUEPRINT_LEVEL_COSTS.length ? 0 : BLUEPRINT_LEVEL_COSTS[slot.level]
}

function getReturnRate(state: ExpeditionSave, routeId: ExpeditionRouteId, extraBonus = 0): number {
  let rate = EXPEDITION_ROUTES[routeId].returnRate
    + state.tempUpgradeLevels.recovery * 0.02
    + state.cycleEventModifiers.returnRateBonus
    + extraBonus
  if (hasRelic(state, 'returnBeacon')) rate += 0.1
  if (routeId === 'anomaly' && hasRelic(state, 'abyssContract')) rate -= 0.1
  return Math.min(0.95, Math.max(0, rate))
}

function getDustMultiplier(state: ExpeditionSave, routeId: ExpeditionRouteId): number {
  let routeMultiplier = EXPEDITION_ROUTES[routeId].dustMultiplier
  if (routeId === 'safe' && hasRelic(state, 'safetyAnchor')) routeMultiplier = 0.85
  if (routeId === 'anomaly' && hasRelic(state, 'abyssContract')) routeMultiplier *= 1.2
  const scannerMultiplier = 1 + state.tempUpgradeLevels.scanner * 0.05
  const relicMultiplier = hasRelic(state, 'dustPrism') ? 1.15 : 1
  return routeMultiplier * scannerMultiplier * relicMultiplier * state.cycleEventModifiers.dustMultiplier
}

export function createExpeditionPreview(
  state: ExpeditionSave,
  context: ExpeditionContext,
  node: ExpeditionNode,
  routeId: ExpeditionRouteId,
  durationId: ExpeditionDurationId,
  allocation: ExpeditionAllocation,
): ExpeditionPreview {
  const route = EXPEDITION_ROUTES[routeId]
  const duration = EXPEDITION_DURATIONS[durationId]
  const nodeConfig = NODE_TYPE_CONFIG[node.type]
  const { power, allocatedCps } = calculateExpeditionPower(state, context, allocation)
  const masteryLevel = getZoneMasteryLevel(state, node.zone)
  const masteryRequirementMultiplier = 1 - masteryLevel * 0.015
  const masteryDustMultiplier = 1 + masteryLevel * 0.02
  const requiredPower = Math.ceil(getNodeBaseRequirement(node) * route.difficultyMultiplier * masteryRequirementMultiplier)
  const effectiveDurationSeconds = Math.max(60, Math.floor(duration.seconds * (1 - state.tempUpgradeLevels.sail * 0.04) * state.cycleEventModifiers.durationMultiplier))
  const returnRate = getReturnRate(state, routeId)
  const cubeReward = allocatedCps * effectiveDurationSeconds * returnRate
  const stardustReward = Math.floor(
    12
    * node.zone
    * duration.rewardMultiplier
    * getDustMultiplier(state, routeId)
    * EXPEDITION_ALLOCATIONS[allocation].dustMultiplier
    * nodeConfig.dustMultiplier
    * masteryDustMultiplier,
  )
  const firstClear = !state.firstClearNodeIds.includes(node.id)
  const fragmentAllowance = Math.max(0, MAX_CORE_FRAGMENTS_PER_REBIRTH - state.coreFragmentsEarnedThisRebirth)
  const coreFragmentReward = !firstClear && node.type === 'boss' ? Math.min(2, fragmentAllowance) : 0
  let reason = ''
  if (!state.unlocked) reason = '时空远征尚未解锁'
  else if (state.activeMission || state.pendingReward || state.pendingEvent) reason = '请先处理当前远征'
  else if (state.timeSand < duration.timeSandCost) reason = '远征体力不足'
  else if (node.zone > state.highestZoneUnlocked) reason = '该星域尚未解锁'
  else if (node.index > 1 && !state.clearedNodeIds.includes(`z${node.zone}-n${node.index - 1}`)) reason = '请先完成前一个节点'
  else if (power < requiredPower) reason = '远征战力不足'
  return {
    node,
    routeId,
    durationId,
    allocation,
    allocatedCps,
    power,
    requiredPower,
    effectiveDurationSeconds,
    timeSandCost: duration.timeSandCost,
    returnRate,
    cubeReward,
    stardustReward,
    coreReward: firstClear ? nodeConfig.firstClearCores : 0,
    coreFragmentReward,
    canLaunch: reason === '',
    reason,
    mode: 'standard',
  }
}

export function createDistortionPreview(
  state: ExpeditionSave,
  context: ExpeditionContext,
  layer: number,
  routeId: ExpeditionRouteId,
  durationId: ExpeditionDurationId,
  allocation: ExpeditionAllocation,
): ExpeditionPreview {
  const normalizedLayer = clamp(Math.floor(layer), 1, DISTORTION_MAX_LAYER)
  const sourceZone = getDistortionSourceZone(normalizedLayer)
  const ruleId = getDistortionRuleId(normalizedLayer)
  const rule = DISTORTION_RULES[ruleId]
  const route = EXPEDITION_ROUTES[routeId]
  const duration = EXPEDITION_DURATIONS[durationId]
  const node: ExpeditionNode = { id: `d${normalizedLayer}`, zone: sourceZone, index: normalizedLayer, type: 'boss' }
  const basePowerResult = calculateExpeditionPower(state, context, allocation)
  const power = Math.max(0, Math.floor(basePowerResult.power * rule.powerMultiplier))
  const masteryLevel = getZoneMasteryLevel(state, sourceZone)
  const masteryRequirementMultiplier = 1 - masteryLevel * 0.015
  const masteryDustMultiplier = 1 + masteryLevel * 0.02
  const baseRequirement = Math.floor(8550 * (1 + 0.03 * (normalizedLayer - 1)))
  const requiredPower = Math.ceil(baseRequirement * masteryRequirementMultiplier * rule.requirementMultiplier * route.difficultyMultiplier)
  const effectiveDurationSeconds = Math.max(60, Math.floor(
    duration.seconds
    * (1 - state.tempUpgradeLevels.sail * 0.04)
    * state.cycleEventModifiers.durationMultiplier
    * rule.durationMultiplier,
  ))
  const returnRate = getReturnRate(state, routeId, rule.returnRateBonus)
  const cubeReward = basePowerResult.allocatedCps * effectiveDurationSeconds * returnRate
  const layerDustMultiplier = 1 + 0.06 * (normalizedLayer - 1)
  const stardustReward = Math.floor(
    12
    * 10
    * duration.rewardMultiplier
    * getDustMultiplier(state, routeId)
    * EXPEDITION_ALLOCATIONS[allocation].dustMultiplier
    * NODE_TYPE_CONFIG.boss.dustMultiplier
    * layerDustMultiplier
    * rule.dustMultiplier
    * masteryDustMultiplier,
  )
  const firstClear = !state.distortionFirstClearLayers.includes(normalizedLayer)
  const coreReward = firstClear && (DISTORTION_MILESTONE_LAYERS as readonly number[]).includes(normalizedLayer) ? 1 : 0
  let reason = ''
  if (!state.distortionUnlocked) reason = '扭曲星域尚未解锁'
  else if (state.activeMission || state.pendingReward || state.pendingEvent) reason = '请先处理当前远征'
  else if (normalizedLayer > getDistortionAvailableMaxLayer(state)) reason = '请先完成前一扭曲层'
  else if (state.timeSand < duration.timeSandCost) reason = '远征体力不足'
  else if (power < requiredPower) reason = '远征战力不足'
  return {
    node,
    routeId,
    durationId,
    allocation,
    allocatedCps: basePowerResult.allocatedCps,
    power,
    requiredPower,
    effectiveDurationSeconds,
    timeSandCost: duration.timeSandCost,
    returnRate,
    cubeReward,
    stardustReward,
    coreReward,
    coreFragmentReward: 0,
    canLaunch: reason === '',
    reason,
    mode: 'distortion',
    distortionLayer: normalizedLayer,
    distortionRuleId: ruleId,
  }
}

export function launchExpedition(state: ExpeditionSave, preview: ExpeditionPreview, now = Date.now()): ExpeditionSave {
  if (
    !preview.canLaunch
    || state.activeMission
    || state.pendingReward
    || state.pendingEvent
    || state.timeSand < preview.timeSandCost
  ) return state
  const mission: ExpeditionMission = {
    id: `exp-${now}-${preview.node.id}`,
    nodeId: preview.node.id,
    zone: preview.node.zone,
    nodeIndex: preview.node.index,
    nodeType: preview.node.type,
    routeId: preview.routeId,
    durationId: preview.durationId,
    allocation: preview.allocation,
    allocatedCps: preview.allocatedCps,
    power: preview.power,
    requiredPower: preview.requiredPower,
    startAt: now,
    endAt: now + preview.effectiveDurationSeconds * 1000,
    fullRefundUntil: now + 30_000,
    timeSandCost: preview.timeSandCost,
    cubeReward: preview.cubeReward,
    stardustReward: preview.stardustReward,
    coreReward: preview.coreReward,
    coreFragmentReward: preview.coreFragmentReward,
    mode: preview.mode,
    distortionLayer: preview.distortionLayer,
    distortionRuleId: preview.distortionRuleId,
  }
  return { ...state, timeSand: state.timeSand - preview.timeSandCost, activeMission: mission }
}

export function completeExpedition(state: ExpeditionSave, now = Date.now()): ExpeditionSave {
  if (!state.activeMission || now < state.activeMission.endAt || state.pendingReward || state.pendingEvent) return state
  const reward: ExpeditionReward = { ...state.activeMission, completedAt: now }
  const triggersEvent = reward.mode === 'standard'
    && (reward.nodeType === 'anomaly' || reward.nodeType === 'elite')
    && !state.resolvedEventNodeIds.includes(reward.nodeId)
  return {
    ...state,
    activeMission: null,
    pendingReward: reward,
    pendingEvent: triggersEvent
      ? { missionId: reward.id, nodeId: reward.nodeId, eventId: getEventForNode(state.cycleSeed, reward.nodeId) }
      : null,
  }
}

export function cancelExpedition(state: ExpeditionSave, now = Date.now()): ExpeditionSave {
  if (!state.activeMission) return state
  const refundRate = now <= state.activeMission.fullRefundUntil ? 1 : 0.5
  const timeSand = Math.min(getTimeSandCap(state), state.timeSand + state.activeMission.timeSandCost * refundRate)
  return { ...state, timeSand, activeMission: null }
}

function clampedEventModifiers(modifiers: ExpeditionEventModifiers): ExpeditionEventModifiers {
  return {
    powerMultiplier: clamp(modifiers.powerMultiplier, 0.90, 1.15),
    dustMultiplier: clamp(modifiers.dustMultiplier, 0.85, 1.25),
    returnRateBonus: clamp(modifiers.returnRateBonus, -0.05, 0.05),
    durationMultiplier: clamp(modifiers.durationMultiplier, 0.85, 1.10),
  }
}

export function resolveExpeditionEvent(
  state: ExpeditionSave,
  optionId: ExpeditionEventOptionId,
): ExpeditionSave {
  const event = state.pendingEvent
  const reward = state.pendingReward
  if (!event || !reward || event.missionId !== reward.id || (optionId !== 'a' && optionId !== 'b')) return state

  let dustMultiplier = 1
  let cubeMultiplier = 1
  let timeSandRefund = 0
  const modifiers = { ...state.cycleEventModifiers }
  const multiplyModifier = (key: 'powerMultiplier' | 'dustMultiplier' | 'durationMultiplier', value: number) => {
    modifiers[key] *= value
  }

  switch (event.eventId) {
    case 'lostCargo':
      if (optionId === 'a') dustMultiplier = 1.60
      else cubeMultiplier = 1.18
      break
    case 'timeWhirlpool':
      if (optionId === 'a') timeSandRefund = 8
      else { multiplyModifier('durationMultiplier', 0.85); multiplyModifier('powerMultiplier', 0.90) }
      break
    case 'unstableCrystal':
      if (optionId === 'a') { dustMultiplier = 1.90; multiplyModifier('powerMultiplier', 0.92) }
      else dustMultiplier = 1.35
      break
    case 'driftingFleet':
      if (optionId === 'a') { multiplyModifier('powerMultiplier', 1.10); multiplyModifier('dustMultiplier', 0.90) }
      else cubeMultiplier = 1.15
      break
    case 'ancientBeacon':
      if (optionId === 'a') { modifiers.returnRateBonus += 0.05; multiplyModifier('dustMultiplier', 0.90) }
      else dustMultiplier = 1.45
      break
    case 'dimensionalTide':
      if (optionId === 'a') { multiplyModifier('dustMultiplier', 1.20); modifiers.returnRateBonus -= 0.05 }
      else { timeSandRefund = 3; dustMultiplier = 1.30 }
      break
    case 'brokenGate':
      if (optionId === 'a') { multiplyModifier('durationMultiplier', 0.85); modifiers.returnRateBonus -= 0.03 }
      else multiplyModifier('powerMultiplier', 1.08)
      break
    case 'mirrorUniverse':
      if (optionId === 'a') { dustMultiplier = 1.65; cubeMultiplier = 0.85 }
      else { cubeMultiplier = 1.15; dustMultiplier = 0.80 }
      break
  }

  const missionSeconds = Math.max(0, (reward.endAt - reward.startAt) / 1000)
  const cubeRewardCap = reward.allocatedCps * missionSeconds * 0.95
  const nextReward: ExpeditionReward = {
    ...reward,
    cubeReward: Math.min(cubeRewardCap, Math.max(0, reward.cubeReward * cubeMultiplier)),
    stardustReward: Math.max(0, Math.floor(reward.stardustReward * dustMultiplier)),
  }
  return {
    ...state,
    timeSand: Math.min(getTimeSandCap(state), state.timeSand + timeSandRefund),
    pendingReward: nextReward,
    pendingEvent: null,
    resolvedEventNodeIds: [...new Set([...state.resolvedEventNodeIds, event.nodeId])],
    cycleEventModifiers: clampedEventModifiers(modifiers),
  }
}

export function claimExpeditionReward(state: ExpeditionSave): { state: ExpeditionSave; cubeReward: number } {
  const reward = state.pendingReward
  if (!reward || state.pendingEvent) return { state, cubeReward: 0 }
  const isStandard = reward.mode !== 'distortion'
  const firstClearNodeIds = isStandard && reward.coreReward > 0
    ? [...new Set([...state.firstClearNodeIds, reward.nodeId])]
    : state.firstClearNodeIds
  const clearedNodeIds = isStandard ? [...new Set([...state.clearedNodeIds, reward.nodeId])] : state.clearedNodeIds
  const fragmentsEarned = Math.min(
    MAX_CORE_FRAGMENTS_PER_REBIRTH - state.coreFragmentsEarnedThisRebirth,
    isStandard ? reward.coreFragmentReward : 0,
  )
  let coreFragments = state.coreFragments + fragmentsEarned
  const fragmentCores = Math.floor(coreFragments / CORE_FRAGMENT_EXCHANGE_SIZE)
  coreFragments %= CORE_FRAGMENT_EXCHANGE_SIZE
  const highestZoneUnlocked = isStandard && reward.nodeType === 'boss'
    ? Math.min(10, Math.max(state.highestZoneUnlocked, reward.zone + 1))
    : state.highestZoneUnlocked
  const zoneMastery = { ...state.zoneMastery }
  if (isStandard && reward.nodeType === 'boss') {
    const earned = new Set(zoneMastery[String(reward.zone)] ?? [])
    earned.add('firstBoss')
    earned.add(`${reward.routeId}Boss` as ExpeditionMasteryChallengeId)
    if (reward.allocation === 0.1) earned.add('lightBoss')
    zoneMastery[String(reward.zone)] = [...earned]
  }
  const distortionLayer = reward.mode === 'distortion' ? reward.distortionLayer : undefined
  const distortionFirstClearLayers = distortionLayer
    ? [...new Set([...state.distortionFirstClearLayers, distortionLayer])]
    : state.distortionFirstClearLayers
  const highestDistortionCleared = distortionLayer
    ? Math.max(state.highestDistortionCleared, distortionLayer)
    : state.highestDistortionCleared
  const distortionUnlocked = state.distortionUnlocked || (isStandard && reward.nodeType === 'boss' && reward.zone === 10)
  return {
    state: {
      ...state,
      stardust: state.stardust + reward.stardustReward,
      chronoCores: state.chronoCores + reward.coreReward + fragmentCores,
      coreFragments,
      coreFragmentsEarnedThisRebirth: state.coreFragmentsEarnedThisRebirth + fragmentsEarned,
      firstClearNodeIds,
      clearedNodeIds,
      highestZoneUnlocked,
      zoneMastery,
      distortionUnlocked,
      highestDistortionCleared,
      distortionFirstClearLayers,
      pendingReward: null,
    },
    cubeReward: reward.cubeReward,
  }
}

export function resetExpeditionCycle(state: ExpeditionSave, now = Date.now()): ExpeditionSave {
  const retainedStardust = hasRelic(state, 'cycleCore') ? Math.floor(state.stardust * 0.15) : 0
  return {
    ...state,
    stardust: retainedStardust,
    coreFragmentsEarnedThisRebirth: 0,
    clearedNodeIds: [],
    resolvedEventNodeIds: [],
    pendingEvent: null,
    cycleEventModifiers: { ...DEFAULT_EVENT_MODIFIERS },
    cycleSeed: randomExpeditionSeed(),
    tempUpgradeLevels: { ...DEFAULT_TEMP_LEVELS },
    activeMission: null,
    pendingReward: null,
    timeSandUpdatedAt: now,
    lastTrustedAt: now,
  }
}

export function getActiveAllocation(state: ExpeditionSave, now = Date.now()): ExpeditionAllocation | 0 {
  return state.activeMission && now < state.activeMission.endAt ? state.activeMission.allocation : 0
}

export function getMissionRemainingSeconds(state: ExpeditionSave, now = Date.now()): number {
  return state.activeMission ? Math.max(0, Math.ceil((state.activeMission.endAt - now) / 1000)) : 0
}
