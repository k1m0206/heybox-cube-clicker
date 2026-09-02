<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AlertTriangle, Atom, Check, ChevronLeft, ChevronRight, Clock3, Compass,
  CircleHelp, Crown, Gem, Lock, Orbit, PackageOpen, Rocket, Shield, Sparkles, Star,
  Timer, TrendingUp, X, Zap,
} from '@lucide/vue'
import {
  BLUEPRINT_REASSIGN_COST,
  DISTORTION_MAX_LAYER,
  DISTORTION_RULES,
  EXPEDITION_ALLOCATIONS,
  EXPEDITION_ASSET_BASE,
  EXPEDITION_DURATIONS,
  EXPEDITION_EVENTS,
  EXPEDITION_ROUTES,
  EXPEDITION_ZONES,
  MASTERY_CHALLENGE_IDS,
  MASTERY_CHALLENGES,
  NODE_TYPE_CONFIG,
  RELIC_IDS,
  RELICS,
  TEMP_UPGRADE_IDS,
  TEMP_UPGRADES,
} from '../../expedition/config'
import {
  createDistortionPreview,
  createExpeditionPreview,
  generateZoneNodes,
  getBlueprintSlotCount,
  getBlueprintUpgradeCost,
  getDistortionAvailableMaxLayer,
  getDistortionRuleId,
  getDistortionSourceZone,
  getMissionRemainingSeconds,
  getTempUpgradeCost,
  getTimeSandCap,
  getZoneMasteryChallenges,
  getZoneMasteryLevel,
} from '../../expedition/engine'
import type {
  ExpeditionAllocation,
  ExpeditionDurationId,
  ExpeditionEventOptionId,
  ExpeditionPreview,
  ExpeditionRelicId,
  ExpeditionRouteId,
  ExpeditionSave,
  ExpeditionTempUpgradeId,
} from '../../expedition/types'

interface BuildingOption { id: string; name: string }

const props = defineProps<{
  state: ExpeditionSave
  effectiveAutoRate: number
  uniqueBuildingCount: number
  buildings: BuildingOption[]
  clockWarning: string
  formatNumber: (value: number) => string
}>()

const emit = defineEmits<{
  launch: [preview: ExpeditionPreview]
  chooseEvent: [optionId: ExpeditionEventOptionId]
  claim: []
  cancel: []
  buyTempUpgrade: [id: ExpeditionTempUpgradeId]
  buyRelic: [id: ExpeditionRelicId]
  toggleRelic: [id: ExpeditionRelicId]
  resetRelics: []
  assignBlueprint: [payload: { slotIndex: number; buildingId: string }]
  upgradeBlueprint: [slotIndex: number]
}>()

type ExpeditionSection = 'map' | 'upgrades' | 'blueprints' | 'relics'
type ExpeditionMapMode = 'standard' | 'distortion'
const section = ref<ExpeditionSection>('map')
const mapMode = ref<ExpeditionMapMode>('standard')
const selectedZone = ref(1)
const selectedDistortionLayer = ref(1)
const selectedNodeIndex = ref(1)
const selectedRoute = ref<ExpeditionRouteId>('standard')
const selectedDuration = ref<ExpeditionDurationId>('15m')
const selectedAllocation = ref<ExpeditionAllocation>(0.25)
const launchOpen = ref(false)
const now = ref(Date.now())
let clockTimer: number | undefined

onMounted(() => {
  clockTimer = window.setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => {
  if (clockTimer !== undefined) window.clearInterval(clockTimer)
})

watch(() => props.state.highestZoneUnlocked, value => {
  if (selectedZone.value > value) selectedZone.value = value
})
watch(() => props.state.distortionUnlocked, unlocked => {
  if (!unlocked && mapMode.value === 'distortion') mapMode.value = 'standard'
})
const zone = computed(() => EXPEDITION_ZONES[selectedZone.value - 1])
const nodes = computed(() => generateZoneNodes(selectedZone.value, props.state.cycleSeed))
const selectedNode = computed(() => nodes.value[Math.max(0, selectedNodeIndex.value - 1)] ?? nodes.value[0])
const distortionAvailableMax = computed(() => getDistortionAvailableMaxLayer(props.state))
const distortionSourceZone = computed(() => getDistortionSourceZone(selectedDistortionLayer.value))
const distortionZone = computed(() => EXPEDITION_ZONES[distortionSourceZone.value - 1])
const distortionRuleId = computed(() => getDistortionRuleId(selectedDistortionLayer.value))
const distortionRule = computed(() => DISTORTION_RULES[distortionRuleId.value])
watch(distortionAvailableMax, value => {
  if (value > 0 && selectedDistortionLayer.value > value) selectedDistortionLayer.value = value
})
const preview = computed(() => mapMode.value === 'distortion'
  ? createDistortionPreview(
      props.state,
      { effectiveAutoRate: props.effectiveAutoRate, uniqueBuildingCount: props.uniqueBuildingCount },
      selectedDistortionLayer.value,
      selectedRoute.value,
      selectedDuration.value,
      selectedAllocation.value,
    )
  : createExpeditionPreview(
      props.state,
      { effectiveAutoRate: props.effectiveAutoRate, uniqueBuildingCount: props.uniqueBuildingCount },
      selectedNode.value,
      selectedRoute.value,
      selectedDuration.value,
      selectedAllocation.value,
    ))
const activeSlotCount = computed(() => getBlueprintSlotCount(props.state))
const remainingSeconds = computed(() => getMissionRemainingSeconds(props.state, now.value))
const equippedRelics = computed(() => new Set(props.state.equippedRelicIds))
const ownedRelics = computed(() => new Set(props.state.ownedRelicIds))
const usedBlueprintBuildings = computed(() => new Set(props.state.blueprintSlots.map(slot => slot.buildingId).filter(Boolean)))
const activeEvent = computed(() => props.state.pendingEvent ? EXPEDITION_EVENTS[props.state.pendingEvent.eventId] : null)
const displayedMasteryZone = computed(() => mapMode.value === 'distortion' ? distortionSourceZone.value : selectedZone.value)
const displayedMasteryChallenges = computed(() => new Set(getZoneMasteryChallenges(props.state, displayedMasteryZone.value)))
const displayedMasteryLevel = computed(() => getZoneMasteryLevel(props.state, displayedMasteryZone.value))

const ASSET_ALIASES: Record<string, string> = {
  'resources/time-sand.webp': 'c/c1.webp',
  'resources/stardust.webp': 'c/c2.webp',
  'resources/chrono-core.webp': 'c/c3.webp',
}

function asset(path: string) { return `${EXPEDITION_ASSET_BASE}/${ASSET_ALIASES[path] ?? path}` }

function timeLabel(seconds: number) {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}小时${minutes ? `${minutes}分` : ''}`
}

function nodeAvailable(index: number) {
  return index === 1 || props.state.clearedNodeIds.includes(`z${selectedZone.value}-n${index - 1}`)
}

function nodeCompleted(id: string) { return props.state.clearedNodeIds.includes(id) }

function selectZone(offset: number) {
  const next = Math.min(props.state.highestZoneUnlocked, Math.max(1, selectedZone.value + offset))
  selectedZone.value = next
  selectedNodeIndex.value = 1
}

function selectMapMode(mode: ExpeditionMapMode) {
  if (mode === 'distortion' && !props.state.distortionUnlocked) return
  mapMode.value = mode
  launchOpen.value = false
  if (mode === 'distortion') {
    selectedDistortionLayer.value = Math.max(1, Math.min(selectedDistortionLayer.value, distortionAvailableMax.value || 1))
  }
}

function selectDistortionLayer(layer: number) {
  if (layer < 1 || layer > distortionAvailableMax.value) return
  selectedDistortionLayer.value = layer
}

function openDistortionLaunch() {
  if (!props.state.distortionUnlocked || selectedDistortionLayer.value > distortionAvailableMax.value) return
  launchOpen.value = true
}

function selectNode(index: number) {
  if (!nodeAvailable(index)) return
  selectedNodeIndex.value = index
  launchOpen.value = true
}

function confirmLaunch() {
  if (!preview.value.canLaunch) return
  emit('launch', preview.value)
  now.value = Date.now()
  launchOpen.value = false
}

function assignBlueprint(slotIndex: number, event: Event) {
  const buildingId = (event.target as HTMLSelectElement).value
  if (buildingId) emit('assignBlueprint', { slotIndex, buildingId })
}
</script>

<template>
  <div class="expedition-page" :style="{ '--expedition-bg': `url(${asset('star-map.webp')})` }">
    <section v-if="!state.unlocked" class="expedition-locked">
      <div class="locked-orbit"><Compass :size="52" /><span><Lock :size="18" /></span></div>
      <small>TIME EXPEDITION</small>
      <h2>时空远征</h2>
      <p>完成首次转生，并曾经解锁银河引擎后开放。</p>
      <div class="unlock-requirements">
        <span :class="{ done: state.highestBuildingIndexEver >= 8 }"><Check :size="14" /> 历史解锁银河引擎</span>
        <span><Orbit :size="14" /> 完成至少一次转生</span>
      </div>
      <details class="expedition-help locked-help">
        <summary><CircleHelp :size="15" /> 为什么还没解锁？</summary>
        <div class="help-body">
          <p>两个条件需要同时满足：本存档至少转生1次，并且历史上曾解锁银河引擎。</p>
          <p>转生后建筑被重置不会失去“历史解锁”记录；已有转生记录的旧存档会自动兼容。</p>
        </div>
      </details>
    </section>

    <template v-else>
      <header class="expedition-header">
        <div>
          <small>TIME EXPEDITION</small>
          <h2><Compass :size="21" /> 时空远征</h2>
        </div>
        <div class="expedition-resources">
          <span title="远征体力"><img :src="asset('resources/time-sand.webp')" alt="远征体力" />{{ Math.floor(state.timeSand) }}/{{ getTimeSandCap(state) }}</span>
          <span title="远征货币"><img :src="asset('resources/stardust.webp')" alt="远征货币" />{{ formatNumber(state.stardust) }}</span>
          <span title="时空核心"><img :src="asset('resources/chrono-core.webp')" alt="时空核心" />{{ state.chronoCores }}</span>
        </div>
      </header>

      <p v-if="clockWarning" class="clock-warning"><AlertTriangle :size="14" /><img class="currency-icon" :src="asset('resources/time-sand.webp')" alt="远征体力" /> {{ clockWarning }}</p>

      <details class="expedition-help primary-help">
        <summary><CircleHelp :size="16" /> 玩法说明 <span>点击展开</span></summary>
        <div class="help-body">
          <ol>
            <li>按顺序挑战星域节点，选择航线、投入比例和远征时长；战力不足时不能出发。</li>
            <li>远征期间只占用对应比例的建筑自动产出，手动点击不受影响；完成后立即恢复完整产出。</li>
            <li>奖励在出发时固定，完成后需要手动领取。<img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />远征货币用于本轮强化，<img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />时空核心用于永久遗物和建筑蓝图。</li>
            <li><img class="currency-icon" :src="asset('resources/time-sand.webp')" alt="远征体力" />远征体力每10分钟恢复1点；转生会重组地图并重置<img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />远征货币、临时强化和节点进度。</li>
          </ol>
        </div>
      </details>

      <section v-if="state.activeMission" class="mission-card active">
        <img :src="asset('fleet.webp')" alt="远征舰队" />
        <div>
          <small>远征进行中 · {{ EXPEDITION_ZONES[state.activeMission.zone - 1]?.name }}</small>
          <strong>{{ NODE_TYPE_CONFIG[state.activeMission.nodeType].name }}</strong>
          <span><Clock3 :size="13" /> {{ timeLabel(remainingSeconds) }} · 投入 {{ Math.round(state.activeMission.allocation * 100) }}%</span>
        </div>
        <button class="mission-cancel" @click="emit('cancel')">取消</button>
      </section>

      <section v-else-if="state.pendingEvent && activeEvent" class="mission-card event-pending">
        <AlertTriangle :size="38" />
        <div>
          <small>星域事件待处理</small>
          <strong>{{ activeEvent.name }}</strong>
          <span>选择处理方式后才能领取远征奖励</span>
        </div>
        <span class="event-pending-mark">?</span>
      </section>

      <section v-else-if="state.pendingReward" class="mission-card reward">
        <PackageOpen :size="38" />
        <div>
          <small>远征已完成</small>
          <strong>{{ EXPEDITION_ZONES[state.pendingReward.zone - 1]?.name }}奖励待领取</strong>
          <span class="reward-values">+{{ formatNumber(state.pendingReward.cubeReward) }} cube · <img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />+{{ state.pendingReward.stardustReward }} 远征货币<template v-if="state.pendingReward.coreReward"> · <img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />+{{ state.pendingReward.coreReward }} 时空核心</template></span>
        </div>
        <button class="claim-btn" @click="emit('claim')">领取</button>
      </section>

      <nav class="expedition-tabs">
        <button :class="{ active: section === 'map' }" @click="section = 'map'"><Orbit :size="15" />星图</button>
        <button :class="{ active: section === 'upgrades' }" @click="section = 'upgrades'"><TrendingUp :size="15" />强化</button>
        <button :class="{ active: section === 'blueprints' }" @click="section = 'blueprints'"><Atom :size="15" />蓝图</button>
        <button :class="{ active: section === 'relics' }" @click="section = 'relics'"><Gem :size="15" />遗物</button>
      </nav>

      <section v-if="section === 'map'" class="map-section">
        <div class="expedition-mode-switch">
          <button :class="{ active: mapMode === 'standard' }" @click="selectMapMode('standard')"><Orbit :size="14" />普通星域</button>
          <button :class="{ active: mapMode === 'distortion' }" :disabled="!state.distortionUnlocked" @click="selectMapMode('distortion')">
            <Zap :size="14" />扭曲星域 <Lock v-if="!state.distortionUnlocked" :size="11" />
          </button>
        </div>

        <template v-if="mapMode === 'standard'">
          <details class="expedition-help compact-help">
            <summary><CircleHelp :size="14" /> 星图与节点说明</summary>
            <div class="help-body">
              <p>每个星域有8个资源节点、2个异常节点、1个精英节点和1个首领，必须依次完成。</p>
              <p>异常与精英节点本轮首次完成会触发事件。首次通关获得永久<img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />时空核心。</p>
            </div>
          </details>
          <article class="zone-banner">
            <img :src="asset(zone.banner)" :alt="zone.name" />
            <div class="zone-shade"></div>
            <button :disabled="selectedZone <= 1" @click="selectZone(-1)"><ChevronLeft :size="20" /></button>
            <div>
              <small>星域 {{ zone.id }} / 10</small><strong>{{ zone.name }}</strong><span>建议阶段：{{ zone.stage }}</span>
              <span class="mastery-stars" :aria-label="`精通${displayedMasteryLevel}级`"><Star v-for="level in 5" :key="level" :size="12" :class="{ earned: level <= displayedMasteryLevel }" /></span>
            </div>
            <button :disabled="selectedZone >= state.highestZoneUnlocked" @click="selectZone(1)"><ChevronRight :size="20" /></button>
          </article>

          <details class="expedition-help compact-help mastery-help">
            <summary><Crown :size="14" /> 星域精通 {{ displayedMasteryLevel }}/5</summary>
            <div class="mastery-list">
              <span v-for="id in MASTERY_CHALLENGE_IDS" :key="id" :class="{ done: displayedMasteryChallenges.has(id) }">
                <Check v-if="displayedMasteryChallenges.has(id)" :size="13" /><Lock v-else :size="12" />
                <b>{{ MASTERY_CHALLENGES[id].name }}</b><small>{{ MASTERY_CHALLENGES[id].desc }}</small>
              </span>
            </div>
          </details>

          <div class="node-path">
            <button
              v-for="node in nodes"
              :key="node.id"
              class="expedition-node"
              :class="[node.type, { completed: nodeCompleted(node.id), locked: !nodeAvailable(node.index) }]"
              :disabled="!nodeAvailable(node.index)"
              @click="selectNode(node.index)"
            >
              <Check v-if="nodeCompleted(node.id)" :size="18" />
              <Lock v-else-if="!nodeAvailable(node.index)" :size="15" />
              <Crown v-else-if="node.type === 'boss'" :size="20" />
              <Shield v-else-if="node.type === 'elite'" :size="18" />
              <Sparkles v-else-if="node.type === 'anomaly'" :size="18" />
              <Star v-else :size="17" />
              <small>{{ node.index }}</small>
            </button>
          </div>
          <p class="map-note">节点顺序会在转生后重组，首次通关与星域精通永久记录。</p>
        </template>

        <template v-else>
          <details class="expedition-help compact-help">
            <summary><CircleHelp :size="14" /> 扭曲星域说明</summary>
            <div class="help-body">
              <p>20层扭曲挑战必须依次首次通关；已完成层可以重复挑战，但不会重复获得永久奖励。</p>
              <p>第5、10、15、20层首次通关各奖励<img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />1时空核心。</p>
            </div>
          </details>
          <article class="zone-banner distortion-banner">
            <img :src="asset(distortionZone.banner)" :alt="distortionZone.name" />
            <div class="zone-shade distortion-shade"></div>
            <button :disabled="selectedDistortionLayer <= 1" @click="selectDistortionLayer(selectedDistortionLayer - 1)"><ChevronLeft :size="20" /></button>
            <div>
              <small>扭曲层 {{ selectedDistortionLayer }} / {{ DISTORTION_MAX_LAYER }}</small>
              <strong>{{ distortionZone.name }} · 扭曲</strong>
              <span>{{ distortionRule.name }} · 来源星域精通 {{ displayedMasteryLevel }}/5</span>
            </div>
            <button :disabled="selectedDistortionLayer >= distortionAvailableMax" @click="selectDistortionLayer(selectedDistortionLayer + 1)"><ChevronRight :size="20" /></button>
          </article>

          <div class="distortion-layer-grid">
            <button v-for="layer in DISTORTION_MAX_LAYER" :key="layer" :class="{ selected: selectedDistortionLayer === layer, completed: layer <= state.highestDistortionCleared, milestone: layer % 5 === 0 }" :disabled="layer > distortionAvailableMax" @click="selectDistortionLayer(layer)">{{ layer }}</button>
          </div>

          <article class="distortion-rule-card">
            <Zap :size="22" /><div><small>本层规则</small><strong>{{ distortionRule.name }}</strong><span>{{ distortionRule.desc }}</span></div>
          </article>
          <button class="distortion-launch-btn" :disabled="selectedDistortionLayer > distortionAvailableMax" @click="openDistortionLaunch"><Rocket :size="16" />挑战第{{ selectedDistortionLayer }}层</button>
        </template>
      </section>

      <section v-else-if="section === 'upgrades'" class="expedition-list">
        <details class="expedition-help compact-help section-help">
          <summary><CircleHelp :size="14" /> 强化说明</summary>
          <div class="help-body">
            <p>消耗<img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />远征货币提升战力、扫描、回收率或航行速度。所有临时强化和未保留部分会在转生时重置。</p>
            <p>物质回收与遗物叠加后，cube返还率最高为95%。</p>
          </div>
        </details>
        <article v-for="id in TEMP_UPGRADE_IDS" :key="id" class="expedition-upgrade-card">
          <div class="expedition-card-icon"><Zap v-if="id === 'hull'" :size="20" /><Star v-else-if="id === 'scanner'" :size="20" /><PackageOpen v-else-if="id === 'recovery'" :size="20" /><Timer v-else :size="20" /></div>
          <div><strong>{{ TEMP_UPGRADES[id].name }}</strong><small><img v-if="id === 'scanner'" class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />{{ TEMP_UPGRADES[id].desc }}</small><span>Lv.{{ state.tempUpgradeLevels[id] }}/{{ TEMP_UPGRADES[id].maxLevel }}</span></div>
          <button
            :disabled="state.tempUpgradeLevels[id] >= TEMP_UPGRADES[id].maxLevel || state.stardust < getTempUpgradeCost(state.tempUpgradeLevels[id])"
            @click="emit('buyTempUpgrade', id)"
          ><img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />{{ getTempUpgradeCost(state.tempUpgradeLevels[id]) }}</button>
        </article>
        <p class="section-note"><img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />远征货币和本页强化会在转生时重置。</p>
      </section>

      <section v-else-if="section === 'blueprints'" class="blueprint-section">
        <details class="expedition-help compact-help">
          <summary><CircleHelp :size="14" /> 蓝图说明</summary>
          <div class="help-body">
            <p>蓝图永久强化指定建筑的基础产出，每级+10%，最高5级；三个槽位不能选择相同建筑。</p>
            <p>第1槽随远征开放，第2、3槽分别在击败第4和第8星域首领后开放。更换目标消耗<img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />500 远征货币。</p>
          </div>
        </details>
        <article v-for="(slot, index) in state.blueprintSlots" :key="index" class="blueprint-card" :class="{ locked: index >= activeSlotCount }">
          <img :src="asset('blueprint-frame.webp')" alt="" />
          <template v-if="index < activeSlotCount">
            <small>蓝图槽 {{ index + 1 }}</small>
            <select :value="slot.buildingId ?? ''" @change="assignBlueprint(index, $event)">
              <option value="" disabled>选择建筑</option>
              <option v-for="building in buildings" :key="building.id" :value="building.id" :disabled="usedBlueprintBuildings.has(building.id) && slot.buildingId !== building.id">{{ building.name }}</option>
            </select>
            <strong>基础产出 +{{ slot.level * 10 }}%</strong>
            <span v-if="slot.buildingId" class="inline-currency">更换目标消耗 <img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />{{ BLUEPRINT_REASSIGN_COST }} 远征货币</span>
            <button :disabled="!slot.buildingId || slot.level >= 5 || state.chronoCores < getBlueprintUpgradeCost(slot)" @click="emit('upgradeBlueprint', index)">
              <template v-if="slot.level >= 5">MAX</template>
              <template v-else>升级 · <img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />{{ getBlueprintUpgradeCost(slot) }}</template>
            </button>
          </template>
          <template v-else>
            <Lock :size="24" />
            <strong>{{ index === 1 ? '击败第4星域首领解锁' : '击败第8星域首领解锁' }}</strong>
          </template>
        </article>
      </section>

      <section v-else class="relic-section">
        <details class="expedition-help compact-help">
          <summary><CircleHelp :size="14" /> 遗物说明</summary>
          <div class="help-body">
            <p>遗物使用永久<img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />时空核心购买，最多同时装备3件。购买后会自动装备，效果只在装备时生效。</p>
            <p>重置会退还全部遗物花费，可随时重新规划组合。</p>
          </div>
        </details>
        <div class="relic-summary"><span>已装备 {{ state.equippedRelicIds.length }}/3</span><button :disabled="state.ownedRelicIds.length === 0" @click="emit('resetRelics')">重置并返还 <img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />时空核心</button></div>
        <div class="relic-grid">
          <article v-for="id in RELIC_IDS" :key="id" class="relic-card" :class="{ owned: ownedRelics.has(id), equipped: equippedRelics.has(id) }">
            <img :src="asset(RELICS[id].image)" :alt="RELICS[id].name" />
            <strong>{{ RELICS[id].name }}</strong>
            <small><img v-if="['dustPrism', 'safetyAnchor', 'abyssContract', 'cycleCore'].includes(id)" class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" /><img v-else-if="id === 'timeBottle'" class="currency-icon" :src="asset('resources/time-sand.webp')" alt="远征体力" />{{ RELICS[id].desc }}</small>
            <button v-if="!ownedRelics.has(id)" :disabled="state.chronoCores < RELICS[id].cost" @click="emit('buyRelic', id)"><img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />{{ RELICS[id].cost }}</button>
            <button v-else @click="emit('toggleRelic', id)">{{ equippedRelics.has(id) ? '卸下' : '装备' }}</button>
          </article>
        </div>
      </section>
    </template>

    <Transition name="expedition-sheet">
      <div v-if="state.pendingEvent && activeEvent" class="launch-overlay event-overlay">
        <section class="launch-sheet event-sheet">
          <img class="event-art" :src="asset(activeEvent.image)" :alt="activeEvent.name" />
          <small>STARFIELD EVENT</small>
          <h3>{{ activeEvent.name }}</h3>
          <p>{{ activeEvent.desc }}</p>
          <div class="event-options">
            <button v-for="option in activeEvent.options" :key="option.id" @click="emit('chooseEvent', option.id)">
              <span class="event-option-title">
                <img v-if="option.desc.includes('远征货币')" class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />
                <img v-if="option.desc.includes('远征体力')" class="currency-icon" :src="asset('resources/time-sand.webp')" alt="远征体力" />
                {{ option.name }}
              </span>
              <small>{{ option.desc }}</small>
            </button>
          </div>
          <p class="event-lock-note"><Lock :size="12" />选择会立即保存，之后才能领取奖励。</p>
        </section>
      </div>
    </Transition>

    <Transition name="expedition-sheet">
      <div v-if="launchOpen" class="launch-overlay" @click.self="launchOpen = false">
        <section class="launch-sheet">
          <button class="sheet-close" @click="launchOpen = false"><X :size="18" /></button>
          <small>{{ preview.mode === 'distortion' ? `${distortionZone.name} · 扭曲层 ${preview.distortionLayer}` : `${zone.name} · 节点 ${selectedNode.index}` }}</small>
          <h3>{{ preview.mode === 'distortion' ? distortionRule.name : NODE_TYPE_CONFIG[selectedNode.type].name }}</h3>

          <details class="expedition-help compact-help launch-help">
            <summary><CircleHelp :size="14" /> 航线与投入说明</summary>
            <div class="help-body">
              <p>安全航线更容易且返还更多cube；异常航线难度更高、<img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />远征货币更多，但cube返还更少。</p>
              <p>投入越高，远征战力和该项收益越高，同时主世界暂时损失的建筑产出也越多。面板下方会实时显示最终结果。</p>
            </div>
          </details>

          <div class="route-grid">
            <button v-for="(route, id) in EXPEDITION_ROUTES" :key="id" :class="{ active: selectedRoute === id }" @click="selectedRoute = id">
              <img :src="asset(route.image)" :alt="route.name" /><span>{{ route.name }}</span>
            </button>
          </div>
          <div class="choice-row">
            <button v-for="(option, allocation) in EXPEDITION_ALLOCATIONS" :key="allocation" :class="{ active: selectedAllocation === Number(allocation) }" @click="selectedAllocation = Number(allocation) as ExpeditionAllocation">{{ option.label }}</button>
          </div>
          <div class="choice-row durations">
            <button v-for="(duration, id) in EXPEDITION_DURATIONS" :key="id" :class="{ active: selectedDuration === id }" @click="selectedDuration = id">{{ duration.name }}</button>
          </div>

          <div class="preview-grid">
            <span>远征战力<strong :class="{ insufficient: preview.power < preview.requiredPower }">{{ preview.power }} / {{ preview.requiredPower }}</strong></span>
            <span>主世界投入<strong>{{ Math.round(preview.allocation * 100) }}%</strong></span>
            <span>预计返还<strong>{{ formatNumber(preview.cubeReward) }} cube</strong></span>
            <span><span class="preview-label"><img class="currency-icon" :src="asset('resources/stardust.webp')" alt="远征货币" />远征货币奖励</span><strong>+{{ preview.stardustReward }}</strong></span>
            <span><span class="preview-label"><img class="currency-icon" :src="asset('resources/chrono-core.webp')" alt="时空核心" />时空核心奖励</span><strong>+{{ preview.coreReward }}</strong></span>
            <span><span class="preview-label">耗时 / <img class="currency-icon" :src="asset('resources/time-sand.webp')" alt="远征体力" />远征体力</span><strong>{{ timeLabel(preview.effectiveDurationSeconds) }} · {{ preview.timeSandCost }}</strong></span>
          </div>
          <button class="launch-btn" :disabled="!preview.canLaunch" @click="confirmLaunch"><Rocket :size="17" /><img v-if="preview.reason === '远征体力不足'" class="currency-icon" :src="asset('resources/time-sand.webp')" alt="远征体力" />{{ preview.canLaunch ? '开始远征' : preview.reason }}</button>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expedition-page{min-height:100%;padding:12px 10px 88px;color:#f5f3ff;background:linear-gradient(rgba(5,4,25,.84),rgba(9,6,30,.94)),var(--expedition-bg) center/cover fixed}.expedition-locked{min-height:62vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px}.locked-orbit{width:116px;height:116px;border:1px solid rgba(168,85,247,.5);border-radius:50%;display:grid;place-items:center;color:#fbbf24;position:relative;box-shadow:0 0 45px rgba(124,58,237,.28);margin-bottom:18px}.locked-orbit:before{content:"";position:absolute;inset:12px;border:1px dashed rgba(251,191,36,.35);border-radius:50%}.locked-orbit span{position:absolute;right:4px;bottom:8px;background:#17122e;border:1px solid #6d5a9b;border-radius:50%;padding:7px}.expedition-locked small,.expedition-header small{letter-spacing:2px;color:#a78bfa}.expedition-locked h2{font-size:26px;margin:5px}.expedition-locked p{color:#a7a0bb;max-width:270px}.unlock-requirements{display:grid;gap:8px;margin-top:18px}.unlock-requirements span{display:flex;align-items:center;gap:7px;color:#77708d;background:rgba(255,255,255,.04);padding:9px 13px;border-radius:10px}.unlock-requirements .done{color:#4ade80}.expedition-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.expedition-header h2{display:flex;align-items:center;gap:7px;margin:3px 0;font-size:20px}.expedition-resources{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.expedition-resources span{display:flex;align-items:center;gap:3px;padding:5px 7px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(10,8,31,.75);font-size:10px}.expedition-resources img{width:17px;height:17px;object-fit:contain}.clock-warning{display:flex;align-items:center;gap:6px;padding:8px 10px;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.35);color:#fbbf24;border-radius:9px;font-size:11px}.mission-card{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:9px;margin:10px 0;padding:10px;border:1px solid rgba(139,92,246,.32);border-radius:14px;background:linear-gradient(135deg,rgba(88,28,135,.26),rgba(15,23,42,.8))}.mission-card>img{width:52px;height:52px;object-fit:contain}.mission-card>div{display:flex;flex-direction:column;gap:2px;min-width:0}.mission-card small{color:#a78bfa}.mission-card strong{font-size:13px}.mission-card span{font-size:10px;color:#aaa;display:flex;align-items:center;gap:4px}.mission-cancel,.claim-btn{border:0;border-radius:9px;padding:8px 10px;color:white;background:#4c1d95}.mission-card.reward{border-color:rgba(251,191,36,.45);color:#fbbf24}.claim-btn{background:#d97706}.expedition-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:12px 0}.expedition-tabs button{border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.04);color:#817a94;padding:8px 2px;display:flex;justify-content:center;align-items:center;gap:3px;font-size:11px}.expedition-tabs button.active{color:#fbbf24;border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.09)}.zone-banner{height:154px;border-radius:16px;overflow:hidden;position:relative;display:grid;grid-template-columns:38px 1fr 38px;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.12)}.zone-banner>img,.zone-shade{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.zone-shade{background:linear-gradient(90deg,rgba(4,3,18,.75),rgba(4,3,18,.28),rgba(4,3,18,.75))}.zone-banner button,.zone-banner>div:not(.zone-shade){position:relative;z-index:1}.zone-banner button{border:0;background:transparent;color:white;height:100%}.zone-banner button:disabled{opacity:.2}.zone-banner>div:not(.zone-shade){display:flex;flex-direction:column;gap:4px;text-shadow:0 2px 8px #000}.zone-banner strong{font-size:23px}.zone-banner small{color:#fbbf24}.zone-banner span{font-size:10px;color:#ddd}.node-path{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:24px 14px;padding:26px 16px 18px}.node-path:before{content:"";position:absolute;inset:50px 38px;background:linear-gradient(90deg,transparent,rgba(139,92,246,.4),transparent);height:1px;box-shadow:0 76px rgba(139,92,246,.25),0 152px rgba(139,92,246,.2)}.expedition-node{position:relative;z-index:1;justify-self:center;width:52px;height:52px;border-radius:50%;border:2px solid #6d28d9;background:#21173d;color:#c4b5fd;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(109,40,217,.3)}.expedition-node small{position:absolute;bottom:-17px;color:#8c86a0}.expedition-node.anomaly{border-color:#ec4899;color:#f9a8d4}.expedition-node.elite{border-color:#f97316;color:#fdba74}.expedition-node.boss{border-color:#fbbf24;color:#fde68a;box-shadow:0 0 22px rgba(251,191,36,.32)}.expedition-node.completed{border-color:#22c55e;color:#86efac;background:#123523}.expedition-node.locked{filter:grayscale(1);opacity:.4}.map-note,.section-note{font-size:10px;color:#746d86;text-align:center}.expedition-list{display:grid;gap:8px}.expedition-upgrade-card{display:grid;grid-template-columns:42px 1fr auto;gap:9px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.08);background:rgba(15,12,40,.78);border-radius:12px}.expedition-card-icon{width:42px;height:42px;border-radius:11px;background:rgba(124,58,237,.18);display:grid;place-items:center;color:#c4b5fd}.expedition-upgrade-card>div:nth-child(2){display:flex;flex-direction:column;gap:2px}.expedition-upgrade-card small{color:#898198;font-size:10px}.expedition-upgrade-card span{color:#a78bfa;font-size:10px}.expedition-upgrade-card button,.blueprint-card button,.relic-card button{border:0;border-radius:8px;background:#5b21b6;color:#fff;padding:7px;font-size:10px}.expedition-upgrade-card button:disabled,.blueprint-card button:disabled,.relic-card button:disabled,.launch-btn:disabled{opacity:.35}.blueprint-section{display:grid;gap:10px}.blueprint-card{position:relative;min-height:150px;border:1px solid rgba(59,130,246,.25);border-radius:14px;overflow:hidden;padding:14px;display:flex;flex-direction:column;align-items:center;gap:7px;background:rgba(8,20,48,.78)}.blueprint-card>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.16}.blueprint-card>*:not(img){position:relative}.blueprint-card select{width:min(260px,90%);background:#101935;color:white;border:1px solid #354a7c;border-radius:8px;padding:8px}.blueprint-card span{font-size:10px;color:#7f8eaf}.blueprint-card.locked{justify-content:center;color:#6b7280}.relic-summary{display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:8px}.relic-summary button{border:0;background:transparent;color:#a78bfa;font-size:10px}.relic-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.relic-card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(15,12,40,.8)}.relic-card img{width:72px;height:72px;object-fit:contain}.relic-card small{font-size:9px;color:#8e879d;min-height:28px}.relic-card.owned{border-color:rgba(168,85,247,.38)}.relic-card.equipped{border-color:#fbbf24;box-shadow:inset 0 0 20px rgba(251,191,36,.08)}.launch-overlay{position:fixed;z-index:400;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center}.launch-sheet{position:relative;width:min(480px,100%);max-height:88vh;overflow-y:auto;background:#100d27;border-radius:22px 22px 0 0;padding:18px 14px max(18px,env(safe-area-inset-bottom));border-top:1px solid #5b21b6}.sheet-close{position:absolute;right:13px;top:13px;border:0;background:#28223d;color:white;border-radius:50%;width:30px;height:30px}.launch-sheet>small{color:#a78bfa}.launch-sheet h3{margin:4px 0 12px}.route-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.route-grid button{padding:0;overflow:hidden;border:2px solid transparent;background:#201a37;color:#aaa;border-radius:10px}.route-grid button.active{border-color:#fbbf24;color:white}.route-grid img{width:100%;height:58px;object-fit:cover;display:block}.route-grid span{display:block;padding:5px;font-size:10px}.choice-row{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}.choice-row.durations{grid-template-columns:repeat(4,1fr)}.choice-row button{border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#1b1730;color:#8f879f;padding:8px 3px;font-size:10px}.choice-row button.active{border-color:#8b5cf6;color:#ddd;background:#31205b}.preview-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:12px 0}.preview-grid span{background:rgba(255,255,255,.035);border-radius:8px;padding:8px;color:#8f879f;font-size:9px;display:flex;flex-direction:column;gap:2px}.preview-grid strong{color:#eee;font-size:11px}.preview-grid strong.insufficient{color:#fb7185}.launch-btn{width:100%;border:0;border-radius:11px;padding:12px;background:linear-gradient(90deg,#7c3aed,#d97706);color:white;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px}.expedition-sheet-enter-active,.expedition-sheet-leave-active{transition:.2s}.expedition-sheet-enter-from,.expedition-sheet-leave-to{opacity:0}.expedition-sheet-enter-from .launch-sheet,.expedition-sheet-leave-to .launch-sheet{transform:translateY(30px)}
.currency-icon{display:inline-block;width:15px!important;height:15px!important;object-fit:contain;vertical-align:-3px;margin:0 2px;flex:0 0 auto}.expedition-upgrade-card button,.blueprint-card button,.relic-card button,.relic-summary button{display:inline-flex;align-items:center;justify-content:center}.reward-values{flex-wrap:wrap}.preview-grid>span{background:rgba(255,255,255,.035);border-radius:8px;padding:8px;color:#8f879f;font-size:9px;display:flex;flex-direction:column;gap:2px}.preview-label{display:flex;align-items:center;background:transparent!important;padding:0!important;border-radius:0!important;flex-direction:row!important}.preview-label .currency-icon{margin-left:0}.expedition-help{margin:10px 0;border:1px solid rgba(139,92,246,.28);border-radius:11px;background:rgba(15,12,40,.72);overflow:hidden;text-align:left}.expedition-help summary{list-style:none;display:flex;align-items:center;gap:6px;padding:9px 11px;color:#c4b5fd;font-size:11px;cursor:pointer;user-select:none}.expedition-help summary::-webkit-details-marker{display:none}.expedition-help summary span{margin-left:auto;color:#6f6880;font-size:9px}.expedition-help[open] summary{color:#fbbf24;background:rgba(139,92,246,.09)}.help-body{padding:9px 12px 10px;border-top:1px solid rgba(139,92,246,.16);color:#aaa3b8;font-size:10px;line-height:1.65}.help-body p{margin:0}.help-body p+p{margin-top:5px}.help-body ol{margin:0;padding-left:18px}.help-body li+li{margin-top:4px}.locked-help{width:min(310px,100%);margin-top:14px}.primary-help{border-color:rgba(251,191,36,.24);background:linear-gradient(135deg,rgba(88,28,135,.2),rgba(15,12,40,.74))}.compact-help{margin:0 0 9px}.section-help{grid-column:1/-1}.launch-help{margin:-2px 0 10px;background:rgba(255,255,255,.035)}
.event-pending{border-color:rgba(236,72,153,.48);color:#f9a8d4}.event-pending-mark{width:30px;height:30px;border:1px solid #ec4899;border-radius:50%;display:grid!important;place-items:center;color:#f9a8d4!important;font-size:17px!important}.expedition-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:9px}.expedition-mode-switch button{display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(15,12,40,.78);color:#77708d;font-size:11px}.expedition-mode-switch button.active{border-color:#a855f7;color:#e9d5ff;background:rgba(126,34,206,.2)}.expedition-mode-switch button:disabled{opacity:.4}.mastery-stars{display:flex!important;justify-content:center;gap:2px}.mastery-stars svg{fill:transparent;color:#6b637e}.mastery-stars svg.earned{fill:#fbbf24;color:#fde68a}.mastery-list{display:grid;gap:5px;padding:9px 11px;border-top:1px solid rgba(139,92,246,.16)}.mastery-list>span{display:grid;grid-template-columns:16px 84px 1fr;align-items:center;color:#716a81;font-size:10px}.mastery-list>span.done{color:#86efac}.mastery-list small{color:#817a94}.distortion-banner{border-color:rgba(236,72,153,.45);box-shadow:inset 0 0 34px rgba(168,85,247,.25)}.distortion-shade{background:repeating-linear-gradient(115deg,rgba(4,3,18,.78) 0 26px,rgba(88,28,135,.45) 27px 29px,rgba(4,3,18,.58) 30px 55px),radial-gradient(circle,transparent,rgba(4,3,18,.8))}.distortion-layer-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin:10px 0}.distortion-layer-grid button{aspect-ratio:1;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:#17132d;color:#716a81;font-size:9px}.distortion-layer-grid button.completed{border-color:#22c55e;color:#86efac}.distortion-layer-grid button.selected{outline:2px solid #a855f7;color:white}.distortion-layer-grid button.milestone{box-shadow:inset 0 -2px #fbbf24}.distortion-layer-grid button:disabled{opacity:.25}.distortion-rule-card{display:grid;grid-template-columns:38px 1fr;gap:8px;align-items:center;padding:10px;border:1px solid rgba(236,72,153,.32);border-radius:12px;background:rgba(80,7,95,.2);color:#f0abfc}.distortion-rule-card>div{display:flex;flex-direction:column;gap:2px}.distortion-rule-card small,.distortion-rule-card span{font-size:9px;color:#9d8aa8}.distortion-launch-btn{width:100%;margin-top:9px;padding:11px;border:0;border-radius:10px;background:linear-gradient(90deg,#7e22ce,#db2777);color:white;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px}.distortion-launch-btn:disabled{opacity:.35}.event-overlay{z-index:430;background:rgba(3,2,12,.86)}.event-sheet{padding-top:12px;border-top-color:#ec4899}.event-art{width:100%;height:180px;object-fit:cover;border-radius:14px;margin-bottom:10px}.event-sheet>p{color:#aaa3b8;font-size:11px;line-height:1.55}.event-options{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.event-options button{min-height:82px;border:1px solid rgba(168,85,247,.42);border-radius:12px;background:linear-gradient(145deg,rgba(88,28,135,.35),rgba(15,12,40,.9));color:white;padding:10px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left}.event-options button:active{border-color:#fbbf24}.event-option-title{display:flex;align-items:center;font-weight:700}.event-options small{color:#9d95aa;line-height:1.4}.event-lock-note{display:flex;align-items:center;justify-content:center;gap:4px;text-align:center;color:#70677d!important;font-size:9px!important}
@media(max-width:370px){.expedition-resources{max-width:180px}.node-path{padding-inline:7px;gap:23px 6px}.expedition-node{width:47px;height:47px}.relic-grid{grid-template-columns:1fr}.preview-grid{grid-template-columns:1fr}}
</style>
