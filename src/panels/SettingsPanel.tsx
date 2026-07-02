import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StickersSettingsTab } from '../components/StickersSettingsTab'
import {
  Panel,
  Input,
  Textarea,
  Button,
  Switch,
  Snackbar,
  Spinner,
  Text,
  IconButton
} from '@vkontakte/vkui'
import {
  Icon28CheckCircleOutline,
  Icon28CancelOutline,
  Icon28UserOutline,
  Icon28MessageOutline,
  Icon28UsersOutline,
  Icon28NewsfeedOutline,
  Icon28BookmarkOutline,
  Icon24ChevronUp,
  Icon24ChevronDown,
  Icon20CheckCircleOutline,
  Icon20CancelCircleOutline
} from '@vkontakte/icons'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { supabase } from '../supabaseClient'
import { CustomAvatar } from '../components/CustomAvatar'
import { AVATAR_DECORATIONS } from '../components/decorations'
import { PROFILE_DECORATIONS } from '../components/profileDecorations'

interface SettingsPanelProps {
  id: string
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ id }) => {
  const queryClient = useQueryClient()
  const { user, profile, updateProfile, signOut } = useAuthStore()
  const { theme, toggleTheme, setStory, menuItems, setMenuItems, selectProfile } = useAppStore()

  const handleMoveMenu = (index: number, direction: 'up' | 'down') => {
    if (!profile) return
    const newItems = [...menuItems]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return
    
    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp
    
    setMenuItems(newItems, profile.id)
  }

  const handleToggleMenuVisibility = (index: number, checked: boolean) => {
    if (!profile) return
    const newItems = [...menuItems]
    newItems[index] = { ...newItems[index], visible: checked }
    
    const visibleCount = newItems.filter(item => item.visible).length
    if (visibleCount === 0) return // Enforce at least one visible item
    
    setMenuItems(newItems, profile.id)
  }

  const getMenuItemIcon = (story: string) => {
    switch (story) {
      case 'profile': return <Icon28UserOutline />
      case 'messages': return <Icon28MessageOutline />
      case 'friends': return <Icon28UsersOutline />
      case 'groups': return <Icon28UsersOutline />
      case 'feed': return <Icon28NewsfeedOutline />
      case 'bookmarks': return <Icon28BookmarkOutline />
      default: return null
    }
  }

  // Profile fields state
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | 'invalid' | 'checking' | null>(null)
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Privacy state
  const [isInvisible, setIsInvisible] = useState(false)
  const [allowWallPosts, setAllowWallPosts] = useState(true)
  const [hideMusic, setHideMusic] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [savingWallPrivacy, setSavingWallPrivacy] = useState(false)
  const [savingMusicPrivacy, setSavingMusicPrivacy] = useState(false)

  // Security state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Notifications/Toasts
  const [snackbar, setSnackbar] = useState<React.ReactNode | null>(null)

  // Layout tabs & customization states
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'security' | 'decorations' | 'profile_decorations' | 'stickers'>('general')
  const [selectedDecoCategory, setSelectedDecoCategory] = useState<'all' | 'anime' | 'magic' | 'cozy' | 'cyberpunk'>('all')
  const [showMenuConfig, setShowMenuConfig] = useState(false)
  const [tempDecoration, setTempDecoration] = useState<string | null>(null)
  const [tempProfileDecoration, setTempProfileDecoration] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setTempDecoration(profile.avatar_decoration || null)
      setTempProfileDecoration(profile.profile_decoration || null)
    }
  }, [profile])

  const handleUpdateProfileDecoration = async (decoId: string | null) => {
    if (!profile) return
    setTempProfileDecoration(decoId)
    try {
      const success = await updateProfile({ profile_decoration: decoId })
      if (success) {
        showToast('Эффект профиля успешно обновлен!')
        queryClient.invalidateQueries({ queryKey: ['profile', profile.id] })
      } else {
        showToast('Не удалось обновить эффект профиля.', true)
        setTempProfileDecoration(profile.profile_decoration || null)
      }
    } catch (err) {
      console.error('Error updating profile decoration:', err)
      showToast('Произошла ошибка при сохранении эффекта профиля.', true)
      setTempProfileDecoration(profile.profile_decoration || null)
    }
  }

  // Check username availability automatically
  useEffect(() => {
    const cleanUsername = username.trim().toLowerCase()
    
    if (profile && cleanUsername === profile.username) {
      setUsernameStatus('available')
      return
    }

    if (!cleanUsername) {
      setUsernameStatus(null)
      return
    }

    const tagRegex = /^[a-z0-9_-]{3,30}$/
    if (!tagRegex.test(cleanUsername)) {
      setUsernameStatus('invalid')
      return
    }

    const reservedPaths = ['feed', 'profile', 'friends', 'chat', 'groups', 'notifications', 'settings', 'bookmarks', 'about', 'login', 'auth', 'im', 'news', 'support']
    if (reservedPaths.includes(cleanUsername)) {
      setUsernameStatus('taken')
      return
    }

    setUsernameStatus('checking')

    const timer = setTimeout(async () => {
      try {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle()

        if (checkError) throw checkError

        if (existingUser && existingUser.id !== profile?.id) {
          setUsernameStatus('taken')
        } else {
          setUsernameStatus('available')
        }
      } catch (err) {
        console.error('Error checking username availability:', err)
        setUsernameStatus(null)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [username, profile])

  // Initialize fields on load
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setUsername(profile.username || '')
      setBio(profile.bio || '')
      setCity(profile.city || '')
      setBirthDate(profile.birth_date || '')
      setIsInvisible(profile.status_preference === 'offline')
      setAllowWallPosts(profile.allow_wall_posts !== false)
      setHideMusic(profile.hide_music === true)
    }
  }, [profile])

  const showToast = (message: string, isError = false) => {
    setSnackbar(
      <Snackbar
        onClose={() => setSnackbar(null)}
        onClosed={() => {}}
        before={
          isError ? (
            <Icon28CancelOutline fill="var(--vkui--color_text_negative)" />
          ) : (
            <Icon28CheckCircleOutline fill="#4bb34b" />
          )
        }
      >
        {message}
      </Snackbar>
    )
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    if (birthDate) {
      const birthYear = new Date(birthDate).getFullYear()
      const today = new Date()
      const chosenDate = new Date(birthDate)
      if (birthYear < 1980 || chosenDate > today) {
        showToast('Дата рождения должна быть в диапазоне от 1980 года до сегодняшнего дня.', true)
        return
      }
    }
    setSavingProfile(true)
    try {
      // Validate username format (only alphanumeric, max 7 chars, no spaces)
      const cleanUsername = username.trim().toLowerCase()
      if (!cleanUsername) {
        showToast('Поле "Тег" не может быть пустым!', true)
        setSavingProfile(false)
        return
      }

      const tagRegex = /^[a-z0-9_-]{3,30}$/
      if (!tagRegex.test(cleanUsername)) {
        showToast('Тег может состоять только из английских букв, цифр, дефисов и подчеркиваний, и быть длиной от 3 до 30 символов!', true)
        setSavingProfile(false)
        return
      }

      // Check if username is taken (if changed)
      if (cleanUsername !== profile.username) {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle()

        if (checkError) throw checkError
        if (existingUser) {
          showToast('Этот тег уже занят.', true)
          setSavingProfile(false)
          return
        }
      }

      const success = await updateProfile({
        full_name: fullName.trim(),
        username: cleanUsername || null,
        bio: bio.trim(),
        city: city.trim(),
        birth_date: birthDate || null
      })

      if (success) {
        showToast('Профиль успешно обновлен!')
      } else {
        showToast('Не удалось обновить профиль.', true)
      }
    } catch (err: any) {
      console.error('Error saving settings profile:', err)
      showToast(err.message || 'Произошла ошибка при сохранении.', true)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleTogglePrivacy = async (checked: boolean) => {
    if (!profile) return
    setIsInvisible(checked)
    setSavingPrivacy(true)
    try {
      const pref = checked ? 'offline' : 'online'
      const success = await updateProfile({
        status_preference: pref,
        is_online: !checked
      })

      if (success) {
        showToast(checked ? 'Режим невидимки включен (вы оффлайн).' : 'Режим невидимки отключен.')
      } else {
        showToast('Не удалось обновить настройки приватности.', true)
        setIsInvisible(!checked) // revert UI
      }
    } catch (err) {
      console.error('Error toggling privacy:', err)
      showToast('Произошла ошибка при изменении настроек приватности.', true)
      setIsInvisible(!checked) // revert UI
    } finally {
      setSavingPrivacy(false)
    }
  }

  const handleToggleWallPrivacy = async (checked: boolean) => {
    if (!profile) return
    setAllowWallPosts(checked)
    setSavingWallPrivacy(true)
    try {
      const success = await updateProfile({
        allow_wall_posts: checked
      })

      if (success) {
        showToast(checked ? 'Другие пользователи теперь могут оставлять записи на вашей стене.' : 'Записи на вашей стене теперь можете оставлять только вы.')
      } else {
        showToast('Не удалось обновить настройки стены.', true)
        setAllowWallPosts(!checked) // revert UI
      }
    } catch (err) {
      console.error('Error toggling wall privacy:', err)
      showToast('Произошла ошибка при изменении настроек стены.', true)
      setAllowWallPosts(!checked) // revert UI
    } finally {
      setSavingWallPrivacy(false)
    }
  }

  const handleToggleMusicPrivacy = async (checked: boolean) => {
    if (!profile) return
    setHideMusic(checked)
    setSavingMusicPrivacy(true)
    try {
      const success = await updateProfile({
        hide_music: checked
      })

      if (success) {
        showToast(checked ? 'Ваш музыкальный блок теперь скрыт от других пользователей.' : 'Ваша музыка теперь видна другим пользователям.')
      } else {
        showToast('Не удалось обновить настройки музыки.', true)
        setHideMusic(!checked) // revert UI
      }
    } catch (err) {
      console.error('Error toggling music privacy:', err)
      showToast('Произошла ошибка при изменении настроек музыки.', true)
      setHideMusic(!checked) // revert UI
    } finally {
      setSavingMusicPrivacy(false)
    }
  }

  const handleChangePassword = async () => {
    if (password.length < 6) {
      showToast('Пароль должен состоять минимум из 6 символов.', true)
      return
    }
    if (password !== confirmPassword) {
      showToast('Пароли не совпадают.', true)
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      showToast('Пароль успешно изменен!')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      console.error('Error changing password:', err)
      showToast(err.message || 'Не удалось изменить пароль.', true)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      setStory('feed')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const handleUpdateDecoration = async (decoUrl: string | null) => {
    if (!profile) return
    setTempDecoration(decoUrl)
    try {
      await updateProfile({ avatar_decoration: decoUrl })
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] })
      queryClient.invalidateQueries({ queryKey: ['profile-posts', profile.id] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { title: 'Декорация', text: decoUrl ? 'Декорация успешно установлена!' : 'Декорация удалена!' }
      }))
    } catch (err: any) {
      console.error('Error updating decoration:', err)
      alert('Не удалось обновить декорацию: ' + err.message)
      setTempDecoration(profile.avatar_decoration || null)
    }
  }

  return (
    <Panel id={id}>
      <div className="settings-custom-header">
        <button 
          onClick={() => { selectProfile(profile?.id || null); setStory('profile'); }}
          className="settings-back-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span className="settings-header-title">Настройки профиля</span>
      </div>

      <div className="settings-layout">
        {/* Left Main Column */}
        <div className="settings-main-col">
          {/* Mobile Tabs Header */}
          <div className="settings-mobile-tabs">
            <button 
              className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              Общее
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              Приватность
            </button>
             <button 
              className={`settings-tab-btn ${activeTab === 'decorations' ? 'active' : ''}`}
              onClick={() => setActiveTab('decorations')}
            >
              Аватарка
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'profile_decorations' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile_decorations')}
            >
              Профиль
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Безопасность
            </button>
            <button 
              className={`settings-tab-btn ${activeTab === 'stickers' ? 'active' : ''}`}
              onClick={() => setActiveTab('stickers')}
            >
              Стикеры
            </button>
          </div>

          {activeTab === 'general' && (
            <div className="settings-tab-content-animated">
              {/* Profile Card Summary */}
              {profile && (
                <div className="posts-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', textAlign: 'center' }}>
                  <CustomAvatar 
                    size={72} 
                    src={profile.avatar_url} 
                    name={profile.full_name} 
                    id={profile.id}
                    decoration={profile.avatar_decoration}
                  />
                  <Text weight="2" style={{ fontSize: 18, marginTop: 12, color: 'var(--vkui--color_text_primary)' }}>
                    {profile.full_name}
                  </Text>
                  {profile.username && (
                    <Text style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginTop: 4 }}>
                      @{profile.username}
                    </Text>
                  )}
                </div>
              )}

              {/* 1. Личная информация */}
              <div className="posts-card" style={{ paddingBottom: 8 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', marginBottom: 4 }}>
                  <Text weight="2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Личная информация
                  </Text>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
                  <div className="settings-row">
                    <span className="settings-row-label">Имя и Фамилия</span>
                    <div className="settings-row-content">
                      <Input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ваше имя"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="settings-row">
                    <span className="settings-row-label">Электронная почта</span>
                    <div className="settings-row-content">
                      <Input
                        type="text"
                        value={user?.email || ''}
                        disabled
                        style={{ width: '100%', opacity: 0.75, cursor: 'not-allowed' }}
                      />
                    </div>
                  </div>

                  <div className="settings-row">
                    <span className="settings-row-label">Тег</span>
                    <div className="settings-row-content" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30))}
                        placeholder="Придумайте тег"
                        style={{ width: '100%' }}
                        after={
                          usernameStatus === 'checking' ? (
                            <Spinner size="s" style={{ marginRight: 8 }} />
                          ) : usernameStatus === 'available' ? (
                            <Icon20CheckCircleOutline fill="#4bb34b" style={{ marginRight: 8 }} />
                          ) : usernameStatus === 'taken' ? (
                            <Icon20CancelCircleOutline fill="var(--vkui--color_text_negative)" style={{ marginRight: 8 }} />
                          ) : usernameStatus === 'invalid' ? (
                            <Icon20CancelCircleOutline fill="var(--vkui--color_text_negative)" style={{ marginRight: 8 }} title="Минимум 3 символа, латинские буквы, цифры, дефис и подчеркивание" />
                          ) : null
                        }
                      />
                      {usernameStatus === 'taken' && (
                        <div style={{ fontSize: 12, color: 'var(--vkui--color_text_negative)', marginTop: -2, paddingLeft: 4 }}>
                          Этот тег уже занят
                        </div>
                      )}
                      {usernameStatus === 'invalid' && username.trim().length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--vkui--color_text_negative)', marginTop: -2, paddingLeft: 4 }}>
                          От 3 до 30 символов (латиница, цифры, _ или -)
                        </div>
                      )}
                      {usernameStatus === 'available' && username.trim().toLowerCase() !== profile?.username && (
                        <div style={{ fontSize: 12, color: '#4bb34b', marginTop: -2, paddingLeft: 4 }}>
                          Тег свободен
                        </div>
                      )}
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>
                          Ваш ID страницы: <span style={{ fontWeight: 600, color: '#007aff' }}>{profile?.num_id || ''}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          <Button 
                            size="s" 
                            mode="secondary"
                            onClick={(e) => {
                              e.preventDefault()
                              navigator.clipboard.writeText(String(profile?.num_id || '')).then(() => {
                                showToast('ID страницы скопирован!')
                              })
                            }}
                          >
                            Копировать ID
                          </Button>
                          <Button 
                            size="s" 
                            mode="secondary"
                            onClick={(e) => {
                              e.preventDefault()
                              const link = `vihtclub.ru/${username || 'id' + (profile?.num_id || '')}`
                              navigator.clipboard.writeText(link).then(() => {
                                showToast('Ссылка на страницу скопирована!')
                              })
                            }}
                          >
                            Копировать ссылку
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="settings-row">
                    <span className="settings-row-label">Город</span>
                    <div className="settings-row-content">
                      <Input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Укажите ваш город"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="settings-row">
                    <span className="settings-row-label">Дата рождения</span>
                    <div className="settings-row-content">
                      <Input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        min="1980-01-01"
                        max={new Date().toISOString().split('T')[0]}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="settings-row">
                    <span className="settings-row-label">О себе</span>
                    <div className="settings-row-content">
                      <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Расскажите о себе"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-start' }}>
                    <Button
                      size="m"
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      loading={savingProfile}
                    >
                      Сохранить профиль
                    </Button>
                  </div>
                </form>
              </div>

              {/* 2. Настройки интерфейса & меню */}
              <div className="posts-card" style={{ paddingBottom: 8 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', marginBottom: 4 }}>
                  <Text weight="2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Настройки интерфейса
                  </Text>
                </div>

                <div className="settings-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                  <span className="settings-row-label" style={{ width: 'auto', marginBottom: 0, flex: 1 }}>Ночная тема</span>
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Switch
                      checked={theme === 'dark'}
                      onChange={() => toggleTheme()}
                    />
                  </div>
                </div>

                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span className="settings-row-label" style={{ width: 'auto' }}>Меню сайта</span>
                    <button 
                      onClick={() => setShowMenuConfig(!showMenuConfig)}
                      style={{ border: 'none', background: 'transparent', color: '#0077ff', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, textAlign: 'right' }}
                    >
                      {showMenuConfig ? 'Скрыть настройки' : 'Настроить отображение пунктов меню'}
                    </button>
                  </div>
                  
                  {showMenuConfig && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {menuItems.map((item, index) => {
                        const isFirst = index === 0
                        const isLast = index === menuItems.length - 1
                        const visibleCount = menuItems.filter(i => i.visible).length
                        const canToggleOff = item.visible && visibleCount > 1
                        
                        return (
                          <div 
                            key={item.story}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: 'var(--vkui--color_background_secondary_alpha, rgba(0,0,0,0.02))',
                              border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ color: 'var(--vkui--color_icon_secondary)', display: 'flex', alignItems: 'center', transform: 'scale(0.85)' }}>
                                {getMenuItemIcon(item.story)}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>
                                {item.label}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ display: 'flex', gap: 2 }}>
                                <IconButton 
                                  onClick={() => handleMoveMenu(index, 'up')}
                                  disabled={isFirst}
                                  style={{ color: isFirst ? 'var(--vkui--color_icon_tertiary)' : 'var(--vkui--color_icon_secondary)', padding: 4 }}
                                  aria-label="Переместить вверх"
                                >
                                  <Icon24ChevronUp width={18} height={18} />
                                </IconButton>
                                <IconButton 
                                  onClick={() => handleMoveMenu(index, 'down')}
                                  disabled={isLast}
                                  style={{ color: isLast ? 'var(--vkui--color_icon_tertiary)' : 'var(--vkui--color_icon_secondary)', padding: 4 }}
                                  aria-label="Переместить вниз"
                                >
                                  <Icon24ChevronDown width={18} height={18} />
                                </IconButton>
                              </div>
                              
                              <Switch
                                checked={item.visible}
                                disabled={item.visible && !canToggleOff}
                                onChange={(e) => handleToggleMenuVisibility(index, e.target.checked)}
                                aria-label={`Показать/скрыть ${item.label}`}
                                style={{ transform: 'scale(0.85)' }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="settings-tab-content-animated">
              <div className="posts-card" style={{ paddingBottom: 8 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', marginBottom: 4 }}>
                <Text weight="2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Приватность
                </Text>
              </div>
              <div className="settings-row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, paddingRight: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>Режим невидимки</span>
                  <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Скрывать время последнего посещения и ваш статус онлайн</span>
                </div>
                <div className="settings-row-content" style={{ flex: 'none' }}>
                  {savingPrivacy ? (
                    <Spinner size="s" />
                  ) : (
                    <Switch
                      checked={isInvisible}
                      onChange={(e) => handleTogglePrivacy(e.target.checked)}
                    />
                  )}
                </div>
              </div>
              <div className="settings-row" style={{ borderTop: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', paddingTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, paddingRight: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>Разрешить публикации на стене</span>
                  <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Разрешить другим пользователям публиковать записи на вашей стене</span>
                </div>
                <div className="settings-row-content" style={{ flex: 'none' }}>
                  {savingWallPrivacy ? (
                    <Spinner size="s" />
                  ) : (
                    <Switch
                      checked={allowWallPosts}
                      onChange={(e) => handleToggleWallPrivacy(e.target.checked)}
                    />
                  )}
                </div>
              </div>

              <div className="settings-row" style={{ borderTop: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', paddingTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, paddingRight: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--vkui--color_text_primary)' }}>Скрыть песни</span>
                  <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Скрыть блок «Музыка пользователя» на вашей странице от других</span>
                </div>
                <div className="settings-row-content" style={{ flex: 'none' }}>
                  {savingMusicPrivacy ? (
                    <Spinner size="s" />
                  ) : (
                    <Switch
                      checked={hideMusic}
                      onChange={(e) => handleToggleMusicPrivacy(e.target.checked)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-tab-content-animated">
              <div className="posts-card" style={{ paddingBottom: 16 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', marginBottom: 4 }}>
                <Text weight="2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Безопасность
                </Text>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}>
                <div className="settings-row">
                  <span className="settings-row-label">Новый пароль</span>
                  <div className="settings-row-content">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div className="settings-row">
                  <span className="settings-row-label">Подтверждение</span>
                  <div className="settings-row-content">
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите новый пароль"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ padding: '16px 16px 0 16px', display: 'flex', justifyContent: 'flex-start' }}>
                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    loading={changingPassword}
                    size="m"
                    mode="secondary"
                  >
                    Изменить пароль
                  </Button>
                </div>
              </form>
            </div>
            </div>
          )}

          {activeTab === 'stickers' && profile && (
            <StickersSettingsTab profileId={profile.id} showToast={showToast} />
          )}

          {activeTab === 'decorations' && (
            <div className="settings-tab-content-animated">
              <div className="posts-card" style={{ paddingBottom: 24 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', marginBottom: 16 }}>
                <Text weight="2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Украшение аватарки
                </Text>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0', gap: 12 }}>
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <CustomAvatar 
                    size={120} 
                    src={profile?.avatar_url} 
                    name={profile?.full_name} 
                    id={profile?.id}
                  />
                  {tempDecoration && (
                    <img 
                      src={tempDecoration} 
                      alt="" 
                      style={{
                        position: 'absolute',
                        top: -12,
                        left: -12,
                        width: 144,
                        height: 144,
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Text weight="2" style={{ fontSize: 16, color: 'var(--vkui--color_text_primary)' }}>
                    {profile?.full_name}
                  </Text>
                  <Text style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginTop: 4 }}>
                    Так ваша аватарка выглядит сейчас
                  </Text>
                </div>
              </div>

              <div style={{ padding: '0 16px' }}>
                {/* Категории украшений */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, scrollbarWidth: 'none' }}>
                  {[
                    { id: 'all', name: 'Все' },
                    { id: 'anime', name: 'Аниме' },
                    { id: 'magic', name: 'Стихии & Магия' },
                    { id: 'cozy', name: 'Уют & Lofi' },
                    { id: 'cyberpunk', name: 'Киберпанк' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedDecoCategory(cat.id as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: 'none',
                        background: selectedDecoCategory === cat.id ? 'var(--vkui--color_background_accent)' : 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        transition: 'background 0.2s'
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <Text style={{ fontSize: 14, fontWeight: 600, color: 'var(--vkui--color_text_primary)', marginBottom: 12 }}>
                  Выберите рамку из коллекции Discord:
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 16 }}>
                  {selectedDecoCategory === 'all' && (
                    <div
                      onClick={() => handleUpdateDecoration(null)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: 12,
                        borderRadius: 16,
                        cursor: 'pointer',
                        border: !profile?.avatar_decoration ? '2px solid #0077ff' : '2px solid transparent',
                        background: 'rgba(255,255,255,0.03)',
                        transition: 'transform 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }}>✕</span>
                      </div>
                      <span style={{ fontSize: 11, marginTop: 8, color: 'var(--vkui--color_text_secondary)', textAlign: 'center', fontWeight: 500 }}>
                        Без рамки
                      </span>
                    </div>
                  )}

                  {AVATAR_DECORATIONS
                    .filter(deco => selectedDecoCategory === 'all' || deco.category === selectedDecoCategory)
                    .map((deco) => {
                      const selected = profile?.avatar_decoration === deco.url
                      return (
                        <div
                          key={deco.id}
                          onClick={() => handleUpdateDecoration(deco.url)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 16,
                            cursor: 'pointer',
                            border: selected ? '2px solid #0077ff' : '2px solid transparent',
                            background: selected ? 'rgba(0, 119, 255, 0.08)' : 'rgba(255,255,255,0.03)',
                            transition: 'transform 0.2s',
                            position: 'relative'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <div style={{ position: 'relative', width: 64, height: 64 }}>
                            <CustomAvatar 
                              size={64} 
                              src={profile?.avatar_url} 
                              name={profile?.full_name} 
                              id={profile?.id}
                            />
                            <img 
                              src={deco.url} 
                              alt="" 
                              style={{
                                position: 'absolute',
                                top: -6,
                                left: -6,
                                width: 76,
                                height: 76,
                                pointerEvents: 'none'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, marginTop: 8, color: 'var(--vkui--color_text_primary)', textAlign: 'center', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                            {deco.name}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
              </div>
            </div>
          )}

          {activeTab === 'profile_decorations' && (
            <div className="settings-tab-content-animated">
              <div className="posts-card" style={{ paddingBottom: 24 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', marginBottom: 16 }}>
                  <Text weight="2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Украшение профиля
                  </Text>
                </div>

                {/* Preview Section */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0', gap: 12 }}>
                  <div style={{ 
                    position: 'relative', 
                    width: '100%', 
                    maxWidth: 400, 
                    height: 160, 
                    borderRadius: 16, 
                    overflow: 'hidden',
                    background: 'var(--vkui--color_background_secondary, #19191a)',
                    border: '1.5px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.06))',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {/* Cover / Background decoration */}
                    {tempProfileDecoration && (
                      <img 
                        src={`/profile_effects/${tempProfileDecoration}.png`} 
                        alt="" 
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          maxWidth: 'none',
                          maxHeight: 'none',
                          objectFit: 'cover',
                          pointerEvents: 'none',
                          zIndex: 1
                        }} 
                      />
                    )}
                    
                    {/* User profile details layout for preview */}
                    <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <CustomAvatar 
                        size={60} 
                        src={profile?.avatar_url} 
                        name={profile?.full_name} 
                        id={profile?.id}
                        decoration={profile?.avatar_decoration}
                      />
                      <Text weight="2" style={{ fontSize: 15, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        {profile?.full_name}
                      </Text>
                    </div>
                  </div>
                  <Text style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginTop: 4 }}>
                    Так эффект профиля выглядит в области обложки
                  </Text>
                </div>

                <div style={{ padding: '0 16px' }}>
                  <Text style={{ fontSize: 14, fontWeight: 600, color: 'var(--vkui--color_text_primary)', marginBottom: 12 }}>
                    Выберите эффект из коллекции:
                  </Text>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 16 }}>
                    <div
                      onClick={() => handleUpdateProfileDecoration(null)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: 12,
                        borderRadius: 16,
                        cursor: 'pointer',
                        border: !tempProfileDecoration ? '2px solid #0077ff' : '2px solid transparent',
                        background: 'rgba(255,255,255,0.03)',
                        transition: 'transform 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <div style={{ width: 64, height: 64, borderRadius: 12, border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }}>✕</span>
                      </div>
                      <span style={{ fontSize: 11, marginTop: 8, color: 'var(--vkui--color_text_secondary)', textAlign: 'center', fontWeight: 500 }}>
                        Без эффекта
                      </span>
                    </div>

                    {PROFILE_DECORATIONS.map((deco) => {
                      const selected = tempProfileDecoration === deco.id
                      return (
                        <div
                          key={deco.id}
                          onClick={() => handleUpdateProfileDecoration(deco.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 16,
                            cursor: 'pointer',
                            border: selected ? '2px solid #0077ff' : '2px solid transparent',
                            background: selected ? 'rgba(0, 119, 255, 0.08)' : 'rgba(255,255,255,0.03)',
                            transition: 'transform 0.2s',
                            position: 'relative'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                            <img 
                              src={deco.url} 
                              alt="" 
                              style={{
                                width: '100%',
                                height: '100%',
                                maxWidth: 'none',
                                maxHeight: 'none',
                                objectFit: 'cover',
                                pointerEvents: 'none'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, marginTop: 8, color: 'var(--vkui--color_text_primary)', textAlign: 'center', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                            {deco.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Navigation Sidebar (Desktop only) */}
        <div className="settings-sidebar-col">
          <div className="posts-card" style={{ padding: '8px 0' }}>
            <button 
              className={`settings-sidebar-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              Общее / Аккаунт
            </button>
            <button 
              className={`settings-sidebar-item ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              Приватность
            </button>
            <button 
              className={`settings-sidebar-item ${activeTab === 'decorations' ? 'active' : ''}`}
              onClick={() => setActiveTab('decorations')}
            >
              Украшение аватарки
            </button>
            <button 
              className={`settings-sidebar-item ${activeTab === 'profile_decorations' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile_decorations')}
            >
              Украшение профиля
            </button>
            <button 
              className={`settings-sidebar-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Безопасность
            </button>
            <button 
              className={`settings-sidebar-item ${activeTab === 'stickers' ? 'active' : ''}`}
              onClick={() => setActiveTab('stickers')}
            >
              Стикеры
            </button>
            <div style={{ margin: '8px 0', borderTop: '1px solid var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))' }} />
            <button 
              className="settings-sidebar-item" 
              onClick={handleLogout}
              style={{ color: '#ff3b30' }}
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>

      {snackbar}
    </Panel>
  )
}


