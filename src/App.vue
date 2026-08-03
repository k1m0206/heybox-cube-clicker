<script setup lang="ts">
import hbSDK, { type LeaderboardEntry, type MiniProgramUserInfo } from '@heybox/hb-sdk'
import { ref, computed, onMounted, onUnmounted, type Component } from 'vue'
import { cubeEmojis } from './data/emojis'
import {
  Hammer, Bot, Factory, Rocket, Diamond, Orbit, Globe, Sparkles,
  RotateCcw, Trash2, ShoppingCart, Zap, Landmark, RotateCw, Palette,
  Swords, Crown, Star, Flame, Sun, Atom, Heart, Shield, CircuitBoard,
  MousePointerClick, TrendingUp, Timer, Percent, Gift, ArrowUpCircle,
  Trophy, RefreshCw, UserRound,
} from '@lucide/vue'

// ============ Tab 系统 ============
type TabId = 'click' | 'shop' | 'rebirth' | 'leaderboard'
const activeTab = ref<TabId>('click')

// ============ 等级排行榜 ============
const LEVEL_LEADERBOARD_KEY = 'cube_clicker_level'
const LEVEL_LEADERBOARD_LIMIT = 100
const BASE_LEVEL_UP_COST = 10000
const LEVEL_UP_COST_GROWTH = 1.5
const LOCAL_LEADERBOARD_PREVIEW = import.meta.env.DEV
const GAME_BACKGROUND_URL = new URL(
  `${import.meta.env.BASE_URL}assets/ui/game-background-v2.png`,
  document.baseURI,
).href

const playerLevel = ref(1)
const currentUser = ref<MiniProgramUserInfo | null>(null)
const sdkConnected = ref(false)
const authLoading = ref(false)
const levelUpLoading = ref(false)
const leaderboardLoading = ref(false)
const leaderboardEntries = ref<LeaderboardEntry[]>([])
const leaderboardMessage = ref('')
const leaderboardHasError = ref(false)
let stopAuthListener: (() => void) | undefined

const nextLevelCost = computed(() => {
  const cost = BASE_LEVEL_UP_COST * Math.pow(LEVEL_UP_COST_GROWTH, playerLevel.value - 1)
  return Number.isFinite(cost) ? Math.ceil(cost) : Number.POSITIVE_INFINITY
})

const canLevelUp = computed(() =>
  !levelUpLoading.value && Number.isFinite(nextLevelCost.value) && cubeCount.value >= nextLevelCost.value,
)

// ============ 建筑系统 ============
interface Building {
  id: string
  name: string
  icon: Component
  baseCps: number
  baseCost: number
  count: number
  unlockAt: number
}

const buildings = ref<Building[]>([
  { id: 'robot',    name: '小机器人',     icon: Bot,       baseCps: 1,        baseCost: 50,            count: 0, unlockAt: 0 },
  { id: 'factory',  name: '迷你工厂',     icon: Factory,   baseCps: 5,        baseCost: 300,           count: 0, unlockAt: 300 },
  { id: 'super',    name: '超级工厂',     icon: Rocket,    baseCps: 20,       baseCost: 1500,          count: 0, unlockAt: 1500 },
  { id: 'quantum',  name: '量子农场',     icon: Orbit,     baseCps: 100,      baseCost: 10000,         count: 0, unlockAt: 8000 },
  { id: 'star',     name: '星际矿场',     icon: Globe,     baseCps: 500,      baseCost: 60000,         count: 0, unlockAt: 40000 },
  { id: 'reaper',   name: '维度收割者',   icon: Atom,      baseCps: 2000,     baseCost: 350000,        count: 0, unlockAt: 200000 },
  { id: 'sun',      name: '太阳熔炉',     icon: Sun,       baseCps: 10000,    baseCost: 2000000,       count: 0, unlockAt: 1000000 },
  { id: 'rift',     name: '时空裂缝',     icon: Flame,     baseCps: 50000,    baseCost: 12000000,      count: 0, unlockAt: 6000000 },
  { id: 'galaxy',   name: '银河引擎',     icon: Star,      baseCps: 250000,   baseCost: 80000000,      count: 0, unlockAt: 30000000 },
  { id: 'void',     name: '虚空提取器',   icon: Crown,     baseCps: 1200000,  baseCost: 500000000,     count: 0, unlockAt: 150000000 },
  { id: 'genesis',  name: '创世引擎',     icon: Diamond,   baseCps: 6000000,  baseCost: 3500000000,    count: 0, unlockAt: 800000000 },
  { id: 'omega',    name: '终极奇点',     icon: Sparkles,  baseCps: 30000000, baseCost: 25000000000,   count: 0, unlockAt: 4000000000 },
])

// ============ 机器人协同升级 ============
interface SynergyUpgrade {
  id: string
  name: string
  icon: Component
  desc: string
  cost: number
  bought: boolean
  targetBuildingId: string
  requiredRobots: number
  unlockAt: number
}

const synergyUpgrades = ref<SynergyUpgrade[]>([
  { id: 'syn1', name: '齿轮之心',   icon: Heart,    desc: '机器人产出翻倍。每拥有1个机器人，迷你工厂 +1% 产出', cost: 2000,       bought: false, targetBuildingId: 'factory', requiredRobots: 1, unlockAt: 1000 },
  { id: 'syn2', name: '钢铁之魂',   icon: Shield,   desc: '机器人产出翻倍。每拥有2个机器人，超级工厂 +1% 产出', cost: 10000,      bought: false, targetBuildingId: 'super',   requiredRobots: 2, unlockAt: 6000 },
  { id: 'syn3', name: '量子共振',   icon: Atom,     desc: '机器人产出翻倍。每拥有3个机器人，量子农场 +1% 产出', cost: 50000,      bought: false, targetBuildingId: 'quantum', requiredRobots: 3, unlockAt: 30000 },
  { id: 'syn4', name: '星际链接',   icon: Globe,    desc: '机器人产出翻倍。每拥有4个机器人，星际矿场 +1% 产出', cost: 250000,     bought: false, targetBuildingId: 'star',    requiredRobots: 4, unlockAt: 120000 },
  { id: 'syn5', name: '维度通道',   icon: Orbit,    desc: '机器人产出翻倍。每拥有5个机器人，维度收割者 +1% 产出', cost: 1200000,    bought: false, targetBuildingId: 'reaper',  requiredRobots: 5, unlockAt: 500000 },
  { id: 'syn6', name: '日冕协议',   icon: Sun,      desc: '机器人产出翻倍。每拥有6个机器人，太阳熔炉 +1% 产出', cost: 6000000,    bought: false, targetBuildingId: 'sun',     requiredRobots: 6, unlockAt: 2500000 },
  { id: 'syn7', name: '时空编织',   icon: Sparkles, desc: '机器人产出翻倍。每拥有7个机器人，时空裂缝 +1% 产出', cost: 30000000,   bought: false, targetBuildingId: 'rift',    requiredRobots: 7, unlockAt: 12000000 },
  { id: 'syn8', name: '银河之链',   icon: Star,     desc: '机器人产出翻倍。每拥有8个机器人，银河引擎 +1% 产出', cost: 150000000,  bought: false, targetBuildingId: 'galaxy',  requiredRobots: 8, unlockAt: 50000000 },
  { id: 'syn9', name: '虚空共鸣',   icon: Crown,    desc: '机器人产出翻倍。每拥有9个机器人，虚空提取器 +1% 产出', cost: 800000000,  bought: false, targetBuildingId: 'void',    requiredRobots: 9, unlockAt: 200000000 },
  { id: 'syn10', name: '创世回响',  icon: Diamond,  desc: '机器人产出翻倍。每拥有10个机器人，创世引擎 +1% 产出', cost: 4000000000, bought: false, targetBuildingId: 'genesis', requiredRobots: 10, unlockAt: 1000000000 },
  { id: 'syn11', name: '奇点共振',  icon: Flame,    desc: '机器人产出翻倍。每拥有11个机器人，终极奇点 +1% 产出', cost: 20000000000,bought: false, targetBuildingId: 'omega',   requiredRobots: 11, unlockAt: 5000000000 },
])

const robotDoubles = ref(0)
const robotBaseCps = computed(() => (buildings.value[0]?.baseCps ?? 1) * Math.pow(2, robotDoubles.value))

function getBuildingCps(building: Building): number {
  if (building.count === 0) return 0
  let cps = building.id === 'robot' ? robotBaseCps.value : building.baseCps
  if (building.id !== 'robot') {
    const robotCount = buildings.value[0].count
    for (const syn of synergyUpgrades.value) {
      if (syn.bought && syn.targetBuildingId === building.id && robotCount >= syn.requiredRobots) {
        cps += building.baseCps * Math.floor(robotCount / syn.requiredRobots) / 100
      }
    }
  }
  return cps * building.count
}

const totalCps = computed(() => {
  let total = 0
  for (const b of buildings.value) total += getBuildingCps(b)
  return Math.floor(total * heritageMultiplier.value * rebirthAutoMultiplier.value)
})

function getBuildingDisplayCps(b: Building) { return Math.floor(getBuildingCps(b) * heritageMultiplier.value * rebirthAutoMultiplier.value) }

function getBuildingCost(building: Building, count = 1): number {
  const discount = 1 - rebirthBuildingDiscount.value
  return getGeometricBulkCost(building.baseCost * discount, 1.2, building.count, count)
}

function getBuildingBuyCount(building: Building): number {
  if (buyMode.value === 'max') {
    return getMaxAffordableCount(cubeCount.value, count => getBuildingCost(building, count))
  }
  return buyMode.value as number
}

function buyBuilding(building: Building) {
  const count = getBuildingBuyCount(building)
  if (count <= 0) return
  const total = getBuildingCost(building, count)
  if (cubeCount.value >= total) { cubeCount.value -= total; building.count += count }
}

function buySynergyUpgrade(syn: SynergyUpgrade) {
  if (syn.bought || cubeCount.value < syn.cost) return
  cubeCount.value -= syn.cost; syn.bought = true; robotDoubles.value++
}

const visibleBuildings = computed(() => buildings.value.filter(b => totalCubesEver.value >= b.unlockAt))
const visibleSynergyUpgrades = computed(() => synergyUpgrades.value.filter(s => !s.bought && totalCubesEver.value >= s.unlockAt))

// ============ 核心数据 ============
const cubeCount = ref(0)
const clickPower = ref(1)
const totalCubesEver = ref(0)
const totalClicks = ref(0)
const rebirthCount = ref(0)
const heritagePoints = ref(0)
const heritageMultiplier = ref(1)
const rebirthAutoClick = ref(0)

const effectiveClickPower = computed(() => Math.floor(clickPower.value * heritageMultiplier.value * rebirthClickMultiplier.value))
const effectiveAutoRate = computed(() => totalCps.value)

// ============ 批量购买 ============
const buyModes = [1, 10, 100] as const
type BuyMode = typeof buyModes[number] | 'max'
const buyMode = ref<BuyMode>(1)
function setBuyMode(m: BuyMode) { buyMode.value = m }

// ============ 点击升级 ============
interface ClickUpgrade {
  id: string; name: string; icon: Component; desc: string
  baseCost: number; cost: number; level: number
  effect: (count: number) => void; unlockAt?: number; maxLevel?: number
}

const clickUpgrades = ref<ClickUpgrade[]>([
  { id: 'click1', name: '更硬的锤子', icon: Hammer, desc: '每次点击 +1', baseCost: 15, cost: 15, level: 0, effect: (n) => { clickPower.value += n } },
  { id: 'click5', name: '钻石锤子', icon: Diamond, desc: '每次点击 +5', baseCost: 800, cost: 800, level: 0, unlockAt: 500, effect: (n) => { clickPower.value += 5 * n } },
  { id: 'click20', name: '雷神之锤', icon: Swords, desc: '每次点击 +20', baseCost: 5000, cost: 5000, level: 0, unlockAt: 3000, effect: (n) => { clickPower.value += 20 * n } },
  { id: 'click100', name: '王者权杖', icon: Crown, desc: '每次点击 +100', baseCost: 35000, cost: 35000, level: 0, unlockAt: 20000, effect: (n) => { clickPower.value += 100 * n } },
  { id: 'click500', name: '星辰之触', icon: Star, desc: '每次点击 +500', baseCost: 250000, cost: 250000, level: 0, unlockAt: 150000, effect: (n) => { clickPower.value += 500 * n } },
  { id: 'click2000', name: '次元之手', icon: Atom, desc: '每次点击 +2000', baseCost: 2000000, cost: 2000000, level: 0, unlockAt: 1000000, effect: (n) => { clickPower.value += 2000 * n } },
  { id: 'click10000', name: '宇宙权柄', icon: Globe, desc: '每次点击 +10000', baseCost: 15000000, cost: 15000000, level: 0, unlockAt: 8000000, effect: (n) => { clickPower.value += 10000 * n } },
  { id: 'click50000', name: '创世之锤', icon: Sun, desc: '每次点击 +50000', baseCost: 120000000, cost: 120000000, level: 0, unlockAt: 60000000, effect: (n) => { clickPower.value += 50000 * n } },
  { id: 'click200000', name: '奇点之力', icon: Flame, desc: '每次点击 +200000', baseCost: 1000000000, cost: 1000000000, level: 0, unlockAt: 500000000, effect: (n) => { clickPower.value += 200000 * n } },
])

// 自动点击升级：根据每秒产量动态解锁和定价
const autoClickTiers = [
  { cpsRequired: 1000,     cost: 100000 },      // 1k/秒 → 10万
  { cpsRequired: 10000,    cost: 1000000 },      // 1万/秒 → 100万
  { cpsRequired: 100000,   cost: 10000000 },     // 10万/秒 → 1000万
  { cpsRequired: 1000000,  cost: 100000000 },    // 100万/秒 → 1亿
  { cpsRequired: 10000000, cost: 1000000000 },   // 1000万/秒 → 10亿
  { cpsRequired: 1e8,      cost: 10000000000 },  // 1亿/秒 → 100亿
  { cpsRequired: 1e9,      cost: 100000000000 }, // 10亿/秒 → 1000亿
  { cpsRequired: 1e10,     cost: 1e12 },         // 100亿/秒 → 1万亿
  { cpsRequired: 1e11,     cost: 1e13 },         // 1000亿/秒 → 10万亿
  { cpsRequired: 1e12,     cost: 1e14 },         // 1万亿/秒 → 100万亿
]

const availableAutoClickUpgrade = computed(() => {
  const currentLevel = rebirthAutoClick.value
  if (currentLevel >= autoClickTiers.length) return null
  const tier = autoClickTiers[currentLevel]
  if (effectiveAutoRate.value < tier.cpsRequired) return null
  return { level: currentLevel + 1, cost: tier.cost, cpsRequired: tier.cpsRequired }
})

function buyAutoClickUpgrade() {
  const upgrade = availableAutoClickUpgrade.value
  if (!upgrade || cubeCount.value < upgrade.cost) return
  cubeCount.value -= upgrade.cost
  rebirthAutoClick.value++
}

const visibleClickUpgrades = computed(() => clickUpgrades.value.filter(u => !u.unlockAt || totalCubesEver.value >= u.unlockAt))

function getUpgradeBuyCount(u: ClickUpgrade): number {
  if (buyMode.value === 'max') {
    const affordable = getMaxAffordableCount(cubeCount.value, count => getUpgradeCost(u, count))
    return u.maxLevel ? Math.min(affordable, Math.max(0, u.maxLevel - u.level)) : affordable
  }
  return buyMode.value as number
}

function getUpgradeCost(u: ClickUpgrade, count: number): number {
  return getGeometricBulkCost(u.baseCost, 1.18, u.level, count)
}

/**
 * 批量价格采用等比数列直接计算，避免 Max 模式按购买数量逐项循环。
 * 小批量仍逐项取整，以保持原有 1/10/100 次购买的价格完全一致。
 */
function getGeometricBulkCost(baseCost: number, growth: number, owned: number, count: number): number {
  const normalizedCount = Math.max(0, Math.floor(count))
  if (normalizedCount === 0) return 0
  if (normalizedCount <= 100) {
    let total = 0
    for (let index = 0; index < normalizedCount; index++) {
      total += Math.floor(baseCost * Math.pow(growth, owned + index))
    }
    return Number.isFinite(total) ? total : Number.POSITIVE_INFINITY
  }

  const firstCost = baseCost * Math.pow(growth, owned)
  const growthTotal = Math.pow(growth, normalizedCount) - 1
  const total = firstCost * growthTotal / (growth - 1)
  return Number.isFinite(total) ? Math.floor(total) : Number.POSITIVE_INFINITY
}

function getMaxAffordableCount(funds: number, getCost: (count: number) => number): number {
  if (!Number.isFinite(funds) || funds < 0 || getCost(1) > funds) return 0

  let low = 1
  let high = 2
  while (high < 8192 && getCost(high) <= funds) {
    low = high
    high *= 2
  }

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (getCost(middle) <= funds) low = middle
    else high = middle
  }
  return getCost(high) <= funds ? high : low
}

function buyClickUpgrade(u: ClickUpgrade) {
  const count = getUpgradeBuyCount(u)
  if (count <= 0) return
  const actualCount = u.maxLevel ? Math.min(count, u.maxLevel - u.level) : count
  if (actualCount <= 0) return
  const total = getUpgradeCost(u, actualCount)
  if (cubeCount.value >= total) {
    cubeCount.value -= total; u.level += actualCount; u.effect(actualCount)
    u.cost = Math.floor(u.baseCost * Math.pow(1.18, u.level))
  }
}

// ============ 转生升级系统（总计1000遗产点数）============
interface RebirthUpgrade {
  id: string; name: string; icon: Component; desc: string
  maxLevel: number; costPerLevel: number[]; level: number
  effect: () => void; category: 'golden' | 'boost' | 'special'
}

const rebirthGoldenDurationBonus = ref(0)
const rebirthGoldenMultiplierBonus = ref(0)
const rebirthGoldenChanceBonus = ref(0)
const rebirthClickMultiplier = ref(1)
const rebirthAutoMultiplier = ref(1)
const rebirthBuildingDiscount = ref(0)
const rebirthOfflineEfficiency = ref(0)
const rebirthHeritageGainBonus = ref(0)
const rebirthSynergyBoost = ref(1)       // 协同升级加成倍率
const rebirthStartBonus = ref(0)         // 转生后初始cube
const rebirthGoldenAutoBonus = ref(0)    // 黄金时段自动点击加成
const rebirthClickCombo = ref(0)         // 连击加成
const rebirthLuckBonus = ref(0)          // 黄金时段倍率幸运加成

const rebirthUpgrades = ref<RebirthUpgrade[]>([
  // 黄金系列
  { id: 'rGDur', name: '延长时间', icon: Timer, desc: '黄金时段持续时间 +5秒', maxLevel: 10, costPerLevel: [3,6,9,12,15,18,21,24,27,30], level: 0, category: 'golden',
    effect: () => { rebirthGoldenDurationBonus.value += 5 } },
  { id: 'rGMul', name: '提升倍率', icon: TrendingUp, desc: '黄金时段倍率 +2x', maxLevel: 10, costPerLevel: [5,8,11,14,17,20,23,26,29,32], level: 0, category: 'golden',
    effect: () => { rebirthGoldenMultiplierBonus.value += 2 } },
  { id: 'rGChance', name: '增加概率', icon: Percent, desc: '黄金时段出现概率 +50%', maxLevel: 8, costPerLevel: [2,4,6,8,10,12,14,16], level: 0, category: 'golden',
    effect: () => { rebirthGoldenChanceBonus.value += 0.0025 } },
  { id: 'rGFreeze', name: '时间冻结', icon: Orbit, desc: '黄金时段额外 +3秒', maxLevel: 5, costPerLevel: [8,12,16,20,24], level: 0, category: 'golden',
    effect: () => { rebirthGoldenDurationBonus.value += 3 } },
  { id: 'rGLuck', name: '幸运加成', icon: Sparkles, desc: '黄金时段额外随机 +0~5x 倍率', maxLevel: 10, costPerLevel: [4,7,10,13,16,19,22,25,28,31], level: 0, category: 'golden',
    effect: () => { rebirthLuckBonus.value += 5 } },
  { id: 'rGAuto', name: '黄金收割', icon: Flame, desc: '黄金时段自动点击额外 +50%', maxLevel: 5, costPerLevel: [6,10,14,18,22], level: 0, category: 'golden',
    effect: () => { rebirthGoldenAutoBonus.value += 0.5 } },
  // 产出系列
  { id: 'rClick', name: '点击之力', icon: MousePointerClick, desc: '点击收益 x2', maxLevel: 10, costPerLevel: [4,7,10,13,16,19,22,25,28,31], level: 0, category: 'boost',
    effect: () => { rebirthClickMultiplier.value *= 2 } },
  { id: 'rAuto', name: '挂机之心', icon: Zap, desc: '挂机收益 x1.5', maxLevel: 10, costPerLevel: [4,7,10,13,16,19,22,25,28,31], level: 0, category: 'boost',
    effect: () => { rebirthAutoMultiplier.value *= 1.5 } },
  { id: 'rDiscount', name: '折扣大师', icon: ShoppingCart, desc: '建筑价格 -5%', maxLevel: 8, costPerLevel: [3,5,7,9,11,13,15,17], level: 0, category: 'boost',
    effect: () => { rebirthBuildingDiscount.value += 0.05 } },
  { id: 'rSynergy', name: '协同增幅', icon: CircuitBoard, desc: '机器人协同加成 +25%', maxLevel: 10, costPerLevel: [5,8,11,14,17,20,23,26,29,32], level: 0, category: 'boost',
    effect: () => { rebirthSynergyBoost.value *= 1.25 } },
  { id: 'rCombo', name: '连击大师', icon: Swords, desc: '连续点击时收益递增 (最多+50%)', maxLevel: 5, costPerLevel: [6,10,14,18,22], level: 0, category: 'boost',
    effect: () => { rebirthClickCombo.value += 0.1 } },
  // 特殊系列
  { id: 'rOffline', name: '离线专家', icon: Timer, desc: '离线收益效率 +10%', maxLevel: 10, costPerLevel: [2,4,6,8,10,12,14,16,18,20], level: 0, category: 'special',
    effect: () => { rebirthOfflineEfficiency.value += 0.1 } },
  { id: 'rHeritage', name: '遗产增幅', icon: Landmark, desc: '遗产获取 +20%', maxLevel: 5, costPerLevel: [6,9,12,15,18], level: 0, category: 'special',
    effect: () => { rebirthHeritageGainBonus.value += 0.2 } },
  { id: 'rStart', name: '初始资本', icon: Gift, desc: '转生后获得1000初始cube', maxLevel: 10, costPerLevel: [3,5,7,9,11,13,15,17,19,21], level: 0, category: 'special',
    effect: () => { rebirthStartBonus.value += 1000 } },
  { id: 'rVision', name: '预知能力', icon: Star, desc: '显示下一个建筑的预览信息', maxLevel: 1, costPerLevel: [15], level: 0, category: 'special',
    effect: () => { /* UI效果在模板中处理 */ } },
])

const rebirthUpgradesByCategory = computed(() => {
  const groups: Record<string, RebirthUpgrade[]> = { golden: [], boost: [], special: [] }
  for (const u of rebirthUpgrades.value) groups[u.category].push(u)
  return groups
})

const rebirthCategoryNames: Record<string, string> = {
  golden: '黄金强化',
  boost: '产出增幅',
  special: '特殊能力',
}

function buyRebirthUpgrade(u: RebirthUpgrade) {
  if (u.level >= u.maxLevel) return
  const cost = u.costPerLevel[u.level]
  if (heritagePoints.value < cost) return
  heritagePoints.value -= cost
  u.level++
  u.effect()
  saveGame()
}

function getRebirthUpgradeCost(u: RebirthUpgrade): number {
  return u.level < u.maxLevel ? u.costPerLevel[u.level] : 0
}

const totalRebirthPointsSpent = computed(() => {
  let total = 0
  for (const u of rebirthUpgrades.value) for (let i = 0; i < u.level; i++) total += u.costPerLevel[i]
  return total
})

const goldenDuration = computed(() => 10 + rebirthGoldenDurationBonus.value)
const goldenMultiplier = computed(() => 10 + rebirthGoldenMultiplierBonus.value)

// ============ 离线弹窗 ============
const offlineModal = ref({ show: false, time: '', gain: '', rate: 50 })
const resetConfirm = ref(false)

// ============ 黄金时段 ============
const goldenActive = ref(false)
const goldenRemaining = ref(0)
const goldenEndTime = ref(0)
let goldenTimer: number | undefined

function spawnGolden() {
  if (goldenActive.value) return
  goldenActive.value = true
  goldenEndTime.value = Date.now() + goldenDuration.value * 1000
  goldenRemaining.value = goldenDuration.value
  // 秒级展示无需逐帧刷新，低频定时可显著降低 WebView 主线程压力。
  function tick() {
    if (!goldenActive.value) return
    const remaining = Math.max(0, Math.ceil((goldenEndTime.value - Date.now()) / 1000))
    if (goldenRemaining.value !== remaining) goldenRemaining.value = remaining
    if (remaining <= 0) {
      goldenActive.value = false
      goldenTimer = undefined
      return
    }
    goldenTimer = window.setTimeout(tick, 200)
  }
  goldenTimer = window.setTimeout(tick, 200)
}

function stopGoldenTimer() {
  if (goldenTimer !== undefined) {
    window.clearTimeout(goldenTimer)
    goldenTimer = undefined
  }
}

const goldenParticles = ref<{ id: number; text: string }[]>([])
const autoParticles = ref<{ id: number; text: string }[]>([])

// ============ 点击粒子 ============
interface Particle { id: number; x: number; isGolden: boolean; gain?: number }
const particles = ref<Particle[]>([])
let particleId = 0
const MAX_PARTICLES = 15 // 限制最大粒子数

function clickCube() {
  const power = effectiveClickPower.value
  const multiplier = goldenActive.value ? goldenMultiplier.value : 1
  const gain = power * multiplier
  cubeCount.value += gain; totalCubesEver.value += gain; totalClicks.value++
  const id = ++particleId; const x = Math.random() * 60 - 30
  // 限制粒子数量，移除最旧的
  if (particles.value.length >= MAX_PARTICLES) particles.value.shift()
  particles.value.push({ id, x, isGolden: goldenActive.value, gain })
  setTimeout(() => { particles.value = particles.value.filter(p => p.id !== id) }, 500)
  if (!goldenActive.value && Math.random() < 0.003 + rebirthGoldenChanceBonus.value) spawnGolden()
}

// ============ 转生系统 ============
const heritageReward = computed(() => {
  if (totalCubesEver.value < 500000) return 0
  // 对数增长：每多1点需要100倍产出
  const base = Math.floor(Math.log(totalCubesEver.value / 500000) / Math.log(100)) + 1
  return Math.max(0, Math.floor(base * (1 + rebirthHeritageGainBonus.value)))
})

function rebirth() {
  if (heritageReward.value <= 0) return
  if (!confirm(`转生将重置所有进度，获得 ${heritageReward.value} 遗产点数。\n当前遗产: ${heritagePoints.value}（x${heritageMultiplier.value.toFixed(1)}）\n\n确定转生？`)) return
  heritagePoints.value += heritageReward.value
  heritageMultiplier.value = 1 + heritagePoints.value * 0.1
  rebirthCount.value++
  cubeCount.value = rebirthStartBonus.value; clickPower.value = 1; totalCubesEver.value = 0; totalClicks.value = 0
  robotDoubles.value = 0
  buildings.value.forEach(b => { b.count = 0 })
  clickUpgrades.value.forEach(u => { u.level = 0; u.cost = u.baseCost })
  rebirthAutoClick.value = 0
  synergyUpgrades.value.forEach(s => { s.bought = false })
  saveGame()
}

// ============ 农场可视化 ============
const farmCubes = computed(() => {
  const count = cubeCount.value
  if (count < 10) return Math.min(count, 8)
  if (count < 100) return Math.min(8 + Math.floor(count / 15), 20)
  if (count < 1000) return Math.min(20 + Math.floor(count / 80), 35)
  return Math.min(35 + Math.floor(count / 300), 50)
})

const farmEmojis = computed(() => cubeEmojis)

// 皮肤
const selectedSkinId = ref('cube_21')
const skinPickerOpen = ref(false)
const clickEmoji = computed(() => cubeEmojis.find(e => e.id === selectedSkinId.value) ?? cubeEmojis[0] ?? { src: '', code: '?' })
const goldenClickEmoji = computed(() => clickEmoji.value)
function selectSkin(id: string) { selectedSkinId.value = id; skinPickerOpen.value = false; saveGame() }

// 预生成随机位置表，避免每次渲染都变
const farmPositions = Array.from({ length: 100 }, () => ({
  x: Math.random() * 92 + 2,
  y: Math.random() * 88 + 4,
  size: 20 + Math.random() * 20,
  rotate: Math.random() * 360,
  delay: Math.random() * 3,
  emojiIndex: Math.floor(Math.random() * cubeEmojis.length),
}))

function getCubeStyle(index: number) {
  const p = farmPositions[index % farmPositions.length]
  return {
    left: `${p.x}%`,
    top: `${p.y}%`,
    width: `${p.size}px`,
    height: `${p.size}px`,
    transform: `rotate(${p.rotate}deg)`,
    animationDelay: `${p.delay}s`,
  }
}

function openLeaderboardPage() {
  activeTab.value = 'leaderboard'
  void loadLeaderboard()
}

async function connectLeaderboard() {
  if (LOCAL_LEADERBOARD_PREVIEW) {
    sdkConnected.value = true
    currentUser.value = {
      heybox_id: 'local_player',
      nickname: '本地玩家',
      avatar: '',
    }
    loadLocalLeaderboard()
    return
  }

  try {
    await hbSDK.ready()
    sdkConnected.value = true
    const userResult = await hbSDK.user.getInfo()
    currentUser.value = userResult.isLogin ? userResult.userInfo : null
    if (currentUser.value) await syncPlayerLevel()
    await loadLeaderboard()
  } catch {
    sdkConnected.value = false
    leaderboardHasError.value = true
    leaderboardMessage.value = '当前不在小黑盒运行环境中，排行榜暂不可用。'
  }
}

async function loginToLeaderboard() {
  if (authLoading.value) return
  authLoading.value = true
  leaderboardMessage.value = ''
  leaderboardHasError.value = false

  try {
    await hbSDK.ready()
    const result = await hbSDK.auth.login()
    currentUser.value = result.isLogin ? result.userInfo : null
    if (!currentUser.value) {
      leaderboardMessage.value = '登录未完成，请稍后重试。'
      return
    }
    sdkConnected.value = true
    await syncPlayerLevel()
    await loadLeaderboard()
  } catch {
    leaderboardHasError.value = true
    leaderboardMessage.value = '登录失败，请稍后重试。'
  } finally {
    authLoading.value = false
  }
}

async function syncPlayerLevel() {
  if (!sdkConnected.value || !currentUser.value || LOCAL_LEADERBOARD_PREVIEW) return

  try {
    const currentEntry = await hbSDK.cloud.leaderboard.getCurrentUserEntry({
      key: LEVEL_LEADERBOARD_KEY,
    })
    const cloudLevel = currentEntry ? leaderboardEntryLevel(currentEntry) : 0
    if (cloudLevel > playerLevel.value) {
      playerLevel.value = cloudLevel
      saveGame()
    }
    if (!currentEntry || cloudLevel < playerLevel.value) {
      await submitPlayerLevel()
    }
  } catch {
    // 榜单尚未创建或临时不可用时不影响本地游戏和等级。
  }
}

async function levelUp() {
  if (!canLevelUp.value) return
  levelUpLoading.value = true
  try {
    const cost = nextLevelCost.value
    cubeCount.value -= cost
    playerLevel.value += 1
    saveGame()

    if (LOCAL_LEADERBOARD_PREVIEW) {
      loadLocalLeaderboard()
      leaderboardMessage.value = `升级成功，当前等级 Lv.${playerLevel.value}`
      leaderboardHasError.value = false
      return
    }

    if (!currentUser.value) {
      leaderboardMessage.value = `升级成功，登录后可将 Lv.${playerLevel.value} 同步到排行榜。`
      leaderboardHasError.value = false
      return
    }

    leaderboardMessage.value = '升级成功，正在同步排行榜…'
    leaderboardHasError.value = false
    await submitPlayerLevel()
    await loadLeaderboard()
    leaderboardMessage.value = `升级成功，当前等级 Lv.${playerLevel.value}`
  } catch {
    leaderboardHasError.value = true
    leaderboardMessage.value = `已升级至 Lv.${playerLevel.value}，排行榜同步失败，请点击刷新重试。`
  } finally {
    levelUpLoading.value = false
  }
}

async function submitPlayerLevel() {
  if (!currentUser.value) return
  await hbSDK.cloud.leaderboard.submit({
    key: LEVEL_LEADERBOARD_KEY,
    score: playerLevel.value,
    extra: {
      level: playerLevel.value,
      nickname: currentUser.value.nickname,
      avatar: currentUser.value.avatar,
    },
  })
}

async function loadLeaderboard() {
  if (leaderboardLoading.value) return
  if (LOCAL_LEADERBOARD_PREVIEW) {
    loadLocalLeaderboard()
    return
  }
  if (!sdkConnected.value) return

  leaderboardLoading.value = true
  leaderboardMessage.value = ''
  leaderboardHasError.value = false
  try {
    if (currentUser.value) await syncPlayerLevel()
    const result = await hbSDK.cloud.leaderboard.getList({
      key: LEVEL_LEADERBOARD_KEY,
      limit: LEVEL_LEADERBOARD_LIMIT,
    })
    leaderboardEntries.value = result.entries
  } catch {
    leaderboardEntries.value = []
    leaderboardHasError.value = true
    leaderboardMessage.value = `排行榜加载失败，请确认已创建 key 为 ${LEVEL_LEADERBOARD_KEY} 的降序排行榜。`
  } finally {
    leaderboardLoading.value = false
  }
}

function loadLocalLeaderboard() {
  const previewPlayers = [
    { nickname: '银河采矿人', level: 18 },
    { nickname: '快乐点点点', level: 15 },
    { nickname: '量子小方块', level: 12 },
    { nickname: '黄金时段常驻', level: 9 },
    { nickname: '机器人管理员', level: 7 },
    { nickname: '摸鱼也有收益', level: 5 },
    { nickname: '刚来一小会', level: 3 },
  ]
  const localPlayer = {
    nickname: currentUser.value?.nickname || '本地玩家',
    level: playerLevel.value,
    userId: currentUser.value?.heybox_id || 'local_player',
  }
  const sorted = [
    ...previewPlayers.map((player, index) => ({
      ...player,
      userId: `preview_player_${index + 1}`,
    })),
    localPlayer,
  ].sort((first, second) => second.level - first.level)

  leaderboardEntries.value = sorted.map((player, index) => ({
    rank: index + 1,
    ranked: true,
    userId: player.userId,
    score: player.level,
    extra: {
      level: player.level,
      nickname: player.nickname,
      avatar: '',
    },
    createdAt: Math.floor(Date.now() / 1000) - index,
    updatedAt: Math.floor(Date.now() / 1000) - index,
  }))
  leaderboardHasError.value = false
}

function leaderboardEntryLevel(entry: LeaderboardEntry) {
  const level = Number(entry.extra.level ?? entry.score)
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1
}

function leaderboardEntryName(entry: LeaderboardEntry) {
  const nickname = entry.extra.nickname
  return typeof nickname === 'string' && nickname.trim() ? nickname.trim() : '神秘盒友'
}

function leaderboardEntryAvatar(entry: LeaderboardEntry) {
  const avatar = entry.extra.avatar
  return typeof avatar === 'string' ? avatar : ''
}

function isCurrentLeaderboardUser(entry: LeaderboardEntry) {
  return Boolean(currentUser.value && entry.userId === currentUser.value.heybox_id)
}

function hideBrokenAvatar(event: Event) {
  if (event.currentTarget instanceof HTMLImageElement) event.currentTarget.style.display = 'none'
}

// ============ 存档 ============
let tickTimer: number
let lastAutosaveAt = 0

function saveWhenHidden() {
  if (document.visibilityState === 'hidden') saveGame()
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('cube-farm-save')
    if (saved) {
      const data = JSON.parse(saved)
      cubeCount.value = data.cubeCount ?? 0; clickPower.value = data.clickPower ?? 1
      totalCubesEver.value = data.totalCubesEver ?? 0; totalClicks.value = data.totalClicks ?? 0
      rebirthCount.value = data.rebirthCount ?? 0; heritagePoints.value = data.heritagePoints ?? 0
      heritageMultiplier.value = data.heritageMultiplier ?? 1; selectedSkinId.value = data.selectedSkinId ?? 'cube_21'
      playerLevel.value = Math.max(1, Math.floor(Number(data.playerLevel) || 1))
      robotDoubles.value = data.robotDoubles ?? 0
      if (data.buildings) data.buildings.forEach((s: { id: string; count: number }) => { const b = buildings.value.find(b => b.id === s.id); if (b) b.count = s.count })
      if (data.clickUpgrades) data.clickUpgrades.forEach((s: { id: string; level: number; cost: number }) => {
        const u = clickUpgrades.value.find(u => u.id === s.id)
        if (u) { u.level = s.level; u.cost = s.cost; if (s.level > 0) u.effect(s.level) }
      })
      if (data.synergyUpgrades) data.synergyUpgrades.forEach((s: { id: string; bought: boolean }) => { const sy = synergyUpgrades.value.find(y => y.id === s.id); if (sy) sy.bought = s.bought })
      if (data.rebirthUpgrades) data.rebirthUpgrades.forEach((s: { id: string; level: number }) => {
        const u = rebirthUpgrades.value.find(y => y.id === s.id)
        if (u) { u.level = s.level; for (let i = 0; i < s.level; i++) u.effect() }
      })
      if (data.lastSaveTime && totalCps.value > 0) {
        const elapsed = Math.floor((Date.now() - data.lastSaveTime) / 1000)
        const offlineRate = 0.5 + rebirthOfflineEfficiency.value
        const offlineGain = Math.min(elapsed, 28800) * effectiveAutoRate.value * offlineRate
        if (offlineGain > 0) {
          cubeCount.value += offlineGain; totalCubesEver.value += offlineGain
          setTimeout(() => {
            offlineModal.value = {
              show: true,
              time: formatTime(elapsed),
              gain: formatNumber(offlineGain),
              rate: Math.round(offlineRate * 100),
            }
          }, 300)
        }
      }
    }
  } catch { /* ignore */ }

  lastAutosaveAt = Date.now()
  tickTimer = window.setInterval(() => {
    // 自动点击（模拟真实点击，金色粒子）
    if (rebirthAutoClick.value > 0) {
      const multiplier = goldenActive.value ? goldenMultiplier.value * (1 + rebirthGoldenAutoBonus.value) : 1
      const gain = effectiveClickPower.value * rebirthAutoClick.value * multiplier
      cubeCount.value += gain; totalCubesEver.value += gain
      if (particles.value.length < MAX_PARTICLES) {
        const id = ++particleId; const x = Math.random() * 60 - 30
        particles.value.push({ id, x, isGolden: true, gain })
        setTimeout(() => { particles.value = particles.value.filter(p => p.id !== id) }, 500)
      }
    }

    // 自动产出（绿色飘字）
    if (effectiveAutoRate.value > 0) {
      const multiplier = goldenActive.value ? goldenMultiplier.value : 1
      const gain = effectiveAutoRate.value * multiplier
      cubeCount.value += gain; totalCubesEver.value += gain
      if (autoParticles.value.length < 3) {
        const id = ++particleId
        autoParticles.value.push({ id, text: `+${formatNumber(gain)}` })
        setTimeout(() => { autoParticles.value = autoParticles.value.filter(p => p.id !== id) }, 800)
      }
    }

    if (!goldenActive.value && Math.random() < 0.005 + rebirthGoldenChanceBonus.value) spawnGolden()
    const now = Date.now()
    if (now - lastAutosaveAt >= 5000) {
      saveGame()
      lastAutosaveAt = now
    }
  }, 1000)

  document.addEventListener('visibilitychange', saveWhenHidden)
  stopAuthListener = hbSDK.on('authChange', (result) => {
    currentUser.value = result.isLogin ? result.userInfo : null
    if (currentUser.value) {
      void syncPlayerLevel().then(() => loadLeaderboard())
    } else {
      void loadLeaderboard()
    }
  })
  void connectLeaderboard()
})

onUnmounted(() => {
  clearInterval(tickTimer)
  stopGoldenTimer()
  stopAuthListener?.()
  document.removeEventListener('visibilitychange', saveWhenHidden)
  saveGame()
})

function saveGame() {
  localStorage.setItem('cube-farm-save', JSON.stringify({
    cubeCount: cubeCount.value, clickPower: clickPower.value,
    totalCubesEver: totalCubesEver.value, totalClicks: totalClicks.value,
    rebirthCount: rebirthCount.value, heritagePoints: heritagePoints.value,
    heritageMultiplier: heritageMultiplier.value, robotDoubles: robotDoubles.value,
    buildings: buildings.value.map(b => ({ id: b.id, count: b.count })),
    clickUpgrades: clickUpgrades.value.map(u => ({ id: u.id, level: u.level, cost: u.cost })),
    synergyUpgrades: synergyUpgrades.value.map(s => ({ id: s.id, bought: s.bought })),
    rebirthUpgrades: rebirthUpgrades.value.map(u => ({ id: u.id, level: u.level })),
    playerLevel: playerLevel.value,
    lastSaveTime: Date.now(), selectedSkinId: selectedSkinId.value,
  }))
}

function resetGame() {
  resetConfirm.value = true
}

function confirmReset() {
  localStorage.setItem('cube-farm-save', JSON.stringify({
    playerLevel: playerLevel.value,
    lastSaveTime: Date.now(),
  }))
  resetConfirm.value = false
  location.reload()
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`
  return `${Math.floor(seconds / 86400)}天`
}

function formatNumber(n: number) {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1e24) return (n / 1e24).toFixed(2) + '秭'
  if (n >= 1e20) return (n / 1e20).toFixed(2) + '垓'
  if (n >= 1e16) return (n / 1e16).toFixed(2) + '京'
  if (n >= 1e12) return (n / 1e12).toFixed(2) + '万亿'
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + '万'
  return Math.floor(n).toLocaleString()
}
</script>

<template>
  <div class="game" :style="{ '--game-background': `url(${GAME_BACKGROUND_URL})` }">
    <header class="game-header">
      <h1>
        <Diamond :size="24" class="title-icon" />
        cube 点点乐
        <span v-if="rebirthCount > 0" class="rebirth-badge">转生 ×{{ rebirthCount }}</span>
      </h1>
      <div class="stats">
        <span class="level-stat"><Trophy :size="14" /> Lv.{{ playerLevel }}</span>
        <span><Hammer :size="14" /> {{ formatNumber(effectiveClickPower) }}/次</span>
        <span><Zap :size="14" /> {{ formatNumber(effectiveAutoRate) }}/秒</span>
        <span v-if="heritagePoints > 0" class="heritage-stat"><Landmark :size="14" /> {{ heritagePoints }}</span>
      </div>
    </header>

    <Transition name="golden-fade">
      <div v-if="goldenActive" class="golden-banner">
        <Sparkles :size="16" /> 黄金时段 {{ goldenMultiplier }}x · {{ goldenRemaining }}秒 <Sparkles :size="16" />
      </div>
    </Transition>

    <!-- 离线收益弹窗 -->
    <Transition name="golden-fade">
      <div v-if="offlineModal.show" class="modal-overlay" @click.self="offlineModal.show = false">
        <div class="offline-modal">
          <div class="offline-icon">😴</div>
          <h3>欢迎回来</h3>
          <p class="offline-time">离线 {{ offlineModal.time }}</p>
          <div class="offline-gain">
            <img :src="clickEmoji.src" alt="" class="offline-gain-icon" />
            <span>+{{ offlineModal.gain }}</span>
          </div>
          <p class="offline-rate">离线效率: {{ offlineModal.rate }}%</p>
          <button class="offline-btn" @click="offlineModal.show = false">收下</button>
        </div>
      </div>
    </Transition>

    <!-- 点击页 -->
    <div v-show="activeTab === 'click'" class="tab-content">
      <div class="farm-scene">
        <div class="farm-ground">
          <div v-for="i in farmCubes" :key="i" class="farm-cube" :style="getCubeStyle(i)">
            <img :src="cubeEmojis[farmPositions[i % farmPositions.length].emojiIndex].src" :alt="cubeEmojis[farmPositions[i % farmPositions.length].emojiIndex].code" class="farm-emoji-img" />
          </div>
          <div v-if="farmCubes === 0" class="farm-empty">空空如也…</div>
        </div>
      </div>
      <div class="cube-area">
        <div class="cube-count" :class="{ golden: goldenActive }">{{ formatNumber(cubeCount) }}</div>
        <div class="cube-label">cube</div>
        <button class="cube-button" :class="{ 'golden-glow': goldenActive }" @click="clickCube">
          <img v-if="goldenActive" :src="goldenClickEmoji.src" :alt="goldenClickEmoji.code" class="cube-emoji" />
          <img v-else :src="clickEmoji.src" :alt="clickEmoji.code" class="cube-emoji" />
          <div v-for="p in particles" :key="p.id" class="particle" :class="{ golden: p.isGolden }" :style="{ '--x': p.x + 'px' }">
            +{{ formatNumber(p.gain ?? effectiveClickPower * (goldenActive ? goldenMultiplier : 1)) }}
          </div>
        </button>
        <div v-for="a in autoParticles" :key="a.id" class="auto-particle">{{ a.text }}</div>
        <button class="skin-toggle" @click="skinPickerOpen = !skinPickerOpen"><Palette :size="14" /> 换装</button>
      </div>
      <Transition name="golden-fade">
        <div v-if="skinPickerOpen" class="skin-picker">
          <div class="skin-picker-header"><span>选择你的 cube</span><button class="skin-close" @click="skinPickerOpen = false">✕</button></div>
          <div class="skin-grid">
            <button v-for="emoji in cubeEmojis" :key="emoji.id" class="skin-item" :class="{ active: selectedSkinId === emoji.id }" @click="selectSkin(emoji.id)">
              <img :src="emoji.src" :alt="emoji.code" />
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 商店页 -->
    <div v-show="activeTab === 'shop'" class="tab-content">
      <div class="shop">
        <div class="shop-header">
          <h2><ShoppingCart :size="18" /> 商店</h2>
          <div class="buy-modes">
            <button v-for="m in buyModes" :key="m" class="mode-btn" :class="{ active: buyMode === m }" @click="setBuyMode(m)">×{{ m }}</button>
            <button class="mode-btn" :class="{ active: buyMode === 'max' }" @click="setBuyMode('max')">Max</button>
          </div>
        </div>
        <div class="upgrade-list">
          <button v-for="b in visibleBuildings" :key="b.id" class="upgrade-card" :class="{ affordable: cubeCount >= getBuildingCost(b) }" :disabled="cubeCount < getBuildingCost(b)" @click="buyBuilding(b)">
            <div class="upgrade-info">
              <strong><component :is="b.icon" :size="16" class="upgrade-icon" /> {{ b.name }} <span class="building-count">×{{ b.count }}</span></strong>
              <small>每个 {{ b.baseCps }}/秒</small>
              <small v-if="b.id === 'robot' && robotDoubles > 0" class="synergy-hint">协同加成: x{{ Math.pow(2, robotDoubles) }}</small>
            </div>
            <div class="upgrade-cost">
              <span><img :src="clickEmoji.src" alt="" class="cost-icon" /> {{ formatNumber(getBuildingCost(b, getBuildingBuyCount(b))) }}<template v-if="buyMode !== 1"> ×{{ getBuildingBuyCount(b) }}</template></span>
              <small v-if="getBuildingDisplayCps(b) > 0" class="cps-hint">产出 {{ formatNumber(getBuildingDisplayCps(b)) }}/秒</small>
              <small v-else class="cps-hint-empty">产出 0/秒</small>
            </div>
          </button>
        </div>
        <div v-if="visibleSynergyUpgrades.length > 0" class="synergy-section">
          <h3><CircuitBoard :size="16" /> 机器人协同研究</h3>
          <div class="upgrade-list">
            <button v-for="s in visibleSynergyUpgrades" :key="s.id" class="upgrade-card synergy-card" :class="{ affordable: cubeCount >= s.cost }" :disabled="cubeCount < s.cost" @click="buySynergyUpgrade(s)">
              <div class="upgrade-info">
                <strong><component :is="s.icon" :size="16" class="upgrade-icon synergy-icon" /> {{ s.name }}</strong>
                <small>{{ s.desc }}</small>
              </div>
              <div class="upgrade-cost"><span><img :src="clickEmoji.src" alt="" class="cost-icon" /> {{ formatNumber(s.cost) }}</span></div>
            </button>
          </div>
        </div>
        <div v-if="visibleClickUpgrades.length > 0" class="click-upgrades-section">
          <h3><Hammer :size="16" /> 点击强化</h3>
          <div class="upgrade-list">
            <button v-for="u in visibleClickUpgrades" :key="u.id" class="upgrade-card" :class="{ affordable: cubeCount >= u.cost }" :disabled="cubeCount < u.cost" @click="buyClickUpgrade(u)">
              <div class="upgrade-info">
                <strong><component :is="u.icon" :size="16" class="upgrade-icon" /> {{ u.name }}</strong>
                <small>{{ u.desc }}</small>
              </div>
              <div class="upgrade-cost">
                <span><img :src="clickEmoji.src" alt="" class="cost-icon" /> {{ formatNumber(getUpgradeCost(u, getUpgradeBuyCount(u))) }}<template v-if="buyMode !== 1"> ×{{ getUpgradeBuyCount(u) }}</template></span>
                <small v-if="u.maxLevel && u.level >= u.maxLevel" class="maxed-text">MAX</small>
                <small v-else>Lv.{{ u.level }}</small>
              </div>
            </button>
          </div>
        </div>

        <!-- 自动点击升级（动态解锁） -->
        <div v-if="availableAutoClickUpgrade" class="auto-click-section">
          <h3><CircuitBoard :size="16" /> 自动点击</h3>
          <div class="upgrade-list">
            <button
              class="upgrade-card auto-click-card"
              :class="{ affordable: cubeCount >= availableAutoClickUpgrade.cost }"
              :disabled="cubeCount < availableAutoClickUpgrade.cost"
              @click="buyAutoClickUpgrade()"
            >
              <div class="upgrade-info">
                <strong><CircuitBoard :size="16" class="upgrade-icon auto-click-icon" /> 自动点击 Lv.{{ availableAutoClickUpgrade.level }}</strong>
                <small>每秒自动点击 +1 次</small>
                <small class="auto-click-req">需要每秒产出 {{ formatNumber(availableAutoClickUpgrade.cpsRequired) }}</small>
              </div>
              <div class="upgrade-cost">
                <span><img :src="clickEmoji.src" alt="" class="cost-icon" /> {{ formatNumber(availableAutoClickUpgrade.cost) }}</span>
                <small>当前: {{ rebirthAutoClick }}次/秒</small>
              </div>
            </button>
          </div>
        </div>
        <div v-else-if="rebirthAutoClick > 0" class="auto-click-section">
          <h3><CircuitBoard :size="16" /> 自动点击</h3>
          <div class="auto-click-status">
            <span>当前: <strong>{{ rebirthAutoClick }}</strong> 次/秒</span>
            <span v-if="rebirthAutoClick < autoClickTiers.length">下一等级需要每秒产出 {{ formatNumber(autoClickTiers[rebirthAutoClick].cpsRequired) }}</span>
            <span v-else class="maxed-text">已满级</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 转生升级页 -->
    <div v-show="activeTab === 'rebirth'" class="tab-content">
      <div class="rebirth-page">
        <div class="rebirth-header">
          <h2><RotateCcw :size="18" /> 转生系统</h2>
          <div class="rebirth-summary">
            <span>遗产: <strong>{{ heritagePoints }}</strong> 点 (x{{ heritageMultiplier.toFixed(1) }})</span>
            <span>已消耗: {{ totalRebirthPointsSpent }} / 1000</span>
          </div>
          <div class="rebirth-earn">
            <span>转生可获得: <strong>+{{ heritageReward }}</strong> 点</span>
            <button class="rebirth-btn" :disabled="heritageReward <= 0" @click="rebirth"><RotateCw :size="14" /> 转生</button>
          </div>
        </div>
        <div v-for="(upgrades, category) in rebirthUpgradesByCategory" :key="category" class="rebirth-category">
          <h3>{{ rebirthCategoryNames[category] }}</h3>
          <div class="upgrade-list">
            <button
              v-for="u in upgrades" :key="u.id"
              class="upgrade-card rebirth-card"
              :class="{ affordable: heritagePoints >= getRebirthUpgradeCost(u), maxed: u.level >= u.maxLevel }"
              :disabled="u.level >= u.maxLevel || heritagePoints < getRebirthUpgradeCost(u)"
              @click="buyRebirthUpgrade(u)"
            >
              <div class="upgrade-info">
                <strong><component :is="u.icon" :size="16" class="upgrade-icon rebirth-icon" /> {{ u.name }}</strong>
                <small>{{ u.desc }}</small>
              </div>
              <div class="upgrade-cost">
                <span v-if="u.level < u.maxLevel" class="heritage-cost">🏛️ {{ getRebirthUpgradeCost(u) }}</span>
                <span v-else class="maxed-text">MAX</span>
                <small>{{ u.level }}/{{ u.maxLevel }}</small>
              </div>
            </button>
          </div>
        </div>
        <div v-if="heritagePoints === 0 && totalRebirthPointsSpent === 0" class="rebirth-empty">
          <p>转生后获得遗产点数，解锁永久升级。</p>
          <p class="rebirth-hint">累计产出 500,000 cube 后可转生。</p>
        </div>

        <!-- 重置按钮 -->
        <div class="reset-section">
          <button class="reset-btn" @click="resetGame"><Trash2 :size="14" /> 重置所有进度</button>
        </div>
      </div>
    </div>

    <!-- 等级排行榜页 -->
    <div v-show="activeTab === 'leaderboard'" class="tab-content leaderboard-tab">
      <div class="level-page">
        <header class="level-page-header">
          <div>
            <span class="level-kicker">CUBE LEAGUE</span>
            <h2><Trophy :size="21" /> 等级排行榜</h2>
            <p>消耗 cube 提升等级，等级越高排名越靠前</p>
          </div>
          <button class="leaderboard-refresh" :disabled="leaderboardLoading" @click="loadLeaderboard()" aria-label="刷新排行榜">
            <RefreshCw :size="17" :class="{ spinning: leaderboardLoading }" />
          </button>
        </header>

        <section class="player-level-card">
          <div class="player-profile">
            <div class="player-avatar">
              <span>{{ currentUser?.nickname?.trim().charAt(0) || 'C' }}</span>
              <img v-if="currentUser?.avatar" :src="currentUser.avatar" alt="" referrerpolicy="no-referrer" @error="hideBrokenAvatar" />
            </div>
            <div class="player-level-copy">
              <span>{{ currentUser?.nickname || '游客玩家' }}</span>
              <strong>Lv.{{ playerLevel }}</strong>
            </div>
          </div>
          <div class="level-up-area">
            <span>升至 Lv.{{ playerLevel + 1 }}</span>
            <strong><img :src="clickEmoji.src" alt="" /> {{ formatNumber(nextLevelCost) }}</strong>
            <button :disabled="!canLevelUp" @click="levelUp">
              <ArrowUpCircle :size="16" />
              {{ levelUpLoading ? '同步中…' : '升级' }}
            </button>
          </div>
        </section>

        <button v-if="!currentUser && !LOCAL_LEADERBOARD_PREVIEW" class="leaderboard-login" :disabled="authLoading" @click="loginToLeaderboard">
          <UserRound :size="16" /> {{ authLoading ? '登录中…' : '登录小黑盒参与排行' }}
        </button>

        <p v-if="leaderboardMessage" class="level-board-message" :class="{ error: leaderboardHasError }">{{ leaderboardMessage }}</p>

        <section class="ranking-board">
          <div class="ranking-board-title">
            <span>排名</span><span>玩家</span><span>等级</span>
          </div>
          <div v-if="leaderboardEntries.length" class="level-ranking-list">
            <article
              v-for="(entry, index) in leaderboardEntries"
              :key="entry.userId"
              class="level-ranking-row"
              :class="{ mine: isCurrentLeaderboardUser(entry), podium: index < 3 }"
            >
              <div class="ranking-position" :class="`rank-${index + 1}`">
                <Crown v-if="index === 0" :size="18" />
                <span v-else>{{ entry.rank || index + 1 }}</span>
              </div>
              <div class="ranking-player">
                <div class="ranking-avatar">
                  <span>{{ leaderboardEntryName(entry).charAt(0) }}</span>
                  <img v-if="leaderboardEntryAvatar(entry)" :src="leaderboardEntryAvatar(entry)" alt="" referrerpolicy="no-referrer" @error="hideBrokenAvatar" />
                </div>
                <strong>{{ leaderboardEntryName(entry) }}</strong>
                <small v-if="isCurrentLeaderboardUser(entry)">我</small>
              </div>
              <strong class="ranking-level">Lv.{{ leaderboardEntryLevel(entry) }}</strong>
            </article>
          </div>
          <div v-else class="level-ranking-empty">
            <Trophy :size="34" />
            <p>{{ leaderboardLoading ? '排行榜加载中…' : '还没有玩家上榜' }}</p>
          </div>
        </section>
      </div>
    </div>

    <!-- 底部导航 -->
    <nav class="bottom-nav">
      <button class="nav-btn" :class="{ active: activeTab === 'click' }" @click="activeTab = 'click'">
        <MousePointerClick :size="20" /><span>点击</span>
      </button>
      <button class="nav-btn" :class="{ active: activeTab === 'shop' }" @click="activeTab = 'shop'">
        <ShoppingCart :size="20" /><span>商店</span>
      </button>
      <button class="nav-btn" :class="{ active: activeTab === 'rebirth' }" @click="activeTab = 'rebirth'">
        <RotateCcw :size="20" /><span>转生</span>
      </button>
      <button class="nav-btn" :class="{ active: activeTab === 'leaderboard' }" @click="openLeaderboardPage">
        <Trophy :size="20" /><span>排行</span>
      </button>
    </nav>

    <!-- 重置确认弹窗 -->
    <Transition name="golden-fade">
      <div v-if="resetConfirm" class="modal-overlay" @click.self="resetConfirm = false">
        <div class="reset-modal">
          <div class="reset-modal-icon">⚠️</div>
          <h3>确认重置</h3>
          <p>此操作将清除所有进度，包括：</p>
          <ul class="reset-warn-list">
            <li>所有 cube 数量</li>
            <li>所有建筑和升级</li>
            <li>遗产点数和转生次数</li>
            <li>转生升级进度</li>
          </ul>
          <p class="reset-warn">此操作不可恢复！</p>
          <div class="reset-modal-btns">
            <button class="reset-cancel-btn" @click="resetConfirm = false">取消</button>
            <button class="reset-confirm-btn" @click="confirmReset">确认重置</button>
          </div>
        </div>
      </div>
    </Transition>

    <footer class="game-footer"></footer>
  </div>
</template>
