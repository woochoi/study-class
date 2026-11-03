export type User = {
  id: string
  provider: 'google'
  providerUserId: string
  email: string | null
  displayName: string
  avatarUrl: string | null
}
