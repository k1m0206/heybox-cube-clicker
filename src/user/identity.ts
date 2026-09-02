import type { MiniProgramUserInfoResult } from '@heybox/hb-sdk'

/** Current-mini-program identity only. Never treat appUserId as a platform user id. */
export interface PlayerIdentity {
  appUserId: string
  nickname: string
  avatar: string
}

export function toPlayerIdentity(result: MiniProgramUserInfoResult): PlayerIdentity | null {
  if (!result.isHeyboxAppLoggedIn || !result.userInfo?.app_user_id) return null

  const profile = result.userInfo.profile
  return {
    appUserId: result.userInfo.app_user_id,
    nickname: profile?.nickname?.trim() || '',
    avatar: profile?.avatar || '',
  }
}

export function getPlayerDisplayName(player: PlayerIdentity | null) {
  if (!player) return '游客玩家'
  if (player.nickname) return player.nickname
  return player.appUserId
}

export function isIdentityRevoked(identity: string) {
  return identity === 'denied' || identity === 'not_requested'
}
