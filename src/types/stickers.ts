export interface StickerPack {
  id: string
  name: string
  owner_id: string
  cover_url: string
  code: string
  created_at: string
}

export interface Sticker {
  id: string
  pack_id: string
  image_url: string
  emoji: string | null
  created_at: string
}

export interface UserStickerPack {
  user_id: string
  pack_id: string
  created_at: string
}
