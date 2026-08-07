<script setup lang="ts">
import hbSDK, { HbMiniProgramSDKError, type LeaderboardEntry, type MiniProgramUserInfo } from '@heybox/hb-sdk'
import { ref, computed, onMounted, onUnmounted, type Component } from 'vue'
import { cubeEmojis } from './data/emojis'
import {
  Hammer, Bot, Factory, Rocket, Diamond, Orbit, Globe, Sparkles,
  RotateCcw, Trash2, ShoppingCart, Zap, Landmark, RotateCw, Palette,
  Swords, Crown, Star, Flame, Sun, Atom, Heart, Shield, CircuitBoard,
  MousePointerClick, TrendingUp, Timer, Percent, Gift, ArrowUpCircle,
  Trophy, RefreshCw, UserRound, Lock,
} from '@lucide/vue'

// ============ Tab 系统 ============
type TabId = 'click' | 'shop' | 'rebirth' | 'leaderboard'
const activeTab = ref<TabId>('click')

// ============ 等级排行榜 ============
const LEVEL_LEADERBOARD_KEY = 'cube_clicker_level'
const LEVEL_LEADERBOARD_LIMIT = 100
const VISITOR_LEADERBOARD_KEY = 'cube_clicker_visitors'
const VISITOR_LEADERBOARD_PAGE_SIZE = 100
const VISITOR_STATS_UNLOCK_TAPS = 10
const BASE_LEVEL_UP_COST = 10000
const LEVEL_UP_COST_GROWTH = 1.5
const LOCAL_LEADERBOARD_PREVIEW = import.meta.env.DEV
const GAME_BACKGROUND_URL = new URL(
  `${import.meta.env.BASE_URL}assets/ui/game-background-v2.png`,
  document.baseURI,
).href
const GAME_ICON_URL = new URL(
  `${import.meta.env.BASE_URL}assets/branding/game-icon.png`,
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
const visitorStatsUnlocked = ref(false)
const visitorStatsLoading = ref(false)
const visitorStatsToday = ref(0)
const visitorStatsTotal = ref(0)
const visitorStatsMessage = ref('')
const safeAreaTop = ref(0)
let stopAuthListener: (() => void) | undefined
let visitorAvatarTapCount = 0
let visitorTrackedDate = 0

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
  { id: 'robot',    name: '小机器人',     icon: Bot,       baseCps: 1,     baseCost: 50,   count: 0, unlockAt: 0 },
  { id: 'factory',  name: '迷你工厂',     icon: Factory,   baseCps: 1e2,   baseCost: 5e3,  count: 0, unlockAt: 5e3 },
  { id: 'super',    name: '超级工厂',     icon: Rocket,    baseCps: 1e4,   baseCost: 5e5,  count: 0, unlockAt: 5e5 },
  { id: 'quantum',  name: '量子农场',     icon: Orbit,     baseCps: 1e6,   baseCost: 5e7,  count: 0, unlockAt: 5e7 },
  { id: 'star',     name: '星际矿场',     icon: Globe,     baseCps: 1e8,   baseCost: 5e9,  count: 0, unlockAt: 5e9 },
  { id: 'reaper',   name: '维度收割者',   icon: Atom,      baseCps: 1e10,  baseCost: 5e11, count: 0, unlockAt: 5e11 },
  { id: 'sun',      name: '太阳熔炉',     icon: Sun,       baseCps: 1e12,  baseCost: 5e13, count: 0, unlockAt: 5e13 },
  { id: 'rift',     name: '时空裂缝',     icon: Flame,     baseCps: 1e14,  baseCost: 5e15, count: 0, unlockAt: 5e15 },
  { id: 'galaxy',   name: '银河引擎',     icon: Star,      baseCps: 1e16,  baseCost: 5e17, count: 0, unlockAt: 5e17 },
  { id: 'void',     name: '虚空提取器',   icon: Crown,     baseCps: 1e18,  baseCost: 5e19, count: 0, unlockAt: 5e19 },
  { id: 'genesis',  name: '创世引擎',     icon: Diamond,   baseCps: 1e20,  baseCost: 5e21, count: 0, unlockAt: 5e21 },
  { id: 'omega',    name: '终极奇点',     icon: Sparkles,  baseCps: 1e22,  baseCost: 5e23, count: 0, unlockAt: 5e23 },
  { id: 'multiverse', name: '多元宇宙核心', icon: Orbit,        baseCps: 1e24, baseCost: 5e25, count: 0, unlockAt: 5e25 },
  { id: 'causality',  name: '因果编织机',   icon: CircuitBoard, baseCps: 1e26, baseCost: 5e27, count: 0, unlockAt: 5e27 },
  { id: 'hypercraft', name: '超维母舰',     icon: Rocket,       baseCps: 1e28, baseCost: 5e29, count: 0, unlockAt: 5e29 },
  { id: 'lawforge',   name: '法则熔炉',     icon: Sun,          baseCps: 1e30, baseCost: 5e31, count: 0, unlockAt: 5e31 },
  { id: 'rebooter',   name: '宇宙重启器',   icon: RotateCw,     baseCps: 1e32, baseCost: 5e33, count: 0, unlockAt: 5e33 },
  { id: 'terminus',   name: '终焉观测站',   icon: Globe,        baseCps: 1e34, baseCost: 5e35, count: 0, unlockAt: 5e35 },
  { id: 'abyss',      name: '深渊熔炉',     icon: Flame,        baseCps: 1e36, baseCost: 5e37, count: 0, unlockAt: 5e37 },
  { id: 'origin',     name: '原初核心',     icon: Diamond,      baseCps: 1e38, baseCost: 5e39, count: 0, unlockAt: 5e39 },
  { id: 'absolute',   name: '绝对领域',     icon: Orbit,        baseCps: 1e40, baseCost: 5e41, count: 0, unlockAt: 5e41 },
  { id: 'eternity',   name: '永恒引擎',     icon: Sparkles,     baseCps: 1e42, baseCost: 5e43, count: 0, unlockAt: 5e43 },
  { id: 'beyond',     name: '超越之门',     icon: Rocket,       baseCps: 1e44, baseCost: 5e45, count: 0, unlockAt: 5e45 },
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
  { id: 'syn1',  name: '齿轮之心',  icon: Heart,    desc: '机器人产出翻倍。每拥有1个机器人，迷你工厂 +1% 产出',  cost: 2e3,  bought: false, targetBuildingId: 'factory', requiredRobots: 1,  unlockAt: 1e3 },
  { id: 'syn2',  name: '钢铁之魂',  icon: Shield,   desc: '机器人产出翻倍。每拥有2个机器人，超级工厂 +1% 产出',  cost: 2e5,  bought: false, targetBuildingId: 'super',   requiredRobots: 2,  unlockAt: 1e5 },
  { id: 'syn3',  name: '量子共振',  icon: Atom,     desc: '机器人产出翻倍。每拥有3个机器人，量子农场 +1% 产出',  cost: 2e7,  bought: false, targetBuildingId: 'quantum', requiredRobots: 3,  unlockAt: 1e7 },
  { id: 'syn4',  name: '星际链接',  icon: Globe,    desc: '机器人产出翻倍。每拥有4个机器人，星际矿场 +1% 产出',  cost: 2e9,  bought: false, targetBuildingId: 'star',    requiredRobots: 4,  unlockAt: 1e9 },
  { id: 'syn5',  name: '维度通道',  icon: Orbit,    desc: '机器人产出翻倍。每拥有5个机器人，维度收割者 +1% 产出', cost: 2e11, bought: false, targetBuildingId: 'reaper',  requiredRobots: 5,  unlockAt: 1e11 },
  { id: 'syn6',  name: '日冕协议',  icon: Sun,      desc: '机器人产出翻倍。每拥有6个机器人，太阳熔炉 +1% 产出',   cost: 2e13, bought: false, targetBuildingId: 'sun',     requiredRobots: 6,  unlockAt: 1e13 },
  { id: 'syn7',  name: '时空编织',  icon: Sparkles, desc: '机器人产出翻倍。每拥有7个机器人，时空裂缝 +1% 产出',   cost: 2e15, bought: false, targetBuildingId: 'rift',    requiredRobots: 7,  unlockAt: 1e15 },
  { id: 'syn8',  name: '银河之链',  icon: Star,     desc: '机器人产出翻倍。每拥有8个机器人，银河引擎 +1% 产出',   cost: 2e17, bought: false, targetBuildingId: 'galaxy',  requiredRobots: 8,  unlockAt: 1e17 },
  { id: 'syn9',  name: '虚空共鸣',  icon: Crown,    desc: '机器人产出翻倍。每拥有9个机器人，虚空提取器 +1% 产出', cost: 2e19, bought: false, targetBuildingId: 'void',    requiredRobots: 9,  unlockAt: 1e19 },
  { id: 'syn10', name: '创世回响',  icon: Diamond,  desc: '机器人产出翻倍。每拥有10个机器人，创世引擎 +1% 产出', cost: 2e21, bought: false, targetBuildingId: 'genesis', requiredRobots: 10, unlockAt: 1e21 },
  { id: 'syn11', name: '奇点共振',  icon: Flame,    desc: '机器人产出翻倍。每拥有11个机器人，终极奇点 +1% 产出', cost: 2e23, bought: false, targetBuildingId: 'omega',   requiredRobots: 11, unlockAt: 1e23 },
  { id: 'syn12', name: '多元谐振',  icon: Orbit,    desc: '机器人产出翻倍。每拥有12个机器人，多元宇宙核心 +1% 产出', cost: 2e25, bought: false, targetBuildingId: 'multiverse', requiredRobots: 12, unlockAt: 1e25 },
  { id: 'syn13', name: '因果回路',  icon: CircuitBoard, desc: '机器人产出翻倍。每拥有13个机器人，因果编织机 +1% 产出', cost: 2e27, bought: false, targetBuildingId: 'causality', requiredRobots: 13, unlockAt: 1e27 },
  { id: 'syn14', name: '超维网络',  icon: Rocket,   desc: '机器人产出翻倍。每拥有14个机器人，超维母舰 +1% 产出', cost: 2e29, bought: false, targetBuildingId: 'hypercraft', requiredRobots: 14, unlockAt: 1e29 },
  { id: 'syn15', name: '法则链接',  icon: Sun,      desc: '机器人产出翻倍。每拥有15个机器人，法则熔炉 +1% 产出', cost: 2e31, bought: false, targetBuildingId: 'lawforge', requiredRobots: 15, unlockAt: 1e31 },
  { id: 'syn16', name: '重启协议',  icon: RotateCw, desc: '机器人产出翻倍。每拥有16个机器人，宇宙重启器 +1% 产出', cost: 2e33, bought: false, targetBuildingId: 'rebooter', requiredRobots: 16, unlockAt: 1e33 },
  { id: 'syn17', name: '终焉观测',  icon: Globe,    desc: '机器人产出翻倍。每拥有17个机器人，终焉观测站 +1% 产出', cost: 2e35, bought: false, targetBuildingId: 'terminus', requiredRobots: 17, unlockAt: 1e35 },
  { id: 'syn18', name: '深渊回响',  icon: Flame,    desc: '机器人产出翻倍。每拥有18个机器人，深渊熔炉 +1% 产出', cost: 2e37, bought: false, targetBuildingId: 'abyss', requiredRobots: 18, unlockAt: 1e37 },
  { id: 'syn19', name: '原初脉冲',  icon: Diamond,  desc: '机器人产出翻倍。每拥有19个机器人，原初核心 +1% 产出', cost: 2e39, bought: false, targetBuildingId: 'origin', requiredRobots: 19, unlockAt: 1e39 },
  { id: 'syn20', name: '绝对秩序',  icon: Orbit,    desc: '机器人产出翻倍。每拥有20个机器人，绝对领域 +1% 产出', cost: 2e41, bought: false, targetBuildingId: 'absolute', requiredRobots: 20, unlockAt: 1e41 },
  { id: 'syn21', name: '永恒之心',  icon: Sparkles, desc: '机器人产出翻倍。每拥有21个机器人，永恒引擎 +1% 产出', cost: 2e43, bought: false, targetBuildingId: 'eternity', requiredRobots: 21, unlockAt: 1e43 },
  { id: 'syn22', name: '超越回路',  icon: Rocket,   desc: '机器人产出翻倍。每拥有22个机器人，超越之门 +1% 产出', cost: 2e45, bought: false, targetBuildingId: 'beyond', requiredRobots: 22, unlockAt: 1e45 },
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
  if (cubeCount.value >= total) {
    cubeCount.value -= total
    building.count += count
    triggerPurchaseFeedback(`building:${building.id}`)
  }
}

function buySynergyUpgrade(syn: SynergyUpgrade) {
  if (syn.bought || cubeCount.value < syn.cost) return
  cubeCount.value -= syn.cost
  syn.bought = true
  robotDoubles.value++
  triggerPurchaseFeedback(`synergy:${syn.id}`)
}

const visibleBuildings = computed(() => buildings.value.filter(b => totalCubesEver.value >= b.unlockAt))
const nextLockedBuilding = computed(() => buildings.value.find(b => totalCubesEver.value < b.unlockAt) ?? null)
const nextBuildingUnlockProgress = computed(() => {
  const target = nextLockedBuilding.value?.unlockAt ?? 0
  if (target <= 0) return 100
  return Math.min(100, Math.max(0, totalCubesEver.value / target * 100))
})
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
const purchaseFeedbackKey = ref('')
const balanceBumped = ref(false)
let purchaseCardTimer: number | undefined
let balanceBumpTimer: number | undefined

function triggerPurchaseFeedback(key: string) {
  if (purchaseCardTimer !== undefined) window.clearTimeout(purchaseCardTimer)
  if (balanceBumpTimer !== undefined) window.clearTimeout(balanceBumpTimer)

  purchaseFeedbackKey.value = ''
  balanceBumped.value = false
  window.requestAnimationFrame(() => {
    purchaseFeedbackKey.value = key
    balanceBumped.value = true
    purchaseCardTimer = window.setTimeout(() => { purchaseFeedbackKey.value = '' }, 520)
    balanceBumpTimer = window.setTimeout(() => { balanceBumped.value = false }, 420)
  })

  void hbSDK.device.vibrate({ intensity: 'light', delay: 0 }).catch(() => {
    // 浏览器调试或旧版宿主不支持震动时，保留其余购买反馈。
  })
}

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
  { id: 'click5', name: '钻石锤子', icon: Diamond, desc: '每次点击 +100', baseCost: 1.5e3, cost: 1.5e3, level: 0, unlockAt: 5e2, effect: (n) => { clickPower.value += 1e2 * n } },
  { id: 'click20', name: '雷神之锤', icon: Swords, desc: '每次点击 +1万', baseCost: 1.5e5, cost: 1.5e5, level: 0, unlockAt: 5e4, effect: (n) => { clickPower.value += 1e4 * n } },
  { id: 'click100', name: '王者权杖', icon: Crown, desc: '每次点击 +100万', baseCost: 1.5e7, cost: 1.5e7, level: 0, unlockAt: 5e6, effect: (n) => { clickPower.value += 1e6 * n } },
  { id: 'click500', name: '星辰之触', icon: Star, desc: '每次点击 +1亿', baseCost: 1.5e9, cost: 1.5e9, level: 0, unlockAt: 5e8, effect: (n) => { clickPower.value += 1e8 * n } },
  { id: 'click2000', name: '次元之手', icon: Atom, desc: '每次点击 +100亿', baseCost: 1.5e11, cost: 1.5e11, level: 0, unlockAt: 5e10, effect: (n) => { clickPower.value += 1e10 * n } },
  { id: 'click10000', name: '宇宙权柄', icon: Globe, desc: '每次点击 +1万亿', baseCost: 1.5e13, cost: 1.5e13, level: 0, unlockAt: 5e12, effect: (n) => { clickPower.value += 1e12 * n } },
  { id: 'click50000', name: '创世之锤', icon: Sun, desc: '每次点击 +100万亿', baseCost: 1.5e15, cost: 1.5e15, level: 0, unlockAt: 5e14, effect: (n) => { clickPower.value += 1e14 * n } },
  { id: 'click200000', name: '奇点之力', icon: Flame, desc: '每次点击 +1京', baseCost: 1.5e17, cost: 1.5e17, level: 0, unlockAt: 5e16, effect: (n) => { clickPower.value += 1e16 * n } },
  { id: 'clickVoid', name: '虚空之握', icon: Crown, desc: '每次点击 +100京', baseCost: 1.5e19, cost: 1.5e19, level: 0, unlockAt: 5e18, effect: (n) => { clickPower.value += 1e18 * n } },
  { id: 'clickGenesis', name: '创世之手', icon: Diamond, desc: '每次点击 +1垓', baseCost: 1.5e21, cost: 1.5e21, level: 0, unlockAt: 5e20, effect: (n) => { clickPower.value += 1e20 * n } },
  { id: 'clickOmega', name: '终极权能', icon: Sparkles, desc: '每次点击 +100垓', baseCost: 1.5e23, cost: 1.5e23, level: 0, unlockAt: 5e22, effect: (n) => { clickPower.value += 1e22 * n } },
  { id: 'clickMultiverse', name: '多元之触', icon: Orbit, desc: '每次点击 +1秭', baseCost: 1.5e25, cost: 1.5e25, level: 0, unlockAt: 5e24, effect: (n) => { clickPower.value += 1e24 * n } },
  { id: 'clickCausality', name: '因果裁决', icon: CircuitBoard, desc: '每次点击 +100秭', baseCost: 1.5e27, cost: 1.5e27, level: 0, unlockAt: 5e26, effect: (n) => { clickPower.value += 1e26 * n } },
  { id: 'clickHypercraft', name: '超维敕令', icon: Rocket, desc: '每次点击 +1穰', baseCost: 1.5e29, cost: 1.5e29, level: 0, unlockAt: 5e28, effect: (n) => { clickPower.value += 1e28 * n } },
  { id: 'clickLawforge', name: '法则改写', icon: Sun, desc: '每次点击 +100穰', baseCost: 1.5e31, cost: 1.5e31, level: 0, unlockAt: 5e30, effect: (n) => { clickPower.value += 1e30 * n } },
  { id: 'clickRebooter', name: '宇宙重构', icon: RotateCw, desc: '每次点击 +1沟', baseCost: 1.5e33, cost: 1.5e33, level: 0, unlockAt: 5e32, effect: (n) => { clickPower.value += 1e32 * n } },
  { id: 'clickTerminus', name: '终焉一指', icon: Globe, desc: '每次点击 +100沟', baseCost: 1.5e35, cost: 1.5e35, level: 0, unlockAt: 5e34, effect: (n) => { clickPower.value += 1e34 * n } },
  { id: 'clickAbyss', name: '深渊之触', icon: Flame, desc: '每次点击 +1涧', baseCost: 1.5e37, cost: 1.5e37, level: 0, unlockAt: 5e36, effect: (n) => { clickPower.value += 1e36 * n } },
  { id: 'clickOrigin', name: '原初之手', icon: Diamond, desc: '每次点击 +100涧', baseCost: 1.5e39, cost: 1.5e39, level: 0, unlockAt: 5e38, effect: (n) => { clickPower.value += 1e38 * n } },
  { id: 'clickAbsolute', name: '绝对裁决', icon: Orbit, desc: '每次点击 +1正', baseCost: 1.5e41, cost: 1.5e41, level: 0, unlockAt: 5e40, effect: (n) => { clickPower.value += 1e40 * n } },
  { id: 'clickEternity', name: '永恒之指', icon: Sparkles, desc: '每次点击 +100正', baseCost: 1.5e43, cost: 1.5e43, level: 0, unlockAt: 5e42, effect: (n) => { clickPower.value += 1e42 * n } },
  { id: 'clickBeyond', name: '超越一击', icon: Rocket, desc: '每次点击 +1载', baseCost: 1.5e45, cost: 1.5e45, level: 0, unlockAt: 5e44, effect: (n) => { clickPower.value += 1e44 * n } },
])

// 自动点击升级：根据每秒产量动态解锁和定价
const autoClickTiers = [
  { cpsRequired: 1e3,  cost: 1e5 },
  { cpsRequired: 1e5,  cost: 1e7 },
  { cpsRequired: 1e7,  cost: 1e9 },
  { cpsRequired: 1e9,  cost: 1e11 },
  { cpsRequired: 1e11, cost: 1e13 },
  { cpsRequired: 1e13, cost: 1e15 },
  { cpsRequired: 1e15, cost: 1e17 },
  { cpsRequired: 1e17, cost: 1e19 },
  { cpsRequired: 1e19, cost: 1e21 },
  { cpsRequired: 1e21, cost: 1e23 },
  { cpsRequired: 1e23, cost: 1e25 },
  { cpsRequired: 1e25, cost: 1e27 },
  { cpsRequired: 1e27, cost: 1e29 },
  { cpsRequired: 1e29, cost: 1e31 },
  { cpsRequired: 1e31, cost: 1e33 },
  { cpsRequired: 1e33, cost: 1e35 },
  { cpsRequired: 1e35, cost: 1e37 },
  { cpsRequired: 1e37, cost: 1e39 },
  { cpsRequired: 1e39, cost: 1e41 },
  { cpsRequired: 1e41, cost: 1e43 },
  { cpsRequired: 1e43, cost: 1e45 },
  { cpsRequired: 1e45, cost: 1e47 },
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
  saveGame()
  triggerPurchaseFeedback('auto-click')
}

const visibleClickUpgrades = computed(() => clickUpgrades.value.filter(u => !u.unlockAt || totalCubesEver.value >= u.unlockAt))

function getUpgradeBuyCount(u: ClickUpgrade): number {
  if (buyMode.value === 'max') {
    const affordable = getMaxAffordableCount(cubeCount.value, count => getUpgradeCost(u, count))
    return u.maxLevel ? Math.min(affordable, Math.max(0, u.maxLevel - u.level)) : affordable
  }
  const requested = buyMode.value as number
  return u.maxLevel ? Math.min(requested, Math.max(0, u.maxLevel - u.level)) : requested
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

function getBuildingPurchaseCost(building: Building): number {
  return getBuildingCost(building, Math.max(1, getBuildingBuyCount(building)))
}

function canBuyBuilding(building: Building): boolean {
  const count = getBuildingBuyCount(building)
  return count > 0 && cubeCount.value >= getBuildingCost(building, count)
}

function isUpgradeMaxed(upgrade: ClickUpgrade): boolean {
  return upgrade.maxLevel !== undefined && upgrade.level >= upgrade.maxLevel
}

function getUpgradePurchaseCost(upgrade: ClickUpgrade): number {
  return getUpgradeCost(upgrade, Math.max(1, getUpgradeBuyCount(upgrade)))
}

function canBuyUpgrade(upgrade: ClickUpgrade): boolean {
  const count = getUpgradeBuyCount(upgrade)
  return count > 0 && cubeCount.value >= getUpgradeCost(upgrade, count)
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
    triggerPurchaseFeedback(`click:${u.id}`)
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
const rebirthConfirm = ref(false)
const resetConfirm = ref(false)

// ============ 黄金时段 ============
const goldenActive = ref(false)
const goldenRemaining = ref(0)
const goldenEndTime = ref(0)
const fallingGoldenCubeVisible = ref(false)
const fallingGoldenCubeX = ref(50)
let goldenTimer: number | undefined
let fallingGoldenCubeTimer: number | undefined
const GOLDEN_CUBE_FALL_DURATION = 4800

function spawnGolden() {
  if (goldenActive.value || fallingGoldenCubeVisible.value) return
  fallingGoldenCubeX.value = 12 + Math.random() * 76
  fallingGoldenCubeVisible.value = true
  if (fallingGoldenCubeTimer !== undefined) window.clearTimeout(fallingGoldenCubeTimer)
  fallingGoldenCubeTimer = window.setTimeout(dismissFallingGoldenCube, GOLDEN_CUBE_FALL_DURATION)
}

function dismissFallingGoldenCube() {
  fallingGoldenCubeVisible.value = false
  if (fallingGoldenCubeTimer !== undefined) {
    window.clearTimeout(fallingGoldenCubeTimer)
    fallingGoldenCubeTimer = undefined
  }
}

function collectFallingGoldenCube() {
  if (!fallingGoldenCubeVisible.value || goldenActive.value) return
  dismissFallingGoldenCube()
  startGoldenPeriod()
}

function startGoldenPeriod() {
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
  dismissFallingGoldenCube()
}

const goldenParticles = ref<{ id: number; text: string }[]>([])
const autoParticles = ref<{ id: number; text: string }[]>([])

// ============ 点击粒子 ============
interface Particle { id: number; x: number; isGolden: boolean; gain?: number }
const particles = ref<Particle[]>([])
let particleId = 0
const MAX_PARTICLES = 15 // 限制最大粒子数
const cubePressed = ref(false)
let cubePressedTimer: number | undefined

function clickCube() {
  cubePressed.value = true
  if (cubePressedTimer !== undefined) window.clearTimeout(cubePressedTimer)
  cubePressedTimer = window.setTimeout(() => {
    cubePressed.value = false
    cubePressedTimer = undefined
  }, 240)
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
  rebirthConfirm.value = true
}

function confirmRebirth() {
  if (heritageReward.value <= 0) {
    rebirthConfirm.value = false
    return
  }
  heritagePoints.value += heritageReward.value
  heritageMultiplier.value = 1 + heritagePoints.value * 0.1
  rebirthCount.value++
  cubeCount.value = rebirthStartBonus.value; clickPower.value = 1; totalCubesEver.value = 0; totalClicks.value = 0
  robotDoubles.value = 0
  buildings.value.forEach(b => { b.count = 0 })
  clickUpgrades.value.forEach(u => { u.level = 0; u.cost = u.baseCost })
  rebirthAutoClick.value = 0
  synergyUpgrades.value.forEach(s => { s.bought = false })
  rebirthConfirm.value = false
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
  x: Math.random() * 86 + 3,
  y: Math.random() * 82 + 4,
  size: 30 + Math.random() * 28,
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

function getVisitorDayScore(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return Number(`${values.year}${values.month}${values.day}`)
}

const visitorStatsDateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
}).format(new Date()))

async function trackDailyVisitor(throwOnError = false) {
  if (!sdkConnected.value || !currentUser.value || LOCAL_LEADERBOARD_PREVIEW) return
  const today = getVisitorDayScore()
  if (visitorTrackedDate === today) return

  try {
    const currentEntry = await hbSDK.cloud.leaderboard.getCurrentUserEntry({
      key: VISITOR_LEADERBOARD_KEY,
    })
    if (!currentEntry || currentEntry.score < today) {
      await hbSDK.cloud.leaderboard.submit({
        key: VISITOR_LEADERBOARD_KEY,
        score: today,
        extra: {
          visitedDate: today,
        },
      })
    }
    visitorTrackedDate = today
  } catch (error) {
    if (throwOnError) throw error
    // 隐藏统计榜不可用时不影响正常游戏和公开等级榜。
    console.warn('[cube-clicker] trackDailyVisitor failed', error)
  }
}

function handleVisitorSecretTap() {
  if (visitorStatsUnlocked.value) return
  visitorAvatarTapCount += 1
  if (visitorAvatarTapCount < VISITOR_STATS_UNLOCK_TAPS) return

  visitorStatsUnlocked.value = true
  void hbSDK.device.vibrate({ intensity: 'light' }).catch(() => {})
  void loadVisitorStats()
}

async function loadVisitorStats() {
  if (visitorStatsLoading.value) return
  if (LOCAL_LEADERBOARD_PREVIEW) {
    visitorStatsToday.value = 29
    visitorStatsTotal.value = 286
    visitorStatsMessage.value = ''
    return
  }
  if (!sdkConnected.value || !currentUser.value) {
    visitorStatsMessage.value = '登录小黑盒后可查看访问统计。'
    return
  }

  visitorStatsLoading.value = true
  visitorStatsMessage.value = ''
  try {
    await trackDailyVisitor(true)
    const today = getVisitorDayScore()
    let todayCount = 0
    let totalCount = 0
    let cursor: string | undefined
    const seenCursors = new Set<string>()

    do {
      const result = await hbSDK.cloud.leaderboard.getList({
        key: VISITOR_LEADERBOARD_KEY,
        limit: VISITOR_LEADERBOARD_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      })
      totalCount += result.entries.length
      todayCount += result.entries.filter(entry => Math.floor(entry.score) === today).length

      if (!result.hasMore) break
      if (!result.cursor || seenCursors.has(result.cursor)) {
        throw new Error('访问榜分页游标异常')
      }
      seenCursors.add(result.cursor)
      cursor = result.cursor
    } while (cursor)

    visitorStatsToday.value = todayCount
    visitorStatsTotal.value = totalCount
  } catch (error) {
    console.error('[cube-clicker] loadVisitorStats failed', error)
    visitorStatsMessage.value = '访问统计暂不可用，请稍后刷新。'
  } finally {
    visitorStatsLoading.value = false
  }
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
    if (currentUser.value) {
      await syncPlayerLevel()
      await trackDailyVisitor()
    }
    await loadLeaderboard()
  } catch (error) {
    console.error('[cube-clicker] connectLeaderboard failed', error)
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
    await trackDailyVisitor()
    await loadLeaderboard()
  } catch (error) {
    console.error('[cube-clicker] loginToLeaderboard failed', error)
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
  } catch (error) {
    // 榜单尚未创建或临时不可用时不影响本地游戏和等级。
    console.warn('[cube-clicker] syncPlayerLevel failed', error)
  }
}

async function levelUp() {
  if (!canLevelUp.value) return
  levelUpLoading.value = true
  leaderboardMessage.value = ''
  leaderboardHasError.value = false
  try {
    const cost = nextLevelCost.value
    cubeCount.value -= cost
    playerLevel.value += 1
    saveGame()

    if (LOCAL_LEADERBOARD_PREVIEW) {
      loadLocalLeaderboard()
      leaderboardMessage.value = ''
      return
    }

    if (!currentUser.value) {
      return
    }

    await submitPlayerLevel()
    await loadLeaderboard(true)
  } catch (error) {
    // 升级后的榜单同步在后台静默失败，不打扰升级主流程。
    console.warn('[cube-clicker] level-up leaderboard sync failed', error)
  } finally {
    levelUpLoading.value = false
  }
}

async function submitPlayerLevel() {
  if (!currentUser.value) return
  try {
    await hbSDK.cloud.leaderboard.submit({
      key: LEVEL_LEADERBOARD_KEY,
      score: playerLevel.value,
      extra: {
        level: playerLevel.value,
        nickname: currentUser.value.nickname,
        avatar: currentUser.value.avatar,
      },
    })
  } catch (error) {
    console.error('[cube-clicker] submitPlayerLevel failed', error)
    throw error
  }
}

function getLeaderboardErrorMessage(error: unknown) {
  if (!(error instanceof HbMiniProgramSDKError)) {
    return '排行榜加载失败，请稍后重试。'
  }

  const errorMessages: Record<string, string> = {
    PERMISSION_DENIED: '排行榜读取权限未开放，请联系管理员检查运行时权限。',
    LEADERBOARD_DEFAULT_NOT_FOUND: `排行榜 ${LEVEL_LEADERBOARD_KEY} 尚未创建。`,
    LEADERBOARD_TABLE_NOT_READY: '排行榜正在初始化，请稍后重试。',
    LEADERBOARD_LIMIT_EXCEEDED: '小程序排行榜数量已达上限。',
    LEADERBOARD_SUBMIT_LOCKED: '排行榜提交冲突，请稍后重试。',
    NotFound: `远端未找到排行榜 ${LEVEL_LEADERBOARD_KEY}。`,
    INVALID_PARAMS: '排行榜查询参数无效。',
    InvalidArgument: '排行榜查询参数无效。',
    ResourceExhausted: '排行榜服务容量超限，请稍后重试。',
    UNAUTHORIZED: '登录状态已失效，请重新登录后重试。',
    Unauthenticated: '登录状态已失效，请重新登录后重试。',
    RUNTIME_UNAVAILABLE: '小程序运行时已卸载，请重新打开。',
    REQUEST_TIMEOUT: '排行榜请求超时，请检查网络后重试。',
  }

  // 宿主传输层错误单独提示，便于用户反馈。
  if (error.code.startsWith('runtime.transport')) {
    return `排行榜服务暂不可用，请稍后重试。若持续出现请联系技术支持。（${error.code}）`
  }

  return `${errorMessages[error.code] ?? '排行榜服务暂不可用，请稍后重试。'}（${error.code}）`
}

async function loadLeaderboard(silent = false) {
  if (leaderboardLoading.value) return
  if (LOCAL_LEADERBOARD_PREVIEW) {
    loadLocalLeaderboard()
    if (silent) {
      leaderboardMessage.value = ''
      leaderboardHasError.value = false
    }
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
  } catch (error) {
    console.error('[cube-clicker] leaderboard.getList failed', error)
    leaderboardEntries.value = []
    if (!silent) {
      leaderboardHasError.value = true
      leaderboardMessage.value = getLeaderboardErrorMessage(error)
    }
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

let gameRuntimeStarted = false
let gameRuntimeReady = false

// ============ 存档 ============
const GAME_SAVE_KEY = 'cube-farm-save'
interface GameSave {
  cubeCount?: number
  clickPower?: number
  totalCubesEver?: number
  totalClicks?: number
  rebirthCount?: number
  heritagePoints?: number
  heritageMultiplier?: number
  robotDoubles?: number
  rebirthAutoClick?: number
  playerLevel?: number
  lastSaveTime?: number
  selectedSkinId?: string
  buildings?: Array<{ id: string; count: number }>
  clickUpgrades?: Array<{ id: string; level: number; cost: number }>
  synergyUpgrades?: Array<{ id: string; bought: boolean }>
  rebirthUpgrades?: Array<{ id: string; level: number }>
}

let tickTimer: number | undefined
let lastAutosaveAt = 0
let storageWriteQueue: Promise<void> = Promise.resolve()

function readLocalGameSave(): GameSave | undefined {
  try {
    const saved = localStorage.getItem(GAME_SAVE_KEY)
    if (!saved) return undefined
    const data = JSON.parse(saved) as GameSave
    return data && typeof data === 'object' ? data : undefined
  } catch {
    return undefined
  }
}

async function readGameSave(): Promise<GameSave | undefined> {
  const localSave = readLocalGameSave()
  let remoteSave: GameSave | undefined

  try {
    await hbSDK.ready()
    remoteSave = (await hbSDK.storage.getStorage<GameSave>({ key: GAME_SAVE_KEY })).data
  } catch {
    // 本地调试或旧版宿主没有隔离 Storage 时，继续使用 localStorage 兜底。
  }

  if (!localSave) return remoteSave
  if (!remoteSave) return localSave
  const localTime = Number(localSave.lastSaveTime) || 0
  const remoteTime = Number(remoteSave.lastSaveTime) || 0
  return remoteTime >= localTime ? remoteSave : localSave
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    if (gameRuntimeReady) saveGame()
  } else if (gameRuntimeReady) {
    void trackDailyVisitor()
  }
}

async function syncSafeArea() {
  try {
    await hbSDK.ready()
    const windowInfo = await hbSDK.viewport.getWindowInfo()
    safeAreaTop.value = Math.max(0, windowInfo.safeArea.top, windowInfo.statusBarHeight)
  } catch {
    // 浏览器预览或旧版宿主不支持窗口信息时，交给 CSS 安全区和最小间距兜底。
    safeAreaTop.value = 0
  }
}

async function startGameRuntime() {
  if (gameRuntimeStarted) return
  gameRuntimeStarted = true
  try {
    const data = await readGameSave()
    if (data) {
      cubeCount.value = data.cubeCount ?? 0; clickPower.value = data.clickPower ?? 1
      totalCubesEver.value = data.totalCubesEver ?? 0; totalClicks.value = data.totalClicks ?? 0
      rebirthCount.value = data.rebirthCount ?? 0; heritagePoints.value = data.heritagePoints ?? 0
      heritageMultiplier.value = data.heritageMultiplier ?? 1; selectedSkinId.value = data.selectedSkinId ?? 'cube_21'
      playerLevel.value = Math.max(1, Math.floor(Number(data.playerLevel) || 1))
      robotDoubles.value = data.robotDoubles ?? 0
      rebirthAutoClick.value = Math.max(0, Math.floor(Number(data.rebirthAutoClick) || 0))
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
      const offlineCps = effectiveAutoRate.value + effectiveClickPower.value * rebirthAutoClick.value
      if (data.lastSaveTime && offlineCps > 0) {
        const elapsed = Math.max(0, Math.floor((Date.now() - data.lastSaveTime) / 1000))
        const offlineRate = 0.5 + rebirthOfflineEfficiency.value
        const offlineGain = Math.min(elapsed, 28800) * offlineCps * offlineRate
        if (offlineGain > 0) {
          cubeCount.value += offlineGain; totalCubesEver.value += offlineGain
          saveGame()
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

  gameRuntimeReady = true
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

  document.addEventListener('visibilitychange', handleVisibilityChange)
  stopAuthListener = hbSDK.on('authChange', (result) => {
    currentUser.value = result.isLogin ? result.userInfo : null
    if (currentUser.value) {
      void syncPlayerLevel()
        .then(() => trackDailyVisitor())
        .then(() => loadLeaderboard())
    } else {
      void loadLeaderboard()
    }
  })
  void connectLeaderboard()
}

onMounted(() => {
  void syncSafeArea()
  void startGameRuntime()
})

onUnmounted(() => {
  if (tickTimer !== undefined) window.clearInterval(tickTimer)
  stopGoldenTimer()
  if (purchaseCardTimer !== undefined) window.clearTimeout(purchaseCardTimer)
  if (balanceBumpTimer !== undefined) window.clearTimeout(balanceBumpTimer)
  if (cubePressedTimer !== undefined) window.clearTimeout(cubePressedTimer)
  stopAuthListener?.()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (gameRuntimeReady) saveGame()
  gameRuntimeStarted = false
  gameRuntimeReady = false
})

function saveGame() {
  const snapshot: GameSave = {
    cubeCount: cubeCount.value, clickPower: clickPower.value,
    totalCubesEver: totalCubesEver.value, totalClicks: totalClicks.value,
    rebirthCount: rebirthCount.value, heritagePoints: heritagePoints.value,
    heritageMultiplier: heritageMultiplier.value, robotDoubles: robotDoubles.value,
    rebirthAutoClick: rebirthAutoClick.value,
    buildings: buildings.value.map(b => ({ id: b.id, count: b.count })),
    clickUpgrades: clickUpgrades.value.map(u => ({ id: u.id, level: u.level, cost: u.cost })),
    synergyUpgrades: synergyUpgrades.value.map(s => ({ id: s.id, bought: s.bought })),
    rebirthUpgrades: rebirthUpgrades.value.map(u => ({ id: u.id, level: u.level })),
    playerLevel: playerLevel.value,
    lastSaveTime: Date.now(), selectedSkinId: selectedSkinId.value,
  }

  try {
    localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(snapshot))
  } catch {
    // 宿主回收页面或隐私模式下 localStorage 不可用时，不能阻断游戏运行。
  }

  storageWriteQueue = storageWriteQueue
    .catch(() => undefined)
    .then(() => hbSDK.storage.setStorage({ key: GAME_SAVE_KEY, data: snapshot }))
    .catch(() => undefined)
}

function resetGame() {
  resetConfirm.value = true
}

function resetProgressState() {
  activeTab.value = 'click'
  buyMode.value = 1

  cubeCount.value = 0
  clickPower.value = 1
  totalCubesEver.value = 0
  totalClicks.value = 0
  rebirthCount.value = 0
  heritagePoints.value = 0
  heritageMultiplier.value = 1
  rebirthAutoClick.value = 0
  robotDoubles.value = 0
  playerLevel.value = 1
  selectedSkinId.value = 'cube_21'

  buildings.value.forEach((building) => { building.count = 0 })
  clickUpgrades.value.forEach((upgrade) => {
    upgrade.level = 0
    upgrade.cost = upgrade.baseCost
  })
  synergyUpgrades.value.forEach((upgrade) => { upgrade.bought = false })
  rebirthUpgrades.value.forEach((upgrade) => { upgrade.level = 0 })

  rebirthGoldenDurationBonus.value = 0
  rebirthGoldenMultiplierBonus.value = 0
  rebirthGoldenChanceBonus.value = 0
  rebirthClickMultiplier.value = 1
  rebirthAutoMultiplier.value = 1
  rebirthBuildingDiscount.value = 0
  rebirthOfflineEfficiency.value = 0
  rebirthHeritageGainBonus.value = 0
  rebirthSynergyBoost.value = 1
  rebirthStartBonus.value = 0
  rebirthGoldenAutoBonus.value = 0
  rebirthClickCombo.value = 0
  rebirthLuckBonus.value = 0

  stopGoldenTimer()
  goldenActive.value = false
  goldenRemaining.value = 0
  goldenEndTime.value = 0
  goldenParticles.value = []
  autoParticles.value = []
  particles.value = []
  particleId = 0
  offlineModal.value = { show: false, time: '', gain: '', rate: 50 }
  skinPickerOpen.value = false
  rebirthConfirm.value = false
}

function confirmReset() {
  resetProgressState()
  saveGame()
  lastAutosaveAt = Date.now()
  resetConfirm.value = false
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`
  return `${Math.floor(seconds / 86400)}天`
}

function formatNumber(n: number) {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1e68) return (n / 1e68).toFixed(2) + '无量大数'
  if (n >= 1e64) return (n / 1e64).toFixed(2) + '不可思议'
  if (n >= 1e60) return (n / 1e60).toFixed(2) + '那由他'
  if (n >= 1e56) return (n / 1e56).toFixed(2) + '阿僧祇'
  if (n >= 1e52) return (n / 1e52).toFixed(2) + '恒河沙'
  if (n >= 1e48) return (n / 1e48).toFixed(2) + '极'
  if (n >= 1e44) return (n / 1e44).toFixed(2) + '载'
  if (n >= 1e40) return (n / 1e40).toFixed(2) + '正'
  if (n >= 1e36) return (n / 1e36).toFixed(2) + '涧'
  if (n >= 1e32) return (n / 1e32).toFixed(2) + '沟'
  if (n >= 1e28) return (n / 1e28).toFixed(2) + '穰'
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
  <div
    class="game"
    :style="{
      '--game-background': `url(${GAME_BACKGROUND_URL})`,
      '--safe-area-top': `${safeAreaTop}px`,
    }"
  >
    <header class="game-header">
      <h1>
        <img :src="GAME_ICON_URL" alt="" class="title-icon" />
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

    <button
      v-if="fallingGoldenCubeVisible"
      class="falling-golden-cube"
      :style="{
        '--golden-cube-x': `${fallingGoldenCubeX}%`,
        '--golden-cube-fall-duration': `${GOLDEN_CUBE_FALL_DURATION}ms`,
      }"
      aria-label="黄金 cube，点击开启黄金时段"
      @click.stop="collectFallingGoldenCube"
      @animationend.self="dismissFallingGoldenCube"
    >
      <span class="falling-golden-cube-halo"></span>
      <img :src="clickEmoji.src" alt="" />
      <span class="falling-golden-cube-label">点我！</span>
    </button>

    <Transition name="golden-banner-fade">
      <div v-if="goldenActive" class="golden-banner-layer">
        <div class="golden-banner">
          <Sparkles :size="16" /> 黄金时段 {{ goldenMultiplier }}x · {{ goldenRemaining }}秒 <Sparkles :size="16" />
        </div>
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
    <div v-show="activeTab === 'click'" class="tab-content click-tab">
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
        <button class="cube-button" :class="{ 'golden-glow': goldenActive, 'cube-pop': cubePressed }" @click="clickCube">
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
            <button class="mode-btn max-mode" :class="{ active: buyMode === 'max' }" @click="setBuyMode('max')">Max</button>
          </div>
        </div>
        <div class="shop-balance">
          <span>当前 cube</span>
          <strong :class="{ bumped: balanceBumped }"><img :src="clickEmoji.src" alt="" /> {{ formatNumber(cubeCount) }}</strong>
        </div>
        <div class="upgrade-list">
          <button v-for="b in visibleBuildings" :key="b.id" class="upgrade-card" :class="{ affordable: canBuyBuilding(b), purchased: purchaseFeedbackKey === `building:${b.id}` }" :disabled="!canBuyBuilding(b)" @click="buyBuilding(b)">
            <div class="upgrade-info">
              <strong><component :is="b.icon" :size="16" class="upgrade-icon" /> {{ b.name }} <span class="building-count">×{{ b.count }}</span></strong>
              <small>每个 {{ formatNumber(b.baseCps) }}/秒</small>
              <small v-if="b.id === 'robot' && robotDoubles > 0" class="synergy-hint">协同加成: x{{ Math.pow(2, robotDoubles) }}</small>
            </div>
            <div class="upgrade-cost">
              <span>
                <img :src="clickEmoji.src" alt="" class="cost-icon" /> {{ formatNumber(getBuildingPurchaseCost(b)) }}
                <template v-if="buyMode === 'max'"> Max ×{{ getBuildingBuyCount(b) }}</template>
                <template v-else-if="buyMode !== 1"> ×{{ getBuildingBuyCount(b) }}</template>
              </span>
              <small v-if="getBuildingDisplayCps(b) > 0" class="cps-hint">产出 {{ formatNumber(getBuildingDisplayCps(b)) }}/秒</small>
              <small v-else class="cps-hint-empty">产出 0/秒</small>
            </div>
          </button>
          <article v-if="nextLockedBuilding" class="next-building-card">
            <div class="next-building-main">
              <div class="next-building-icon">
                <component :is="nextLockedBuilding.icon" :size="20" />
                <span><Lock :size="10" /></span>
              </div>
              <div class="next-building-copy">
                <small>下一个建筑</small>
                <strong>{{ nextLockedBuilding.name }}</strong>
                <span>每个 {{ formatNumber(nextLockedBuilding.baseCps) }}/秒</span>
              </div>
            </div>
            <div class="next-building-progress-copy">
              <span>累计 cube 解锁进度</span>
              <strong>{{ formatNumber(totalCubesEver) }} / {{ formatNumber(nextLockedBuilding.unlockAt) }}</strong>
            </div>
            <div class="next-building-progress" role="progressbar" :aria-valuenow="nextBuildingUnlockProgress" aria-valuemin="0" aria-valuemax="100">
              <span :style="{ width: `${nextBuildingUnlockProgress}%` }"></span>
            </div>
          </article>
        </div>
        <div v-if="visibleSynergyUpgrades.length > 0" class="synergy-section">
          <h3><CircuitBoard :size="16" /> 机器人协同研究</h3>
          <div class="upgrade-list">
            <button v-for="s in visibleSynergyUpgrades" :key="s.id" class="upgrade-card synergy-card" :class="{ affordable: cubeCount >= s.cost, purchased: purchaseFeedbackKey === `synergy:${s.id}` }" :disabled="cubeCount < s.cost" @click="buySynergyUpgrade(s)">
              <div class="upgrade-info">
                <strong><component :is="s.icon" :size="16" class="upgrade-icon synergy-icon" /> {{ s.name }}</strong>
                <small>{{ s.desc }}</small>
              </div>
              <div class="upgrade-cost">
                <span><img :src="clickEmoji.src" alt="" class="cost-icon" /> {{ formatNumber(s.cost) }}</span>
              </div>
            </button>
          </div>
        </div>
        <div v-if="visibleClickUpgrades.length > 0" class="click-upgrades-section">
          <h3><Hammer :size="16" /> 点击强化</h3>
          <div class="upgrade-list">
            <button v-for="u in visibleClickUpgrades" :key="u.id" class="upgrade-card" :class="{ affordable: canBuyUpgrade(u), purchased: purchaseFeedbackKey === `click:${u.id}` }" :disabled="!canBuyUpgrade(u)" @click="buyClickUpgrade(u)">
              <div class="upgrade-info">
                <strong><component :is="u.icon" :size="16" class="upgrade-icon" /> {{ u.name }}</strong>
                <small>{{ u.desc }}</small>
              </div>
              <div class="upgrade-cost">
                <span>
                  <img :src="clickEmoji.src" alt="" class="cost-icon" /> {{ formatNumber(getUpgradePurchaseCost(u)) }}
                  <template v-if="buyMode === 'max'"> Max ×{{ getUpgradeBuyCount(u) }}</template>
                  <template v-else-if="buyMode !== 1"> ×{{ getUpgradeBuyCount(u) }}</template>
                </span>
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
              :class="{ affordable: cubeCount >= availableAutoClickUpgrade.cost, purchased: purchaseFeedbackKey === 'auto-click' }"
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
            <button class="player-avatar visitor-secret-trigger" aria-label="我的头像" @click="handleVisitorSecretTap">
              <span>{{ currentUser?.nickname?.trim().charAt(0) || 'C' }}</span>
              <img v-if="currentUser?.avatar" :src="currentUser.avatar" alt="" referrerpolicy="no-referrer" @error="hideBrokenAvatar" />
            </button>
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

        <section v-if="visitorStatsUnlocked" class="visitor-stats-card" aria-live="polite">
          <div class="visitor-stats-header">
            <div>
              <span>HIDDEN ANALYTICS</span>
              <strong><UserRound :size="16" /> 访问概览</strong>
            </div>
            <button :disabled="visitorStatsLoading" aria-label="刷新访问统计" @click="loadVisitorStats">
              <RefreshCw :size="15" :class="{ spinning: visitorStatsLoading }" />
            </button>
          </div>
          <div class="visitor-stats-grid">
            <div>
              <span>{{ visitorStatsDateLabel }}访客</span>
              <strong>{{ visitorStatsLoading ? '—' : formatNumber(visitorStatsToday) }}</strong>
              <small>人</small>
            </div>
            <div>
              <span>累计访客</span>
              <strong>{{ visitorStatsLoading ? '—' : formatNumber(visitorStatsTotal) }}</strong>
              <small>人</small>
            </div>
          </div>
          <p v-if="visitorStatsMessage" class="visitor-stats-message">{{ visitorStatsMessage }}</p>
          <p v-else class="visitor-stats-note">按北京时间统计，每位登录用户每天只计 1 人</p>
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

    <!-- 转生确认弹窗 -->
    <Transition name="golden-fade">
      <div v-if="rebirthConfirm" class="modal-overlay" @click.self="rebirthConfirm = false">
        <div class="reset-modal">
          <div class="reset-modal-icon">🔄</div>
          <h3>确认转生</h3>
          <p>转生将重置本轮进度，并获得 <strong>{{ heritageReward }}</strong> 点遗产。</p>
          <p>当前遗产：{{ heritagePoints }} 点（x{{ heritageMultiplier.toFixed(1) }}）</p>
          <div class="reset-modal-btns">
            <button class="reset-cancel-btn" @click="rebirthConfirm = false">取消</button>
            <button class="reset-confirm-btn" @click="confirmRebirth">确认转生</button>
          </div>
        </div>
      </div>
    </Transition>

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
