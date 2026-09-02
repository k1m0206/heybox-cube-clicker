import type { LeaderboardEntry, MiniProgramCloudLeaderboardModule } from '@heybox/hb-sdk'
import type { PlayerIdentity } from '../user/identity'

export const LEVEL_LEADERBOARD_KEY = 'cube_clicker_level'
export const LEVEL_LEADERBOARD_LIMIT = 100

export function getEntryLevel(entry: LeaderboardEntry) {
  const level = Number(entry.extra.level ?? entry.score)
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1
}

export function getEntryName(entry: LeaderboardEntry) {
  const nickname = entry.extra.nickname
  return typeof nickname === 'string' && nickname.trim() ? nickname.trim() : entry.appUserId
}

export function getEntryAvatar(entry: LeaderboardEntry) {
  return typeof entry.extra.avatar === 'string' ? entry.extra.avatar : ''
}

export async function syncLevel(
  leaderboard: MiniProgramCloudLeaderboardModule,
  player: PlayerIdentity,
  localLevel: number,
) {
  let entry = await leaderboard.getCurrentUserEntry({ key: LEVEL_LEADERBOARD_KEY })
  const cloudLevel = entry ? getEntryLevel(entry) : 0
  const level = Math.max(localLevel, cloudLevel)

  if (!entry || cloudLevel < level) {
    entry = await leaderboard.submit({
      key: LEVEL_LEADERBOARD_KEY,
      score: level,
      extra: { level, nickname: player.nickname, avatar: player.avatar },
    })
  }
  return { level, entry }
}

export function loadLevelRanking(leaderboard: MiniProgramCloudLeaderboardModule) {
  return leaderboard.getList({ key: LEVEL_LEADERBOARD_KEY, limit: LEVEL_LEADERBOARD_LIMIT })
}

/** Some leaderboard list snapshots can lag current-user rank calculation. Keep a
 * confirmed top-100 current entry visible instead of relying on list timing. */
export function mergeCurrentEntryIntoRanking(
  entries: LeaderboardEntry[],
  currentEntry: LeaderboardEntry | undefined,
) {
  if (!currentEntry || !currentEntry.ranked || currentEntry.rank < 1 || currentEntry.rank > LEVEL_LEADERBOARD_LIMIT) {
    return entries
  }
  if (entries.some(entry => entry.appUserId === currentEntry.appUserId)) return entries
  return [...entries, currentEntry].sort((first, second) => first.rank - second.rank)
}
