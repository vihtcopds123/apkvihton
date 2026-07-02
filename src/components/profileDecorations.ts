export interface ProfileDecoration {
  id: string
  name: string
  url: string
}

export const PROFILE_DECORATIONS: ProfileDecoration[] = [
  { id: 'vortex', name: 'Космический вихрь', url: '/profile_effects/vortex.png' },
  { id: 'mastery', name: 'Магический круг', url: '/profile_effects/mastery.png' },
  { id: 'rock_slide', name: 'Камнепад', url: '/profile_effects/rock_slide.png' },
  { id: 'space_evader', name: 'Ретро-космос', url: '/profile_effects/space_evader.png' }
]
