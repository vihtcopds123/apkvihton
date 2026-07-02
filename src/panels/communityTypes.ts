// Shared types for community-related panels

export type GroupItem = {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  cover_url: string | null
  owner_id: string
  members_count: number
  is_closed: boolean
  privacy_type: 'open' | 'closed' | 'private'
  wall_type: 'open' | 'restricted' | 'closed'
  hide_members: boolean
  hide_photos: boolean
  created_at: string
  username?: string | null
  num_id?: number
  is_18_plus?: boolean
}