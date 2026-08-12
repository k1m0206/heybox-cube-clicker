import type {
  DistortionRuleId,
  ExpeditionAllocation,
  ExpeditionDurationId,
  ExpeditionEventId,
  ExpeditionEventOptionId,
  ExpeditionMasteryChallengeId,
  ExpeditionNodeType,
  ExpeditionRelicId,
  ExpeditionRouteId,
  ExpeditionTempUpgradeId,
} from './types'

export const EXPEDITION_ASSET_BASE = `${import.meta.env.BASE_URL}assets/expedition`
export const GALAXY_BUILDING_INDEX = 8
export const BASE_TIME_SAND_CAP = 100
export const TIME_SAND_REGEN_MS = 10 * 60 * 1000
export const MAX_TIME_REGEN_MS = 72 * 60 * 60 * 1000
export const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000
export const MAX_CORE_FRAGMENTS_PER_REBIRTH = 30
export const CORE_FRAGMENT_EXCHANGE_SIZE = 10
export const BLUEPRINT_LEVEL_COSTS = [3, 5, 8, 13, 21] as const
export const BLUEPRINT_REASSIGN_COST = 500
export const DISTORTION_MAX_LAYER = 20
export const DISTORTION_MILESTONE_LAYERS = [5, 10, 15, 20] as const

export const EXPEDITION_ZONES = [
  { id: 1, name: '银河边缘', basePower: 1600, stage: '银河引擎', banner: 'zones/zone-1.webp', boss: 'bosses/boss-1.webp' },
  { id: 2, name: '虚空航道', basePower: 2300, stage: '创世引擎 · 终极奇点', banner: 'zones/zone-2.webp', boss: 'bosses/boss-1.webp' },
  { id: 3, name: '因果裂层', basePower: 3000, stage: '因果编织机 · 超维母舰', banner: 'zones/zone-3.webp', boss: 'bosses/boss-2.webp' },
  { id: 4, name: '终焉观测域', basePower: 3700, stage: '终焉观测站 · 深渊熔炉', banner: 'zones/zone-4.webp', boss: 'bosses/boss-2.webp' },
  { id: 5, name: '超越界海', basePower: 4400, stage: '永恒引擎 · 超越之门', banner: 'zones/zone-5.webp', boss: 'bosses/boss-3.webp' },
  { id: 6, name: '真理回廊', basePower: 5100, stage: '真理矩阵 · 维度海汲取器', banner: 'zones/zone-6.webp', boss: 'bosses/boss-3.webp' },
  { id: 7, name: '公理荒原', basePower: 5800, stage: '公理铸造机', banner: 'zones/zone-7.webp', boss: 'bosses/boss-4.webp' },
  { id: 8, name: '阿卡西深层', basePower: 6500, stage: '命运演算核心 · 阿卡西记录库', banner: 'zones/zone-8.webp', boss: 'bosses/boss-4.webp' },
  { id: 9, name: '超限天幕', basePower: 7200, stage: '超限计算机', banner: 'zones/zone-9.webp', boss: 'bosses/boss-5.webp' },
  { id: 10, name: '零点王座', basePower: 7900, stage: '太初发生器 · 零点奇点塔', banner: 'zones/zone-10.webp', boss: 'bosses/boss-5.webp' },
] as const

export const EXPEDITION_ALLOCATIONS: Record<ExpeditionAllocation, { label: string; powerBonus: number; dustMultiplier: number }> = {
  0.1: { label: '轻装 10%', powerBonus: -100, dustMultiplier: 0.75 },
  0.25: { label: '标准 25%', powerBonus: 0, dustMultiplier: 1 },
  0.5: { label: '全力 50%', powerBonus: 150, dustMultiplier: 1.35 },
}

export const EXPEDITION_ROUTES: Record<ExpeditionRouteId, {
  name: string
  difficultyMultiplier: number
  dustMultiplier: number
  returnRate: number
  image: string
}> = {
  safe: { name: '安全航线', difficultyMultiplier: 0.9, dustMultiplier: 0.7, returnRate: 0.9, image: 'routes/safe.webp' },
  standard: { name: '标准航线', difficultyMultiplier: 1, dustMultiplier: 1, returnRate: 0.75, image: 'routes/standard.webp' },
  anomaly: { name: '异常航线', difficultyMultiplier: 1.15, dustMultiplier: 1.5, returnRate: 0.5, image: 'routes/anomaly.webp' },
}

export const EXPEDITION_DURATIONS: Record<ExpeditionDurationId, {
  name: string
  seconds: number
  timeSandCost: number
  rewardMultiplier: number
}> = {
  '15m': { name: '15分钟', seconds: 15 * 60, timeSandCost: 5, rewardMultiplier: 1 },
  '1h': { name: '1小时', seconds: 60 * 60, timeSandCost: 15, rewardMultiplier: 3 },
  '4h': { name: '4小时', seconds: 4 * 60 * 60, timeSandCost: 40, rewardMultiplier: 8 },
  '12h': { name: '12小时', seconds: 12 * 60 * 60, timeSandCost: 90, rewardMultiplier: 18 },
}

export const NODE_TYPE_CONFIG: Record<ExpeditionNodeType, {
  name: string
  difficultyMultiplier: number
  dustMultiplier: number
  firstClearCores: number
}> = {
  resource: { name: '资源节点', difficultyMultiplier: 1, dustMultiplier: 1, firstClearCores: 1 },
  anomaly: { name: '异常节点', difficultyMultiplier: 1.05, dustMultiplier: 1.15, firstClearCores: 1 },
  elite: { name: '精英节点', difficultyMultiplier: 1.1, dustMultiplier: 1.5, firstClearCores: 2 },
  boss: { name: '星域首领', difficultyMultiplier: 1, dustMultiplier: 2, firstClearCores: 4 },
}

export const TEMP_UPGRADES: Record<ExpeditionTempUpgradeId, {
  name: string
  desc: string
  maxLevel: number
}> = {
  hull: { name: '舰体扩张', desc: '远征战力 +5%', maxLevel: 10 },
  scanner: { name: '货币扫描', desc: '远征货币收益 +5%', maxLevel: 10 },
  recovery: { name: '物质回收', desc: 'cube返还率 +2%', maxLevel: 8 },
  sail: { name: '时空帆', desc: '远征时间 -4%', maxLevel: 5 },
}

export const RELICS: Record<ExpeditionRelicId, {
  name: string
  desc: string
  cost: number
  image: string
}> = {
  starChart: { name: '探路星盘', desc: '远征战力 +8%', cost: 8, image: 'relics/star-chart.webp' },
  dustPrism: { name: '聚尘棱镜', desc: '远征货币收益 +15%', cost: 10, image: 'relics/dust-prism.webp' },
  returnBeacon: { name: '回收信标', desc: 'cube返还率 +10%', cost: 10, image: 'relics/return-beacon.webp' },
  dimensionCompass: { name: '维度罗盘', desc: '每种建筑额外 +5 战力，最多 +100', cost: 12, image: 'relics/dimension-compass.webp' },
  safetyAnchor: { name: '安全锚', desc: '安全航线远征货币倍率提升至 ×0.85', cost: 12, image: 'relics/safety-anchor.webp' },
  abyssContract: { name: '深渊契约', desc: '异常航线远征货币 +20%，返还率 -10%', cost: 14, image: 'relics/abyss-contract.webp' },
  timeBottle: { name: '体力之瓶', desc: '远征体力上限 +30', cost: 14, image: 'relics/time-bottle.webp' },
  cycleCore: { name: '循环核心', desc: '转生时保留 15% 远征货币', cost: 16, image: 'relics/cycle-core.webp' },
}

export const RELIC_IDS = Object.keys(RELICS) as ExpeditionRelicId[]
export const TEMP_UPGRADE_IDS = Object.keys(TEMP_UPGRADES) as ExpeditionTempUpgradeId[]

export const MASTERY_CHALLENGES: Record<ExpeditionMasteryChallengeId, { name: string; desc: string }> = {
  firstBoss: { name: '首领初破', desc: '击败该星域首领' },
  safeBoss: { name: '安全制霸', desc: '使用安全航线击败首领' },
  standardBoss: { name: '标准制霸', desc: '使用标准航线击败首领' },
  anomalyBoss: { name: '异常制霸', desc: '使用异常航线击败首领' },
  lightBoss: { name: '轻装制霸', desc: '以10%投入击败首领' },
}

export const MASTERY_CHALLENGE_IDS = Object.keys(MASTERY_CHALLENGES) as ExpeditionMasteryChallengeId[]

interface ExpeditionEventOptionConfig {
  id: ExpeditionEventOptionId
  name: string
  desc: string
}

export const EXPEDITION_EVENTS: Record<ExpeditionEventId, {
  name: string
  desc: string
  image: string
  options: [ExpeditionEventOptionConfig, ExpeditionEventOptionConfig]
}> = {
  lostCargo: {
    name: '遗失货舱', desc: '一组封存货舱漂浮在破碎航道中央。', image: 'events/lost-cargo.webp',
    options: [{ id: 'a', name: '回收货舱', desc: '本次远征货币 ×1.25' }, { id: 'b', name: '拆解修复', desc: '本次cube奖励 ×1.08' }],
  },
  timeWhirlpool: {
    name: '时间涡流', desc: '失控的时间流在舰队周围形成闭环。', image: 'events/time-whirlpool.webp',
    options: [{ id: 'a', name: '抽取余能', desc: '返还2远征体力' }, { id: 'b', name: '借道穿行', desc: '本轮时间 ×0.96，战力 ×0.98' }],
  },
  unstableCrystal: {
    name: '不稳定晶簇', desc: '高能晶体正在崩解，短暂释放巨量物质。', image: 'events/unstable-crystal.webp',
    options: [{ id: 'a', name: '过载采集', desc: '本次远征货币 ×1.40，本轮战力 ×0.98' }, { id: 'b', name: '安全封存', desc: '本次远征货币 ×1.15' }],
  },
  driftingFleet: {
    name: '漂流舰队', desc: '失去指挥的无人舰队仍在执行古老指令。', image: 'events/drifting-fleet.webp',
    options: [{ id: 'a', name: '接入编队', desc: '本轮战力 ×1.03，远征货币 ×0.98' }, { id: 'b', name: '援助回收', desc: '本次cube奖励 ×1.05' }],
  },
  ancientBeacon: {
    name: '古代信标', desc: '沉睡的信标能够校准返航坐标。', image: 'events/ancient-beacon.webp',
    options: [{ id: 'a', name: '重新校准', desc: '本轮返还率 +2%，远征货币 ×0.98' }, { id: 'b', name: '拆解信标', desc: '本次远征货币 ×1.20' }],
  },
  dimensionalTide: {
    name: '维度潮汐', desc: '物质潮汐正在横穿当前星域。', image: 'events/dimensional-tide.webp',
    options: [{ id: 'a', name: '顺潮采集', desc: '本轮远征货币 ×1.05，返还率 −2%' }, { id: 'b', name: '规避浪涌', desc: '返还1远征体力，本次远征货币 ×1.10' }],
  },
  brokenGate: {
    name: '破损跃迁门', desc: '半毁的跃迁门仍残留可用的空间坐标。', image: 'events/broken-gate.webp',
    options: [{ id: 'a', name: '强制重启', desc: '本轮时间 ×0.96，返还率 −1%' }, { id: 'b', name: '提取结构', desc: '本轮战力 ×1.02' }],
  },
  mirrorUniverse: {
    name: '镜像宇宙', desc: '舰队短暂接触到一个资源分布相反的镜像世界。', image: 'events/mirror-universe.webp',
    options: [{ id: 'a', name: '复制物质', desc: '本次远征货币 ×1.30，cube ×0.95' }, { id: 'b', name: '复制cube', desc: '本次cube ×1.05，远征货币 ×0.90' }],
  },
}

export const EXPEDITION_EVENT_IDS = Object.keys(EXPEDITION_EVENTS) as ExpeditionEventId[]

export const DISTORTION_RULES: Record<DistortionRuleId, {
  name: string
  desc: string
  requirementMultiplier: number
  powerMultiplier: number
  durationMultiplier: number
  returnRateBonus: number
  dustMultiplier: number
}> = {
  denseGravity: { name: '致密引力', desc: '需求战力提高，远征货币同步增加。', requirementMultiplier: 1.08, powerMultiplier: 1, durationMultiplier: 1, returnRateBonus: 0, dustMultiplier: 1.12 },
  timeFracture: { name: '时间断层', desc: '航行时间延长，远征货币同步增加。', requirementMultiplier: 1, powerMultiplier: 1, durationMultiplier: 1.10, returnRateBonus: 0, dustMultiplier: 1.12 },
  matterLeak: { name: '物质泄漏', desc: 'cube返还降低，远征货币显著增加。', requirementMultiplier: 1, powerMultiplier: 1, durationMultiplier: 1, returnRateBonus: -0.05, dustMultiplier: 1.15 },
  energyNoise: { name: '能量噪声', desc: '最终战力受到压制，远征货币同步增加。', requirementMultiplier: 1, powerMultiplier: 0.95, durationMultiplier: 1, returnRateBonus: 0, dustMultiplier: 1.10 },
}

export const DISTORTION_RULE_IDS: DistortionRuleId[] = ['denseGravity', 'timeFracture', 'matterLeak', 'energyNoise']
