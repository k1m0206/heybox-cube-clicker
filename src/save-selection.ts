export interface ComparableGameSave {
  totalCubesEver?: number
  totalClicks?: number
  rebirthCount?: number
  playerLevel?: number
  lastSaveTime?: number
  buildings?: Array<{ count?: number }>
  clickUpgrades?: Array<{ level?: number }>
  rebirthUpgrades?: Array<{ level?: number }>
}

function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function sumField(items: Array<Record<string, unknown>> | undefined, field: string) {
  return items?.reduce((total, item) => total + safeNumber(item[field]), 0) ?? 0
}

function progressVector(save: ComparableGameSave) {
  return [
    safeNumber(save.totalCubesEver),
    safeNumber(save.totalClicks),
    safeNumber(save.rebirthCount),
    safeNumber(save.playerLevel),
    sumField(save.buildings, 'count'),
    sumField(save.clickUpgrades, 'level'),
    sumField(save.rebirthUpgrades, 'level'),
  ]
}

export function choosePreferredSave<T extends ComparableGameSave>(
  localSave: T | undefined,
  remoteSave: T | undefined,
): T | undefined {
  if (!localSave) return remoteSave
  if (!remoteSave) return localSave

  const localProgress = progressVector(localSave)
  const remoteProgress = progressVector(remoteSave)
  for (let index = 0; index < localProgress.length; index += 1) {
    if (localProgress[index] > remoteProgress[index]) return localSave
    if (remoteProgress[index] > localProgress[index]) return remoteSave
  }

  return safeNumber(remoteSave.lastSaveTime) >= safeNumber(localSave.lastSaveTime) ? remoteSave : localSave
}
