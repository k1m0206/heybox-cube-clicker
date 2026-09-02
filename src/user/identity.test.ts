import { describe, expect, it } from 'vitest'
import { getPlayerDisplayName, isIdentityRevoked, toPlayerIdentity } from './identity'

describe('toPlayerIdentity', () => {
  it('uses the mini-program scoped id and accepts profile as optional', () => {
    expect(toPlayerIdentity({
      isHeyboxAppLoggedIn: true,
      authorization: { identity: 'granted', profile: 'not_requested' },
      userInfo: { app_user_id: 'au_current_app_only', profile: null },
    })).toEqual({ appUserId: 'au_current_app_only', nickname: '', avatar: '' })
    expect(getPlayerDisplayName({ appUserId: 'au_current_app_only', nickname: '', avatar: '' }))
      .toBe('au_current_app_only')
  })

  it('does not create an identity for a logged-out user', () => {
    expect(toPlayerIdentity({ isHeyboxAppLoggedIn: false, authorization: null, userInfo: null })).toBeNull()
    expect(isIdentityRevoked('denied')).toBe(true)
    expect(isIdentityRevoked('granted')).toBe(false)
  })
})
