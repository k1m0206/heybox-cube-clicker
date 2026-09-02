import { describe, expect, it } from 'vitest'
import { getEntryName, mergeCurrentEntryIntoRanking } from './level-leaderboard'

describe('mergeCurrentEntryIntoRanking', () => {
  it('adds a confirmed current player when the top-list snapshot omitted them', () => {
    const entry = (appUserId: string, rank: number) => ({
      appUserId, rank, ranked: true, score: 1, extra: {}, createdAt: 0, updatedAt: 0,
    })
    expect(mergeCurrentEntryIntoRanking([entry('first', 1), entry('third', 3)], entry('me', 2)))
      .toMatchObject([{ appUserId: 'first' }, { appUserId: 'me' }, { appUserId: 'third' }])
  })

  it('shows app_user_id when the host did not provide a nickname', () => {
    expect(getEntryName({
      appUserId: 'au_current_app_only', rank: 1, ranked: true, score: 10,
      extra: { nickname: '' }, createdAt: 0, updatedAt: 0,
    })).toBe('au_current_app_only')
  })
})
