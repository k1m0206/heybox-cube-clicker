<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Check, ChevronLeft, Clock3, Coins, LockKeyhole, Settings2, Sparkles, X } from '@lucide/vue'
import { CHEST_UPGRADES } from '../../chest/config'
import type { ChestSave, ChestUpgradeId } from '../../chest/types'

interface RewardDisplay {
  kind: 'production' | 'chestPoints' | 'heritage' | 'chronoCore'
  title: string
  detail: string
  bonus?: string
}

const props = defineProps<{
  state: ChestSave
  capacity: number
  nextChestSeconds: number
  lastReward: RewardDisplay | null
  openingKey: number
}>()

const emit = defineEmits<{
  openChest: []
  buyUpgrade: [id: ChestUpgradeId]
}>()

const panelOpen = ref(false)
const upgradeOpen = ref(false)
const rewardDialogOpen = ref(false)
const chestSpriteUrl = new URL(`${import.meta.env.BASE_URL}assets/chest/astral-chest-sprite-v2.png`, document.baseURI).href
const chestFrame = ref(0)
const isOpening = ref(false)
const shownReward = ref<RewardDisplay | null>(props.lastReward)
let chestAnimationTimer: number | undefined
const isFull = computed(() => props.state.available >= props.capacity)

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Some embedded webviews expose vibrate but reject the call.
  }
}

function spriteStyle(frame: number) {
  const column = frame % 4
  const row = Math.floor(frame / 4)
  return {
    backgroundImage: `url(${chestSpriteUrl})`,
    backgroundPosition: `${column / 3 * 100}% ${row * 100}%`,
  }
}

function requestOpen() {
  if (isOpening.value || props.state.available <= 0) return
  shownReward.value = null
  chestFrame.value = 0
  isOpening.value = true
  vibrate(35)
  emit('openChest')
}

function openUpgrades() {
  panelOpen.value = false
  upgradeOpen.value = true
}

function closeUpgrades() {
  upgradeOpen.value = false
  panelOpen.value = true
}

function confirmReward() {
  rewardDialogOpen.value = false
  shownReward.value = null
  chestFrame.value = 0
}

watch(() => props.openingKey, (key) => {
  if (key <= 0) return
  if (chestAnimationTimer !== undefined) window.clearTimeout(chestAnimationTimer)
  const sequence = [1, 2, 3, 4, 5, 7]
  let index = 0
  const advance = () => {
    chestFrame.value = sequence[index]
    index += 1
    if (index < sequence.length) {
      if (index === 4) vibrate([28, 24, 55])
      chestAnimationTimer = window.setTimeout(advance, index < 4 ? 105 : 145)
      return
    }
    chestAnimationTimer = window.setTimeout(() => {
      shownReward.value = props.lastReward
      isOpening.value = false
      rewardDialogOpen.value = props.lastReward !== null
      vibrate([55, 35, 90])
      chestAnimationTimer = undefined
    }, 220)
  }
  chestAnimationTimer = window.setTimeout(advance, 90)
})

watch(() => props.lastReward, reward => {
  if (!isOpening.value) shownReward.value = reward
})

onUnmounted(() => {
  if (chestAnimationTimer !== undefined) window.clearTimeout(chestAnimationTimer)
})

function formatCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function upgradeCost(id: ChestUpgradeId) {
  const config = CHEST_UPGRADES.find(item => item.id === id)
  return config?.costs[props.state.upgradeLevels[id]] ?? 0
}
</script>

<template>
  <button class="chest-float" aria-label="打开补给宝箱" @click="panelOpen = true">
    <span class="chest-float-ring ring-one"></span>
    <span class="chest-float-ring ring-two"></span>
    <span class="chest-float-glow"></span>
    <span class="chest-sprite chest-float-sprite" :style="spriteStyle(0)" role="img" aria-label="补给宝箱"></span>
    <b>{{ state.available }}</b>
    <span class="chest-float-timer">{{ isFull ? '已储满' : formatCountdown(nextChestSeconds) }}</span>
  </button>

  <Teleport to="body">
    <Transition name="chest-panel-fade">
      <div v-if="panelOpen" class="chest-overlay" @click.self="panelOpen = false">
        <section class="chest-panel chest-game-page" role="dialog" aria-modal="true" aria-labelledby="chest-panel-title">
          <div class="chest-scene-decor" aria-hidden="true">
            <span class="scene-orbit orbit-a"></span>
            <span class="scene-orbit orbit-b"></span>
            <i v-for="index in 12" :key="index"></i>
          </div>
          <button class="chest-close" aria-label="关闭宝箱" @click="panelOpen = false"><X :size="18" /></button>

          <header class="chest-panel-header">
            <span class="chest-kicker"><Sparkles :size="13" /> 星界补给</span>
            <h2 id="chest-panel-title">星界宝箱</h2>
            <div class="chest-resource-row">
              <span><i class="chest-sprite chest-resource-sprite" :style="spriteStyle(0)"></i> {{ state.available }} / {{ capacity }}</span>
              <span><Coins :size="15" /> {{ state.chestPoints }} 宝箱点</span>
            </div>
            <p><Clock3 :size="13" /> {{ isFull ? '补给舱已满载' : `下一次补给 ${formatCountdown(nextChestSeconds)}` }}</p>
          </header>

          <button class="chest-upgrade-entry" @click="openUpgrades">
            <span><Settings2 :size="16" /> 宝箱升级</span>
            <strong><Coins :size="13" /> {{ state.chestPoints }} <ChevronLeft class="entry-arrow" :size="15" /></strong>
          </button>

          <div class="chest-open-zone" :class="{ 'is-opening': isOpening }">
            <div class="chest-stage-label">
              <span>{{ state.available > 0 ? '补给已就绪' : '等待能量充能' }}</span>
              <b>{{ state.available }} / {{ capacity }}</b>
            </div>
            <div
              :key="openingKey"
              class="chest-sprite chest-main-image"
              :class="{ opening: isOpening }"
              :style="spriteStyle(chestFrame)"
              role="img"
              aria-label="星界补给宝箱"
            ></div>
            <div class="chest-platform" aria-hidden="true"><i></i><i></i></div>
            <div v-if="isOpening && chestFrame >= 4" :key="`burst-${openingKey}`" class="chest-burst" aria-hidden="true">
              <i v-for="index in 8" :key="index"></i>
            </div>
            <button class="chest-open-button" :disabled="state.available <= 0 || isOpening" @click="requestOpen">
              <Sparkles :size="17" />
              {{ isOpening ? '开启中…' : state.available > 0 ? '开启宝箱' : '等待恢复' }}
            </button>
            <small class="chest-open-hint">每次消耗 1 个补给舱 · 奖励立即结算</small>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="chest-panel-fade">
      <div v-if="upgradeOpen" class="chest-overlay upgrade-overlay" @click.self="closeUpgrades">
        <section class="chest-panel chest-upgrade-panel chest-game-page" role="dialog" aria-modal="true" aria-labelledby="chest-upgrade-title">
          <div class="chest-scene-decor" aria-hidden="true">
            <span class="scene-orbit orbit-a"></span>
            <i v-for="index in 8" :key="index"></i>
          </div>
          <button class="chest-back" aria-label="返回宝箱" @click="closeUpgrades"><ChevronLeft :size="19" /></button>
          <header class="upgrade-page-header">
            <span class="chest-kicker"><Settings2 :size="13" /> 永久强化</span>
            <h2 id="chest-upgrade-title">宝箱升级</h2>
            <strong><Coins :size="15" /> {{ state.chestPoints }} 宝箱点数</strong>
          </header>
          <div class="chest-upgrade-list">
            <article v-for="upgrade in CHEST_UPGRADES" :key="upgrade.id" class="chest-upgrade-card">
              <div class="chest-upgrade-icon">
                <LockKeyhole v-if="state.upgradeLevels[upgrade.id] >= upgrade.maxLevel" :size="17" />
                <Sparkles v-else :size="17" />
              </div>
              <div class="chest-upgrade-copy">
                <strong>{{ upgrade.name }} <i>Lv.{{ state.upgradeLevels[upgrade.id] }}/{{ upgrade.maxLevel }}</i></strong>
                <small>{{ upgrade.description }}</small>
              </div>
              <button
                :disabled="state.upgradeLevels[upgrade.id] >= upgrade.maxLevel || state.chestPoints < upgradeCost(upgrade.id)"
                @click="emit('buyUpgrade', upgrade.id)"
              >
                <template v-if="state.upgradeLevels[upgrade.id] >= upgrade.maxLevel">MAX</template>
                <template v-else><Coins :size="12" /> {{ upgradeCost(upgrade.id) }}</template>
              </button>
            </article>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="reward-dialog">
      <div v-if="rewardDialogOpen && shownReward" class="reward-overlay">
        <section class="reward-dialog" role="alertdialog" aria-modal="true" aria-labelledby="chest-reward-title">
          <div class="reward-halo"></div>
          <span class="reward-mark"><Sparkles :size="24" /></span>
          <small>宝箱开启成功</small>
          <h2 id="chest-reward-title" :class="`reward-${shownReward.kind}`">{{ shownReward.title }}</h2>
          <p>{{ shownReward.detail }}</p>
          <em v-if="shownReward.bonus">{{ shownReward.bonus }}</em>
          <button @click="confirmReward"><Check :size="18" /> 确认领取</button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chest-float {
  position: fixed;
  z-index: 35;
  top: 43%;
  right: max(12px, calc((100vw - 480px) / 2 + 12px));
  display: grid;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 1px solid rgba(105, 229, 255, 0.46);
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 42%, rgba(54, 202, 255, .22), transparent 48%),
    linear-gradient(145deg, rgba(42, 25, 99, .98), rgba(10, 9, 37, .98));
  color: #f8eaa5;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 10px 32px rgba(4, 2, 25, 0.58), 0 0 0 4px rgba(100, 218, 255, .05), inset 0 1px rgba(255, 255, 255, 0.16);
  isolation: isolate;
  transition: transform 160ms ease, border-color 160ms ease;
}
.chest-float:active { transform: scale(.93); }
.chest-float-ring { position: absolute; z-index: -1; inset: 5px; border: 1px solid rgba(105,226,255,.28); border-radius: 18px; pointer-events: none; }
.chest-float-ring.ring-one { animation: float-ring 3.2s linear infinite; }
.chest-float-ring.ring-two { inset: 10px; border-color: rgba(183,119,255,.24); animation: float-ring 2.4s linear infinite reverse; }

.chest-float-glow {
  position: absolute;
  z-index: -1;
  inset: 10px;
  border-radius: 50%;
  background: rgba(91, 196, 255, 0.36);
  filter: blur(13px);
  animation: chest-pulse 2.2s ease-in-out infinite;
}

.chest-sprite { display: block; aspect-ratio: 3 / 4; background-repeat: no-repeat; background-size: 400% 200%; }
.chest-float-sprite { z-index: 2; width: 54px; margin-top: -3px; filter: drop-shadow(0 6px 9px rgba(0, 0, 0, 0.52)); }
.chest-float b { position: absolute; z-index: 4; top: -8px; right: -7px; display: grid; min-width: 24px; height: 24px; padding: 0 6px; border: 2px solid #120b31; border-radius: 13px; background: linear-gradient(135deg, #ff607b, #d52c62); color: white; font-size: 11px; place-items: center; box-shadow: 0 4px 11px rgba(216,41,93,.42); }
.chest-float-timer { position: absolute; z-index: 4; bottom: -13px; left: 50%; min-width: 58px; padding: 3px 7px; border: 1px solid rgba(111,221,255,.25); border-radius: 10px; background: rgba(9,8,34,.94); color: #bdefff; font-size: 8px; font-weight: 800; line-height: 1; white-space: nowrap; transform: translateX(-50%); box-shadow: 0 5px 15px rgba(0,0,0,.32); }

.chest-overlay {
  position: fixed;
  z-index: 120;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: #05031a;
  backdrop-filter: blur(12px);
}

.chest-panel {
  position: relative;
  width: min(100%, 480px);
  height: 100dvh;
  max-height: none;
  overflow: hidden;
  padding: calc(22px + env(safe-area-inset-top, 0px)) 18px calc(20px + env(safe-area-inset-bottom, 0px));
  border: 0;
  border-radius: 0;
  background:
    radial-gradient(circle at 50% 42%, rgba(42, 193, 255, .16), transparent 30%),
    radial-gradient(circle at 12% 10%, rgba(133, 78, 235, .2), transparent 30%),
    linear-gradient(180deg, #110b35 0%, #080623 55%, #05041a 100%);
  color: #f5f2ff;
  box-shadow: 0 0 90px rgba(0, 0, 0, 0.72);
}

.chest-game-page { display: flex; flex-direction: column; isolation: isolate; }
.chest-game-page::before { content: ''; position: absolute; z-index: -2; inset: 0; opacity: .26; background-image: linear-gradient(rgba(111,214,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(111,214,255,.035) 1px, transparent 1px); background-size: 28px 28px; mask-image: linear-gradient(to bottom, black, transparent 75%); }
.chest-scene-decor { position: absolute; z-index: -1; inset: 0; overflow: hidden; pointer-events: none; }
.chest-scene-decor::after { content: ''; position: absolute; right: -80px; bottom: 8%; width: 230px; height: 230px; border-radius: 50%; background: radial-gradient(circle, rgba(94,56,201,.22), transparent 68%); filter: blur(8px); }
.chest-scene-decor i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #b9f4ff; box-shadow: 0 0 8px #76e9ff; animation: scene-star 2.4s ease-in-out infinite; }
.chest-scene-decor i:nth-of-type(1) { top: 9%; left: 12%; }
.chest-scene-decor i:nth-of-type(2) { top: 16%; left: 79%; animation-delay: -.4s; }
.chest-scene-decor i:nth-of-type(3) { top: 27%; left: 22%; animation-delay: -1s; }
.chest-scene-decor i:nth-of-type(4) { top: 35%; left: 88%; animation-delay: -.7s; }
.chest-scene-decor i:nth-of-type(5) { top: 45%; left: 8%; animation-delay: -1.3s; }
.chest-scene-decor i:nth-of-type(6) { top: 54%; left: 70%; animation-delay: -.2s; }
.chest-scene-decor i:nth-of-type(7) { top: 64%; left: 17%; animation-delay: -1.7s; }
.chest-scene-decor i:nth-of-type(8) { top: 73%; left: 85%; animation-delay: -.9s; }
.chest-scene-decor i:nth-of-type(9) { top: 81%; left: 35%; animation-delay: -.3s; }
.chest-scene-decor i:nth-of-type(10) { top: 88%; left: 74%; animation-delay: -1.4s; }
.chest-scene-decor i:nth-of-type(11) { top: 39%; left: 48%; animation-delay: -1.9s; }
.chest-scene-decor i:nth-of-type(12) { top: 22%; left: 55%; animation-delay: -.6s; }
.scene-orbit { position: absolute; top: 39%; left: 50%; width: 340px; height: 120px; border: 1px solid rgba(99,225,255,.12); border-radius: 50%; transform: translate(-50%,-50%) rotate(-12deg); }
.scene-orbit.orbit-b { width: 290px; height: 290px; border-color: rgba(172,104,255,.09); transform: translate(-50%,-50%) rotate(30deg); }

.chest-close { position: absolute; z-index: 5; top: calc(15px + env(safe-area-inset-top, 0px)); right: 14px; display: grid; width: 38px; height: 38px; border: 1px solid rgba(126, 224, 255, 0.16); border-radius: 12px; background: rgba(255, 255, 255, 0.055); color: #cfc9e8; place-items: center; cursor: pointer; }
.chest-panel-header { position: relative; z-index: 2; text-align: center; }
.chest-kicker { display: inline-flex; align-items: center; gap: 5px; color: #6ee7ff; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; }
.chest-panel-header h2 { margin: 3px 0 11px; color: #fff; font-size: 29px; letter-spacing: .04em; text-shadow: 0 0 24px rgba(107,227,255,.2); }
.chest-panel-header p { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 9px; color: #a8a1c9; font-size: 13px; }
.chest-resource-row { display: flex; justify-content: center; gap: 8px; }
.chest-resource-row span { display: flex; align-items: center; gap: 6px; padding: 7px 11px; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; background: rgba(255,255,255,.05); color: #ded8f7; font-size: 13px; font-weight: 750; }
.chest-resource-sprite { width: 22px; }

.chest-upgrade-entry { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 13px; padding: 10px 13px; border: 1px solid rgba(119,211,255,.18); border-radius: 12px; background: linear-gradient(100deg, rgba(75,54,156,.28), rgba(33,169,218,.11)); color: #dfdcf5; font-family: inherit; cursor: pointer; box-shadow: inset 0 1px rgba(255,255,255,.04); }
.chest-upgrade-entry span, .chest-upgrade-entry strong { display: flex; align-items: center; gap: 6px; }
.chest-upgrade-entry span { font-size: 14px; font-weight: 850; }
.chest-upgrade-entry strong { color: #ffe06c; font-size: 13px; }
.chest-upgrade-entry .entry-arrow { color: #827ca0; transform: rotate(180deg); }

.chest-open-zone { position: relative; z-index: 2; display: flex; min-height: 0; flex: 1; flex-direction: column; align-items: center; justify-content: center; margin-top: 0; padding: 8px 10px 2px; isolation: isolate; }
.chest-stage-label { display: flex; align-items: center; gap: 9px; margin-bottom: -16px; padding: 6px 11px; border: 1px solid rgba(105,225,255,.14); border-radius: 14px; background: rgba(8,8,36,.55); color: #aaa3c9; font-size: 11px; }
.chest-stage-label span { letter-spacing: .06em; }
.chest-stage-label b { color: #9bedff; font-size: 12px; }
.chest-open-zone.rewarded::before { content: ''; position: absolute; z-index: -1; top: 36px; width: 190px; height: 130px; border-radius: 50%; background: radial-gradient(circle, rgba(255,226,109,.42), rgba(102,216,255,.18) 42%, transparent 72%); filter: blur(9px); animation: reward-glow 900ms ease-out; }
.chest-main-image { z-index: 2; width: min(220px, 58vw); margin-top: -4px; border-radius: 22px; filter: drop-shadow(0 20px 28px rgba(0,0,0,.58)); }
.chest-main-image.opening { animation: chest-open-charge 960ms cubic-bezier(.2,.8,.2,1); }
.chest-open-zone.is-opening { animation: chest-zone-impact 720ms ease-out; }
.chest-open-zone.is-opening .chest-open-button { filter: saturate(.55); }
.chest-platform { position: relative; z-index: 1; width: min(240px,66vw); height: 36px; margin-top: -70px; margin-bottom: 34px; border: 1px solid rgba(91,223,255,.35); border-radius: 50%; background: radial-gradient(ellipse, rgba(75,204,255,.27), rgba(48,42,126,.13) 46%, transparent 68%); box-shadow: 0 0 28px rgba(63,203,255,.18), inset 0 0 18px rgba(118,226,255,.15); transform: perspective(150px) rotateX(60deg); }
.chest-platform i { position: absolute; inset: 7px 18px; border: 1px solid rgba(139,112,255,.25); border-radius: 50%; }
.chest-platform i:last-child { inset: 13px 42px; border-color: rgba(107,232,255,.25); }
.chest-burst { position: absolute; top: 28px; left: 50%; z-index: -1; width: 170px; height: 140px; transform: translateX(-50%); }
.chest-burst i { --dx: 0px; --dy: -70px; position: absolute; top: 62%; left: 50%; width: 6px; height: 6px; border-radius: 2px; background: #ffe575; box-shadow: 0 0 9px #68ddff; animation: chest-spark 680ms ease-out both; }
.chest-burst i:nth-child(1) { --dx: 0px; --dy: -70px; }
.chest-burst i:nth-child(2) { --dx: 55px; --dy: -50px; }
.chest-burst i:nth-child(3) { --dx: 76px; --dy: 0px; }
.chest-burst i:nth-child(4) { --dx: 48px; --dy: 45px; }
.chest-burst i:nth-child(5) { --dx: 0px; --dy: 58px; }
.chest-burst i:nth-child(6) { --dx: -48px; --dy: 45px; }
.chest-burst i:nth-child(7) { --dx: -76px; --dy: 0px; }
.chest-burst i:nth-child(8) { --dx: -55px; --dy: -50px; }
.chest-open-button { display: flex; align-items: center; justify-content: center; gap: 8px; width: min(280px, 86%); min-height: 50px; margin-top: 0; border: 1px solid #ffe77e; border-radius: 14px; background: linear-gradient(180deg, #ffe77a, #d29a16); color: #2b2100; font-family: inherit; font-size: 17px; font-weight: 950; letter-spacing: .04em; cursor: pointer; box-shadow: 0 10px 30px rgba(214,164,31,.3), inset 0 1px rgba(255,255,255,.72), inset 0 -3px rgba(111,68,0,.16); }
.chest-open-button:disabled { border-color: rgba(255,255,255,.08); background: rgba(255,255,255,.07); color: #625d78; box-shadow: none; cursor: not-allowed; }
.chest-open-hint { margin-top: 8px; color: #8f88aa; font-size: 11px; }

.upgrade-overlay { z-index: 125; }
.chest-upgrade-panel { height: 100dvh; max-height: none; overflow-y: auto; }
.chest-back { position: absolute; z-index: 5; top: calc(15px + env(safe-area-inset-top, 0px)); left: 14px; display: grid; width: 38px; height: 38px; border: 1px solid rgba(126,224,255,.16); border-radius: 12px; background: rgba(255,255,255,.055); color: #d5d0ee; place-items: center; cursor: pointer; }
.upgrade-page-header { margin-bottom: 15px; text-align: center; }
.upgrade-page-header h2 { margin: 4px 0 8px; color: #fff1a2; font-size: 27px; }
.upgrade-page-header > strong { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; border: 1px solid rgba(255,213,91,.16); border-radius: 16px; background: rgba(255,213,91,.07); color: #ffdc69; font-size: 13px; }
.chest-upgrade-list { display: grid; gap: 8px; }
.chest-upgrade-card { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 9px; padding: 10px; border: 1px solid rgba(160,138,255,.13); border-radius: 13px; background: rgba(255,255,255,.035); }
.chest-upgrade-icon { display: grid; width: 34px; height: 34px; border: 1px solid rgba(255,214,90,.2); border-radius: 10px; background: rgba(255,203,71,.08); color: #ffd65a; place-items: center; }
.chest-upgrade-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.chest-upgrade-copy strong { color: #eeeaff; font-size: 13px; }
.chest-upgrade-copy i { margin-left: 3px; color: #9a92c1; font-size: 11px; font-style: normal; }
.chest-upgrade-copy small { color: #a09ab9; font-size: 11px; line-height: 1.45; }
.chest-upgrade-card > button { display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 52px; padding: 8px 9px; border: 1px solid rgba(255,214,90,.45); border-radius: 9px; background: rgba(255,205,65,.1); color: #ffdd6d; font-family: inherit; font-size: 12px; font-weight: 850; cursor: pointer; }
.chest-upgrade-card > button:disabled { border-color: rgba(255,255,255,.06); background: rgba(255,255,255,.03); color: #5c5870; cursor: not-allowed; }

.reward-overlay { position: fixed; z-index: 150; inset: 0; display: grid; padding: 20px; background: rgba(3,2,16,.82); backdrop-filter: blur(10px); place-items: center; }
.reward-dialog { position: relative; display: flex; width: min(100%, 340px); overflow: hidden; flex-direction: column; align-items: center; padding: 34px 24px 24px; border: 1px solid rgba(117,226,255,.32); border-radius: 24px; background: radial-gradient(circle at 50% 0%, rgba(79,202,255,.2), transparent 38%), linear-gradient(160deg,#1a1244,#0b0928); color: #f6f3ff; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,.64), 0 0 50px rgba(71,194,255,.12); }
.reward-halo { position: absolute; top: -72px; width: 210px; height: 210px; border-radius: 50%; background: conic-gradient(from 0deg, transparent, rgba(102,225,255,.42), transparent 35%, rgba(189,111,255,.38), transparent 70%); filter: blur(3px); animation: reward-halo-spin 5s linear infinite; }
.reward-mark { z-index: 1; display: grid; width: 54px; height: 54px; border: 1px solid rgba(144,236,255,.55); border-radius: 18px; background: linear-gradient(145deg,rgba(79,214,255,.25),rgba(145,86,245,.24)); color: #9aeeff; place-items: center; box-shadow: 0 0 30px rgba(83,214,255,.26); }
.reward-dialog > small { z-index: 1; margin-top: 14px; color: #9c94c1; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
.reward-dialog h2 { z-index: 1; margin: 5px 0 6px; color: #ffe26d; font-size: 24px; text-shadow: 0 0 20px rgba(255,217,72,.28); }
.reward-dialog h2.reward-heritage { color: #cf9cff; }
.reward-dialog h2.reward-chronoCore { color: #71e8ff; }
.reward-dialog h2.reward-chestPoints { color: #ffcb5c; }
.reward-dialog p { z-index: 1; margin: 0; color: #d7d0ee; font-size: 14px; line-height: 1.5; }
.reward-dialog em { z-index: 1; margin-top: 8px; color: #6ee7ff; font-size: 12px; font-style: normal; font-weight: 800; }
.reward-dialog > button { z-index: 1; display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 47px; margin-top: 20px; border: 1px solid #ffe370; border-radius: 13px; background: linear-gradient(135deg,#ffe876,#d39d1c); color: #2d2200; font-family: inherit; font-size: 15px; font-weight: 900; cursor: pointer; box-shadow: 0 9px 24px rgba(210,161,29,.25); }

.chest-panel-fade-enter-active, .chest-panel-fade-leave-active { transition: opacity 180ms ease; }
.chest-panel-fade-enter-active .chest-panel, .chest-panel-fade-leave-active .chest-panel { transition: transform 220ms ease; }
.chest-panel-fade-enter-from, .chest-panel-fade-leave-to { opacity: 0; }
.chest-panel-fade-enter-from .chest-panel, .chest-panel-fade-leave-to .chest-panel { transform: translateY(32px); }
.reward-pop-enter-active { animation: reward-pop 360ms cubic-bezier(.2,.9,.2,1); }
.reward-pop-leave-active { opacity: 0; transition: opacity 80ms; }
.reward-dialog-enter-active, .reward-dialog-leave-active { transition: opacity 180ms ease; }
.reward-dialog-enter-active .reward-dialog { animation: reward-dialog-in 420ms cubic-bezier(.18,.9,.25,1.14); }
.reward-dialog-enter-from, .reward-dialog-leave-to { opacity: 0; }

@keyframes chest-pulse { 0%,100% { transform: scale(.85); opacity: .48; } 50% { transform: scale(1.15); opacity: .9; } }
@keyframes scene-star { 0%,100% { opacity: .2; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.7); } }
@keyframes float-ring { to { transform: rotate(360deg); } }
@keyframes chest-open-charge { 0% { transform: scale(.96); filter: brightness(.8); } 25% { transform: translateX(-2px) scale(1.015); } 31% { transform: translateX(3px) rotate(.7deg) scale(1.02); } 37% { transform: translateX(-4px) rotate(-.8deg) scale(1.02); } 44% { transform: translateX(4px) rotate(.8deg) scale(1.025); } 52% { transform: translateX(-3px) rotate(-.5deg) scale(1.03); } 64% { transform: translateY(-4px) scale(1.035); } 100% { transform: scale(1); filter: brightness(1.14); } }
@keyframes chest-zone-impact { 0%,38% { transform: translateX(0); } 43% { transform: translateX(-2px); } 48% { transform: translateX(2px); } 53% { transform: translateX(-1px); } 58%,100% { transform: translateX(0); } }
@keyframes chest-spark { 0% { transform: translate(-50%, -50%) scale(.4); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(135deg) scale(.1); opacity: 0; } }
@keyframes reward-glow { 0% { transform: scale(.35); opacity: 0; } 35% { opacity: 1; } 100% { transform: scale(1.18); opacity: .55; } }
@keyframes reward-pop { 0% { transform: translateY(8px) scale(.86); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes reward-halo-spin { to { transform: rotate(360deg); } }
@keyframes reward-dialog-in { 0% { transform: translateY(18px) scale(.82); opacity: 0; } 70% { transform: translateY(-2px) scale(1.025); } 100% { transform: none; opacity: 1; } }

@media (max-width: 430px) {
  .chest-float { right: 8px; width: 60px; height: 60px; }
  .chest-float-sprite { width: 50px; }
  .chest-panel { padding-inline: 12px; }
  .chest-main-image { width: 160px; }
}
</style>
