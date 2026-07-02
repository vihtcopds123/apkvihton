import { create } from 'zustand'
import { supabase } from '../supabaseClient'
import type { User } from '@supabase/supabase-js'

function getReadableAuthError(err: unknown): string {
  const fallback = 'Произошла ошибка. Попробуйте ещё раз.'

  if (!err || typeof err !== 'object') {
    return fallback
  }

  const error = err as { message?: string; code?: string; status?: number }
  const message = (error.message || '').toLowerCase()
  const code = error.code || ''

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Подтвердите электронную почту перед входом в аккаунт.'
  }

  if (message.includes('invalid login credentials')) {
    return 'Неверная почта или пароль.'
  }

  if (message.includes('user already registered')) {
    return 'Аккаунт с такой почтой уже существует.'
  }

  if (message.includes('password should be at least') || message.includes('password is too short')) {
    return 'Пароль слишком короткий. Используйте не менее 6 символов.'
  }

  if (message.includes('unable to validate email address') || message.includes('invalid email')) {
    return 'Введите корректный адрес электронной почты.'
  }

  if (message.includes('signup is disabled')) {
    return 'Регистрация сейчас недоступна.'
  }

  if (message.includes('email rate limit exceeded') || message.includes('security purposes')) {
    return 'Слишком много попыток. Подождите немного и попробуйте снова.'
  }

  if (message.includes('user not found')) {
    return 'Аккаунт с такой почтой не найден.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте снова.'
  }

  if (message.includes('duplicate key value') || message.includes('profiles_username_key')) {
    return 'Это имя пользователя уже занято.'
  }

  if (message.includes('jwt') || message.includes('session')) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  return error.message || fallback
}

export interface Profile {
  id: string
  vk_id: string | null
  username: string | null
  num_id?: number | null
  full_name: string | null
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  status?: string | null
  emoji_status?: string | null
  avatar_decoration?: string | null
  profile_decoration?: string | null
  city: string | null
  birth_date: string | null
  is_online: boolean
  status_preference?: string | null
  last_seen: string
  created_at: string
  role?: string | null
  roles?: string[] | null
  allow_wall_posts?: boolean | null
  listening_to?: any | null
  hide_music?: boolean | null
  balance?: number | null
}

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  checkingSession: boolean
  error: string | null
  emailToVerify: string | null
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>
  checkSession: () => Promise<void>
  clearError: () => void
  verifyOtpCode: (code: string) => Promise<boolean>
  resendOtpCode: () => Promise<boolean>
  cancelVerification: () => void
  resetPassword: (email: string) => Promise<boolean>
  isResettingPassword: boolean
  setResettingPassword: (val: boolean) => void
  updatePassword: (password: string) => Promise<boolean>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  checkingSession: true,
  error: null,
  emailToVerify: null,
  isResettingPassword: false,
  setResettingPassword: (val) => set({ isResettingPassword: val }),

  clearError: () => set({ error: null }),

  checkSession: async () => {
    set({ checkingSession: true })

    // Safety timeout: if auth hangs > 8s, force-unblock the app
    const timeoutId = setTimeout(() => {
      if (get().checkingSession) {
        console.warn('checkSession timed out, forcing unblock')
        set({ checkingSession: false })
      }
    }, 8000)

    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error

      if (session?.user) {
        const currentUser = get().user
        // Avoid unnecessary user update if same session
        if (!currentUser || currentUser.id !== session.user.id) {
          set({ user: session.user, emailToVerify: null })
        }
        
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError)
        } else if (profileData) {
          const isOnlinePreference = profileData.status_preference !== 'offline'
          const currentProfile = get().profile
          // Only update profile state if something actually changed
          if (
            !currentProfile ||
            currentProfile.id !== profileData.id ||
            currentProfile.avatar_url !== profileData.avatar_url ||
            currentProfile.cover_url !== profileData.cover_url ||
            currentProfile.full_name !== profileData.full_name ||
            currentProfile.bio !== profileData.bio ||
            currentProfile.status !== profileData.status ||
            currentProfile.role !== profileData.role
          ) {
            set({ profile: { ...profileData, is_online: isOnlinePreference } })
          }
          // Don't await — 503 here must not break auth
          ;(async () => {
            try {
              await supabase.from('profiles')
                .update({ is_online: isOnlinePreference, last_seen: new Date().toISOString() })
                .eq('id', session.user.id)
            } catch {}
          })()
          // Ensure system bot conversation exists for this user
          ;(async () => {
            try {
              const SYSTEM_BOT_ID = '00000000-0000-0000-0000-000000000000'
              const userId = session.user.id
              const { data: existing } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(participant_1.eq.${SYSTEM_BOT_ID},participant_2.eq.${userId}),and(participant_1.eq.${userId},participant_2.eq.${SYSTEM_BOT_ID})`)
                .maybeSingle()
              if (!existing) {
                await supabase.from('conversations').insert({
                  participant_1: SYSTEM_BOT_ID,
                  participant_2: userId
                })
              }
            } catch {}
          })()
        }
      } else {
        set({ user: null, profile: null })
      }
    } catch (err: any) {
      console.error('Check session error:', err)
      set({ user: null, profile: null, error: getReadableAuthError(err) })
      supabase.auth.signOut().catch(() => {})
    } finally {
      clearTimeout(timeoutId)
      set({ checkingSession: false })
    }
  },

  signUp: async (email, password, username, fullName) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
          }
        }
      })
      if (error) throw error

      if (data?.user) {
        // If email confirmation is enabled, session will be null
        if (!data.session) {
          set({ emailToVerify: email })
          return true
        }

        set({ user: data.user })
        
        // Fetch the newly created profile (poll a few times if database trigger is slightly delayed)
        let profileData = null
        for (let i = 0; i < 5; i++) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
          if (p) {
            profileData = p
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        if (profileData) {
          const isOnlinePreference = profileData.status_preference !== 'offline'
          set({ profile: { ...profileData, is_online: isOnlinePreference } })
          await supabase.from('profiles').update({ is_online: isOnlinePreference, last_seen: new Date().toISOString() }).eq('id', data.user.id)
        }
        return true
      }
      return false
    } catch (err: any) {
      set({ error: getReadableAuthError(err) })
      return false
    } finally {
      set({ loading: false })
    }
  },

  verifyOtpCode: async (code) => {
    const { emailToVerify } = get()
    if (!emailToVerify) return false

    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailToVerify,
        token: code,
        type: 'signup'
      })
      if (error) throw error

      if (data?.user) {
        set({ user: data.user, emailToVerify: null })
        
        // Poll for profile creation
        let profileData = null
        for (let i = 0; i < 5; i++) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
          if (p) {
            profileData = p
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        if (profileData) {
          const isOnlinePreference = profileData.status_preference !== 'offline'
          set({ profile: { ...profileData, is_online: isOnlinePreference } })
          await supabase.from('profiles').update({ is_online: isOnlinePreference, last_seen: new Date().toISOString() }).eq('id', data.user.id)
        }
        return true
      }
      return false
    } catch (err: any) {
      set({ error: getReadableAuthError(err) })
      return false
    } finally {
      set({ loading: false })
    }
  },

  resendOtpCode: async () => {
    const { emailToVerify } = get()
    if (!emailToVerify) return false

    set({ loading: true, error: null })
    try {
      const { error } = await supabase.auth.resend({
        email: emailToVerify,
        type: 'signup'
      })
      if (error) throw error
      return true
    } catch (err: any) {
      set({ error: getReadableAuthError(err) })
      return false
    } finally {
      set({ loading: false })
    }
  },

  cancelVerification: () => {
    set({ emailToVerify: null, error: null })
  },

  resetPassword: async (email: string) => {
    set({ loading: true, error: null })
    try {
      const redirectTo = window.location.hostname === 'localhost'
        ? `${window.location.origin}/`
        : 'https://vihtclub.ru/';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (error) throw error
      return true
    } catch (err: any) {
      set({ error: getReadableAuthError(err) })
      return false
    } finally {
      set({ loading: false })
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      if (data?.user) {
        set({ user: data.user })
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()
        
        if (profileData) {
          const isOnlinePreference = profileData.status_preference !== 'offline'
          set({ profile: { ...profileData, is_online: isOnlinePreference } })
          await supabase.from('profiles').update({ is_online: isOnlinePreference, last_seen: new Date().toISOString() }).eq('id', data.user.id)
        }
        return true
      }
      return false
    } catch (err: any) {
      set({ error: getReadableAuthError(err) })
      return false
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    const { user } = get()
    if (user) {
      // Set offline before logging out
      await supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', user.id)
    }
    await supabase.auth.signOut()
    set({ user: null, profile: null, error: null })
  },

  updateProfile: async (updates) => {
    const { user, profile } = get()
    if (!user || !profile) return false
    
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()
      
      if (error) throw error
      if (data) {
        set({ profile: data })
        return true
      }
      return false
    } catch (err: any) {
      set({ error: getReadableAuthError(err) })
      return false
    } finally {
      set({ loading: false })
    }
  },

  updatePassword: async (password: string) => {
    set({ loading: true, error: null })
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      set({ isResettingPassword: false })
      return true
    } catch (err: any) {
      set({ error: getReadableAuthError(err) })
      return false
    } finally {
      set({ loading: false })
    }
  }
}))
