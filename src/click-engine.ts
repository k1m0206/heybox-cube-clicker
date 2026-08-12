export const CLICK_COMBO_WINDOW_MS = 1000
export const CLICK_COMBO_STEP = 0.02

export function advanceClickCombo(
  currentBonus: number,
  maxBonus: number,
  lastClickAt: number,
  now: number,
): number {
  const safeMax = Math.max(0, maxBonus)
  if (safeMax === 0 || lastClickAt <= 0 || now < lastClickAt || now - lastClickAt > CLICK_COMBO_WINDOW_MS) {
    return 0
  }
  return Math.min(safeMax, Math.max(0, currentBonus) + CLICK_COMBO_STEP)
}

export function rollGoldenLuckBonus(maxBonus: number, randomValue = Math.random()): number {
  const safeMax = Math.max(0, Math.floor(maxBonus))
  if (safeMax === 0) return 0
  const normalizedRandom = Math.min(Math.max(randomValue, 0), 0.999999999999)
  return Math.floor(normalizedRandom * (safeMax + 1))
}

export function calculateManualClickGain(
  effectiveClickPower: number,
  comboBonus: number,
  goldenMultiplier = 1,
): number {
  const comboPower = Math.floor(Math.max(0, effectiveClickPower) * (1 + Math.max(0, comboBonus)))
  return comboPower * Math.max(1, goldenMultiplier)
}
