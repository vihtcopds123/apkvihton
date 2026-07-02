import React, { useState, useEffect } from 'react'
import {
  Panel,
  SimpleCell,
  Button,
  Card
} from '@vkontakte/vkui'
import {
  Icon28InfoOutline,
  Icon28CoinsOutline,
  Icon28DevicesOutline
} from '@vkontakte/icons'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { CustomAvatar } from '../components/CustomAvatar'
import { uploadToTelegram } from '../utils/telegramStorage'

const defaultAboutBlocks = [{"type": "text", "value": "Добро пожаловать в Vihton — современную, быструю и стильную социальную сеть, вдохновлённую лучшими традициями классических социальных сервисов и переосмысленную на базе новейших веб-технологий."}]

const defaultUpdatesBlocks = [
  {"type": "text", "value": "Исправлены баги с лайками в комментариях одной и той же записи на фото."},
  {"type": "text", "value": "Темы оформления профиля — выбор премиальных эффектов и фонов для кастомизации страницы вашего профиля."},
  {"type": "text", "value": "Шифрование данных — криптографическая защита личных переписок на стороне базы данных."},
  {"type": "text", "value": "Музыкальная платформа — фоновое прослушивание музыки, загрузка треков, создание плейлистов и сохранение аудиозаписей."},
  {"type": "text", "value": "Вложения в чатах — удобный выбор фото, видео, музыки, кружочков и аудио в личных переписках."},
  {"type": "text", "value": "Добавлена возможность создавать свои стикеры и стикерпаки и делиться ими (это еще никогда не было так просто!)."}
]

const defaultCurrentFeaturesBlocks = [
  {"type": "text", "value": "Быстрый и надежный обмен сообщениями в реальном времени."},
  {"type": "text", "value": "Показ статуса в сети, проигрывание треков в статусе онлайн-режима и индикатор печатания сообщений."}
]

const defaultFuturePlansBlocks = [
  {"type": "text", "value": "Исправление основных известных багов."},
  {"type": "text", "value": "Фикс незаметных в коде багов и общая оптимизация."},
  {"type": "text", "value": "Добавление полноценных сообществ-каналов для публикации новостей и ведения блога для подписчиков."},
  {"type": "text", "value": "Полная интеграция в платные и бесплатные функции сайта как премиум-возможностей оформления, так и подарков."},
  {"type": "text", "value": "Создание собственных подарков через модерацию."}
]

const defaultVersionBlocks = [{"type": "text", "value": "1.19.2387"}]

interface AboutPanelProps {
  id: string
}

type TabType = 'about' | 'support' | 'download'

export const AboutPanel: React.FC<AboutPanelProps> = ({ id }) => {
  const { user, profile } = useAuthStore()
  const { setStory } = useAppStore()
  
  // Get active tab from app store or state
  const activeStory = useAppStore(state => state.activeStory)
  const [activeTab, setActiveTab] = useState<TabType>('about')
  const [adminProfile, setAdminProfile] = useState<any>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(false)
  const [isIOS, setIsIOS] = useState<boolean>(false)
  const [isDeviceRegistered, setIsDeviceRegistered] = useState<boolean | null>(null)

  const [sections, setSections] = useState<Record<string, { title: string, content_blocks: any[] }>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBlocks, setEditBlocks] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const { data, error } = await supabase
          .from('about_sections')
          .select('key, title, content_blocks')
        
        if (data && !error) {
          const mapped = data.reduce((acc: any, item: any) => {
            acc[item.key] = { title: item.title, content_blocks: item.content_blocks }
            return acc
          }, {})
          setSections(mapped)
        }
      } catch (err) {
        console.error('Error fetching about sections:', err)
      }
    }
    fetchSections()
  }, [])

  const getSectionData = (key: string, defaultTitle: string, defaultBlocks: any[]) => {
    return sections[key] || { title: defaultTitle, content_blocks: defaultBlocks }
  }

  const openEditModal = (key: string, title: string, blocks: any[]) => {
    setEditingKey(key)
    setEditTitle(title)
    setEditBlocks(JSON.parse(JSON.stringify(blocks))) // deep clone
  }

  const handleUploadBlockMedia = async (idx: number, file: File) => {
    try {
      setEditBlocks(prev => prev.map((b, i) => i === idx ? { ...b, isUploading: true } : b))
      const uniqueName = `about_${Date.now()}_${file.name}`
      const url = await uploadToTelegram(file, uniqueName)
      setEditBlocks(prev => prev.map((b, i) => i === idx ? { ...b, value: url, isUploading: false } : b))
    } catch (err) {
      console.error('Error uploading block media:', err)
      alert('Ошибка при загрузке медиафайла')
      setEditBlocks(prev => prev.map((b, i) => i === idx ? { ...b, isUploading: false } : b))
    }
  }

  const handleSaveSection = async () => {
    if (!editingKey) return
    setSaving(true)
    try {
      const cleanBlocks = editBlocks.map(({ isUploading, ...rest }) => rest)
      
      const { error } = await supabase
        .from('about_sections')
        .upsert({
          key: editingKey,
          title: editTitle,
          content_blocks: cleanBlocks,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setSections(prev => ({
        ...prev,
        [editingKey]: { title: editTitle, content_blocks: cleanBlocks }
      }))
      setEditingKey(null)
    } catch (err: any) {
      console.error('Error saving about section:', err)
      alert('Не удалось сохранить изменения: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderSectionContent = (key: string, defaultTitle: string, defaultBlocks: any[], bulletSymbol?: string, isBoldPrefix = false) => {
    const data = getSectionData(key, defaultTitle, defaultBlocks)
    const isAdmin = profile?.role === 'admin' || profile?.username === 'viht'

    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--vkui--color_text_primary)' }}>
            {data.title}
          </h2>
          {isAdmin && (
            <button
              onClick={() => openEditModal(key, data.title, data.content_blocks)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--vkui--color_text_accent, #007aff)',
                padding: '4px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                opacity: 0.8,
                transition: 'opacity 0.15s'
              }}
              title="Редактировать раздел"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.content_blocks.map((block: any, idx: number) => {
            if (block.type === 'image') {
              return (
                <div key={idx} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxWidth: '100%', maxHeight: 320, marginTop: 4, display: 'inline-block' }}>
                  <img src={block.value} alt="Media" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 12 }} />
                </div>
              )
            }
            if (block.type === 'video') {
              return (
                <div key={idx} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxWidth: '100%', maxHeight: 320, marginTop: 4 }}>
                  <video src={block.value} controls style={{ width: '100%', maxHeight: 320, borderRadius: 12 }} />
                </div>
              )
            }
            return (
              <div key={idx} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--vkui--color_text_secondary)' }}>
                {bulletSymbol && <span style={{ color: bulletSymbol === '✦' ? '#34c759' : bulletSymbol === '✓' ? '#007aff' : '#ff9500', flexShrink: 0 }}>{bulletSymbol}</span>}
                <span style={{ textAlign: 'left' }}>
                  {isBoldPrefix ? (
                    block.value.includes(' — ') ? (
                      (() => {
                        const parts = block.value.split(' — ')
                        return (
                          <>
                            <strong>{parts[0]}</strong> — {parts.slice(1).join(' — ')}
                          </>
                        )
                      })()
                    ) : (
                      block.value
                    )
                  ) : (
                    block.value
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderAboutHeader = () => {
    const aboutData = getSectionData('about', 'О платформе Vihton', defaultAboutBlocks)
    const versionData = getSectionData('version', 'Версия', defaultVersionBlocks)
    const isAdmin = profile?.role === 'admin' || profile?.username === 'viht'

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 className="docs-title" style={{ margin: 0, fontSize: 24 }}>
            {aboutData.title}
          </h1>
          {isAdmin && (
            <button
              onClick={() => openEditModal('about', aboutData.title, aboutData.content_blocks)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--vkui--color_text_accent, #007aff)',
                padding: '4px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                opacity: 0.8,
                transition: 'opacity 0.15s'
              }}
              title="Редактировать описание"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ 
            fontSize: 12, 
            fontWeight: 600, 
            color: 'var(--vkui--color_text_accent, #007aff)', 
            background: 'var(--vkui--color_background_secondary_alpha, rgba(0, 122, 255, 0.08))', 
            padding: '6px 12px', 
            borderRadius: 20
          }}>
            Версия {versionData.content_blocks?.[0]?.value || '1.19.2387'}
          </span>
          {isAdmin && (
            <button
              onClick={() => openEditModal('version', versionData.title, versionData.content_blocks)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--vkui--color_text_accent, #007aff)',
                padding: '4px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                opacity: 0.8,
                transition: 'opacity 0.15s'
              }}
              title="Редактировать версию"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          )}
        </div>
      </>
    )
  }

  // Sync active tab with the clicked story
  useEffect(() => {
    if (activeStory === 'about' || activeStory === 'support' || activeStory === 'download') {
      setActiveTab(activeStory as TabType)
    }
  }, [activeStory])

  const checkDeviceRegistration = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('user_push_tokens')
        .select('id')
        .eq('user_id', user.id)
      
      if (!error) {
        setIsDeviceRegistered(data.length > 0)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    setIsStandalone(!!standalone)

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    checkDeviceRegistration()

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [user])

  const [permissionState, setPermissionState] = useState<string>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission)
    }
  }, [])

  const handleEnablePush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Уведомления не поддерживаются на этом устройстве/браузере.')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setPermissionState(permission)

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready
        
        let subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          try { await subscription.unsubscribe(); } catch(e){}
          subscription = null;
        }
        const vapidPublicKey = 'BOXz22wbQguxYIQ_LqEPIZMGkec4jXUbfaIoe4cXPf6b5CXq07UB4Z6gILuWMPpLndxdiq3Db9jGKvhzFfFn8zs'
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        })
        localStorage.setItem('viht_vapid_keys_v3', 'true');

        // Save to Supabase - check if exists first
        const { data: existing } = await supabase
          .from('user_push_tokens')
          .select('id')
          .eq('user_id', user?.id)
          .maybeSingle()
        
        let error
        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('user_push_tokens')
            .update({ subscription: subscription.toJSON() })
            .eq('user_id', user?.id)
          error = updateError
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('user_push_tokens')
            .insert({ user_id: user?.id, subscription: subscription.toJSON() })
          error = insertError
        }
        
        if (error) {
          console.error('Error saving push token:', error)
          alert('Ошибка при сохранении подписки на сервере: ' + error.message)
        } else {
          setIsDeviceRegistered(true)
          alert('Push-уведомления успешно зарегистрированы!')
        }
      } else if (permission === 'denied') {
        alert('Вы заблокировали уведомления. Пожалуйста, сбросьте разрешение в настройках браузера (значок настроек в строке адреса).')
      }
    } catch (err) {
      console.error(err)
      alert('Ошибка при настройке уведомлений: ' + (err as Error).message)
    }
  }

  const handleTestPush = async () => {
    try {
      let subscription = null;
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        subscription = await registration.pushManager.getSubscription();
      }

      if (!subscription && user) {
        const { data } = await supabase
          .from('user_push_tokens')
          .select('subscription')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data && data.subscription) {
          subscription = typeof data.subscription === 'string' 
            ? JSON.parse(data.subscription) 
            : data.subscription;
        }
      }

      if (!subscription) {
        alert('Сначала включите уведомления на устройстве (кнопка выше)!');
        return;
      }

      const response = await fetch('https://vihtclub.ru/push-api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Vihton 🔔',
          body: 'Это тестовый пуш через сервер! Ваши уведомления настроены правильно.',
          url: '/notifications',
          subscriptions: [subscription]
        })
      });

      const resData = await response.json();
      if (response.ok && resData.status === 'success') {
        alert('Локальный тест: Запрос отправлен на сервер! Пожалуйста, заблокируйте экран или сверните приложение, чтобы увидеть его.');
      } else {
        alert('Ошибка при отправке: ' + JSON.stringify(resData));
      }
    } catch (err) {
      console.error('Test push error:', err);
      alert('Ошибка при проверке уведомлений: ' + (err as Error).message);
    }
  }

  const handleInstallClick = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome: _outcome } = await installPrompt.userChoice
    // Handle user choice outcome
    setInstallPrompt(null)
  }

  // Fetch admin profile (viht or adm) to allow messaging
  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username, is_online')
          .eq('username', 'viht')
          .maybeSingle()
        
        if (data) {
          setAdminProfile(data)
        } else {
          const { data: fallback } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, username, is_online')
            .eq('username', 'adm')
            .maybeSingle()
          
          if (fallback) {
            setAdminProfile(fallback)
          }
        }
      } catch (err) {
        console.error('Error fetching admin profile:', err)
      }
    }
    fetchAdmin()
  }, [])

  const handleMessageAdmin = async () => {
    if (!user) return
    if (!adminProfile) {
      alert('Профиль разработчика временно недоступен. Попробуйте зайти в личные сообщения позже.')
      return
    }

    try {
      // Find existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${adminProfile.id}),and(participant_1.eq.${adminProfile.id},participant_2.eq.${user.id})`)
        .maybeSingle()

      if (existing) {
        useAppStore.getState().selectChat(existing.id, adminProfile)
      } else {
        // Create new conversation
        const { data: created, error } = await supabase
          .from('conversations')
          .insert({
            participant_1: user.id,
            participant_2: adminProfile.id
          })
          .select('id')
          .single()

        if (created) {
          useAppStore.getState().selectChat(created.id, adminProfile)
        } else {
          throw error || new Error('Failed to create conversation')
        }
      }
    } catch (err) {
      console.error('Error starting conversation with admin:', err)
      // Fallback: just open profile
      useAppStore.getState().selectProfile(adminProfile.id)
    }
  }

  return (
    <Panel id={id}>
      <div className="settings-custom-header">
        <button 
          onClick={() => setStory('feed')} 
          className="settings-back-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span className="settings-header-title">
          {activeTab === 'about' ? 'О сервисе' : activeTab === 'support' ? 'Поддержка проекта' : 'Установка приложения'}
        </span>
      </div>

      {/* Mobile Tabs */}
      <div className="about-mobile-tabs-container" style={{ padding: '0 16px 12px', background: 'transparent', borderBottom: 'none' }}>
        <div className="settings-mobile-tabs" style={{ margin: 0 }}>
          <button 
            className={`settings-tab-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('about')
              useAppStore.setState({ activeStory: 'about' })
            }}
          >
            О сервисе
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'support' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('support')
              useAppStore.setState({ activeStory: 'support' })
            }}
          >
            Поддержка
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'download' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('download')
              useAppStore.setState({ activeStory: 'download' })
            }}
          >
            Установка
          </button>
        </div>
      </div>

      <div className="docs-layout">
        {/* Left navigation sidebar */}
        <div className="docs-sidebar">
          <div className="docs-sidebar-header">Разделы</div>
          <div className="docs-sidebar-menu">
            <button 
              className={`docs-menu-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('about')
                // Update active story in store without replacing navigation history completely
                useAppStore.setState({ activeStory: 'about' })
              }}
            >
              <Icon28InfoOutline width={20} height={20} />
              <span>О сервисе</span>
            </button>
            <button 
              className={`docs-menu-item ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('support')
                useAppStore.setState({ activeStory: 'support' })
              }}
            >
              <Icon28CoinsOutline width={20} height={20} />
              <span>Поддержка проекта</span>
            </button>
            <button 
              className={`docs-menu-item ${activeTab === 'download' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('download')
                useAppStore.setState({ activeStory: 'download' })
              }}
            >
              <Icon28DevicesOutline width={20} height={20} />
              <span>Установка приложения</span>
            </button>
          </div>

          {/* Quick contact widget in sidebar */}
          {adminProfile && (
            <div className="docs-admin-card">
              <div className="docs-admin-card-title">Разработчик</div>
              <SimpleCell
                onClick={() => useAppStore.getState().selectProfile(adminProfile.id)}
                before={<CustomAvatar size={36} src={adminProfile.avatar_url} name={adminProfile.full_name} id={adminProfile.id} />}
                subtitle={`@${adminProfile.username}`}
                style={{ padding: 0, margin: '8px 0' }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{adminProfile.full_name}</span>
              </SimpleCell>
              <Button 
                size="s" 
                mode="secondary" 
                before={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                onClick={() => {
                  useAppStore.getState().selectProfile(adminProfile.id)
                  useAppStore.getState().setStory('profile')
                }}
                style={{ width: '100%', borderRadius: 8, marginTop: 4 }}
              >
                Открыть страницу
              </Button>
              <div style={{ fontSize: 9, color: 'var(--vkui--color_text_secondary)', marginTop: 12, textAlign: 'center', lineHeight: 1.35, opacity: 0.8 }}>
                © Vihton. Контент не является собственностью платформы.
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="docs-content-container">
          {activeTab === 'about' ? (
            <div className="docs-content animate-fade-in-up" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {renderAboutHeader()}
              </div>
              
              <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 28, color: 'var(--vkui--color_text_secondary)' }}>
                {getSectionData('about', 'О платформе Vihton', defaultAboutBlocks).content_blocks.map((block: any, idx: number) => {
                  if (block.type === 'image') {
                    return (
                      <div key={idx} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxWidth: '100%', maxHeight: 320, marginTop: 4, display: 'inline-block' }}>
                        <img src={block.value} alt="Media" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 12 }} />
                      </div>
                    )
                  }
                  if (block.type === 'video') {
                    return (
                      <div key={idx} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxWidth: '100%', maxHeight: 320, marginTop: 4 }}>
                        <video src={block.value} controls style={{ width: '100%', maxHeight: 320, borderRadius: 12 }} />
                      </div>
                    )
                  }
                  return <p key={idx} style={{ margin: '0 0 12px 0', textAlign: 'left' }}>{block.value}</p>
                })}
              </div>

              {renderSectionContent('updates', 'Последние обновления:', defaultUpdatesBlocks, '✦', true)}
              {renderSectionContent('current_features', 'Что уже сейчас работает:', defaultCurrentFeaturesBlocks, '✓')}
              {renderSectionContent('future_plans', 'Что будет реализовано в дальнейшем:', defaultFuturePlansBlocks, '•')}
            </div>
          ) : activeTab === 'support' ? (
            <div className="docs-content animate-fade-in-up" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '16px 0' }}>
              <h1 className="docs-title" style={{ fontSize: 24, marginBottom: 8 }}>Поддержка проекта</h1>
              <p className="docs-subtitle" style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 28, color: 'var(--vkui--color_text_secondary)' }}>
                Vihton — это независимый некоммерческий проект, созданный с душой. Мы верим в свободное, быстрое и удобное общение без навязчивой рекламы и платных подписок на базовые функции.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 28 }}>
                {/* Карточка 1 */}
                <div 
                  className="support-info-card"
                  style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    padding: '20px',
                    borderRadius: 16,
                    background: 'var(--vkui--color_background_secondary_alpha, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.05))',
                    transition: 'transform 0.25s ease, background 0.25s ease, border-color 0.25s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(255, 255, 255, 0.04))'
                    e.currentTarget.style.borderColor = 'rgba(0, 122, 255, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(255, 255, 255, 0.02))'
                    e.currentTarget.style.borderColor = 'var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.05))'
                  }}
                >
                  <div style={{ 
                    background: 'rgba(0, 122, 255, 0.08)', 
                    padding: 12, 
                    borderRadius: 12, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon28DevicesOutline width={24} height={24} style={{ color: '#0077ff' }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--vkui--color_text_primary)' }}>Кроссплатформенная экосистема</h3>
                    <p style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', lineHeight: 1.5, margin: 0 }}>
                      Проект не ограничивается веб-версией. Вы можете установить полноценное приложение для <strong>Windows / ПК</strong>, <strong>iOS / iPhone</strong> и <strong>Android</strong> прямо из браузера.
                    </p>
                  </div>
                </div>

                {/* Карточка 2 */}
                <div 
                  className="support-info-card"
                  style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                    padding: '20px',
                    borderRadius: 16,
                    background: 'var(--vkui--color_background_secondary_alpha, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.05))',
                    transition: 'transform 0.25s ease, background 0.25s ease, border-color 0.25s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(255, 255, 255, 0.04))'
                    e.currentTarget.style.borderColor = 'rgba(52, 199, 89, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.background = 'var(--vkui--color_background_secondary_alpha, rgba(255, 255, 255, 0.02))'
                    e.currentTarget.style.borderColor = 'var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.05))'
                  }}
                >
                  <div style={{ 
                    background: 'rgba(52, 199, 89, 0.08)', 
                    padding: 12, 
                    borderRadius: 12, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon28CoinsOutline width={24} height={24} style={{ color: '#34c759' }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--vkui--color_text_primary)' }}>На что идут ресурсы?</h3>
                    <p style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', lineHeight: 1.5, margin: 0 }}>
                      Для работы соцсети в сети 24/7 требуются постоянные расходы: аренда серверов баз данных, вычислительных мощностей для хранения картинок, оплата доменного имени и поддержка защищенных протоколов.
                    </p>
                  </div>
                </div>
              </div>

              <div className="docs-cta-banner docs-support-banner">
                <div className="docs-cta-text" style={{ width: '100%' }}>
                  <h4>🌱 Поддержите развитие Vihton</h4>
                  <p>
                    Если вам нравится проект и вы хотите помочь разработчику оплатить аренду серверов и баз данных, чтобы сервис стабильно работал («кушал»), мы будем безумно благодарны за любую финансовую поддержку. 
                  </p>
                  <p style={{ marginTop: 8, fontWeight: 500 }}>
                    Пожалуйста, напишите разработчику в личные сообщения для уточнения реквизитов или вопросов сотрудничества.
                  </p>
                  
                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <Button 
                      mode="primary" 
                      onClick={handleMessageAdmin}
                      style={{ borderRadius: 8, background: '#34c759' }}
                    >
                      Связаться с разработчиком
                    </Button>
                    <Button 
                      mode="secondary" 
                      onClick={() => setStory('feed')}
                      style={{ borderRadius: 8 }}
                    >
                      Вернуться в ленту
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="docs-content animate-fade-in-up">
              <h1 className="docs-title">Установка приложения Vihton</h1>
              <p className="docs-subtitle">
                Вы можете установить Vihton как полноценное приложение на свой ПК, iPhone или Android-смартфон. Оно будет запускаться с рабочего стола и присылать мгновенные уведомления.
              </p>

              <div style={{ height: 1, background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '24px 0' }} />

              {isStandalone ? (
                <div className="docs-cta-banner" style={{ background: 'rgba(52, 199, 89, 0.08)', border: '1px solid rgba(52, 199, 89, 0.25)', padding: '20px' }}>
                  <div style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 28 }}>🎉</span>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--vkui--color_text_primary)' }}>Приложение успешно запущено!</h4>
                      <p style={{ color: 'var(--vkui--color_text_secondary)', fontSize: 12, marginTop: 4, margin: 0 }}>
                        Вы используете Vihton как установленное приложение (PWA). Все функции работают максимально быстро и отзывчиво.
                      </p>
                    </div>
                  </div>
                </div>
              ) : isIOS ? (
                <div className="docs-cta-banner" style={{ background: 'rgba(255, 149, 0, 0.08)', border: '1px solid rgba(255, 149, 0, 0.25)', padding: '20px' }}>
                  <div style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 24, marginTop: -2 }}>🍎</span>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px 0', color: 'var(--vkui--color_text_primary)' }}>Установка на iPhone / iPad</h4>
                      <p style={{ color: 'var(--vkui--color_text_secondary)', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                        На устройствах Apple автоматическая установка в один клик не поддерживается правилами компании. 
                      </p>
                      <p style={{ color: 'var(--vkui--color_text_secondary)', fontSize: 12, lineHeight: 1.5, marginTop: 6, margin: 0 }}>
                        Чтобы установить: откройте этот сайт в браузере <strong>Safari</strong>, нажмите на кнопку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх на панели снизу) и выберите пункт <strong>«На экран Домой»</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : installPrompt ? (
                <div className="docs-cta-banner" style={{ background: 'linear-gradient(135deg, #0077ff 0%, #0055d4 100%)', border: 'none', color: '#fff', padding: '24px' }}>
                  <div style={{ textAlign: 'left', color: '#fff', width: '100%' }}>
                    <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>Установить Vihton в один клик</h3>
                    <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                      Приложение мгновенно добавится на ваш экран компьютера или смартфона.
                    </p>
                    <Button 
                      size="l" 
                      onClick={handleInstallClick} 
                      style={{ 
                        marginTop: 16, 
                        borderRadius: 10, 
                        background: '#ffffff', 
                        color: '#0077ff',
                        fontWeight: 600,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
                      }}
                    >
                      Установить на устройство
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="docs-cta-banner" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px' }}>
                  <div style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 24 }}>✨</span>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Приложение готово к установке</h4>
                      <p style={{ color: 'var(--vkui--color_text_secondary)', fontSize: 12, marginTop: 4, margin: 0 }}>
                        Если автоматическая кнопка выше не отображается (или была скрыта), следуйте стандартным пошаговым инструкциям для вашей операционной системы ниже.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '24px 0' }} />

              <h2 className="docs-section-title">
                <Icon28DevicesOutline style={{ color: '#34c759' }} />
                <span>Инструкции по установке</span>
              </h2>

              <div className="docs-grid">
                <Card className="docs-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>💻 Windows / macOS / ПК</h3>
                  <p style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', lineHeight: 1.5, margin: 0 }}>
                    1. Откройте сайт в браузере <strong>Google Chrome</strong>, <strong>Yandex Browser</strong> или <strong>Edge</strong>.<br/>
                    2. В адресной строке нажмите на иконку <strong>монитора со стрелочкой</strong> (или «Установить»).<br/>
                    3. Либо откройте меню (три точки) и нажмите <strong>«Установить приложение Vihton»</strong>.<br/>
                    4. <strong>Важно</strong>: Если уведомления заблокированы, нажмите на значок настроек сайта (слайдеры/шестеренка) слева от `vihtclub.ru` в адресной строке, перейдите в «Настройки сайтов» и разрешите Уведомления.
                  </p>
                </Card>

                <Card className="docs-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>🍎 iOS (iPhone / iPad)</h3>
                  <p style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', lineHeight: 1.5, margin: 0 }}>
                    1. Откройте сайт в стандартном браузере <strong>Safari</strong>.<br/>
                    2. Нажмите кнопку <strong>«Поделиться»</strong> (иконка квадрата со стрелкой вверх в нижней панели).<br/>
                    3. Прокрутите список вниз и выберите пункт <strong>«На экран Домой»</strong>.<br/>
                    4. Нажмите «Добавить» в правом верхнем углу.
                  </p>
                </Card>

                <Card className="docs-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>🤖 Android</h3>
                  <p style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', lineHeight: 1.5, margin: 0 }}>
                    1. <strong>Важно</strong>: Если вы уже добавляли сайт ранее как обычный ярлык (где показывается только кнопка «Убрать»), обязательно удалите его с экрана.<br/>
                    2. Откройте сайт в браузере <strong>Google Chrome</strong>.<br/>
                    3. Нажмите на три точки в верхнем правом углу и выберите <strong>«Добавить на главный экран»</strong> (или «Установить»). Подтвердите установку в появившемся окне с логотипом Vihton.<br/>
                    4. <strong>Фоновая работа</strong>: Зажмите иконку установленного приложения на рабочем столе ➜ выберите «О приложении» ➜ в разделе «Батарея» установите <strong>«Без ограничений»</strong> и включите <strong>«Автозапуск»</strong> (для Xiaomi/Realme).
                  </p>
                </Card>
              </div>

              <div style={{ height: 1, background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '24px 0' }} />

              <h2 className="docs-section-title">
                <span>🔔 Диагностика и активация уведомлений</span>
              </h2>

              <Card className="docs-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)' }}>Статус разрешений браузера:</span>
                  {permissionState === 'granted' ? (
                    <span style={{ background: 'rgba(52, 199, 89, 0.15)', color: '#30d158', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Разрешено</span>
                  ) : permissionState === 'denied' ? (
                    <span style={{ background: 'rgba(255, 69, 58, 0.15)', color: '#ff453a', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Заблокировано</span>
                  ) : (
                    <span style={{ background: 'rgba(142, 142, 147, 0.15)', color: '#8e8e93', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Не запрошено</span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)' }}>Регистрация устройства на сервере:</span>
                  {isDeviceRegistered === true ? (
                    <span style={{ background: 'rgba(52, 199, 89, 0.15)', color: '#30d158', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Активно</span>
                  ) : isDeviceRegistered === false ? (
                    <span style={{ background: 'rgba(255, 149, 0, 0.15)', color: '#ff9500', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Не зарегистрировано</span>
                  ) : (
                    <span style={{ background: 'rgba(142, 142, 147, 0.15)', color: '#8e8e93', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Проверка...</span>
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '4px 0' }} />

                {permissionState !== 'granted' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', lineHeight: 1.4, margin: 0 }}>
                      Чтобы получать уведомления о новых сообщениях, лайках и ответах, когда приложение или сайт закрыты, необходимо дать разрешение на показ уведомлений.
                    </p>
                    <Button size="m" mode="primary" onClick={handleEnablePush} style={{ borderRadius: 8, alignSelf: 'flex-start' }}>
                      Включить уведомления на этом устройстве
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', lineHeight: 1.4, margin: 0 }}>
                      {isDeviceRegistered === false 
                        ? 'Браузер дал разрешение, но устройство ещё не зарегистрировано в базе данных. Пожалуйста, нажмите кнопку ниже, чтобы привязать его к серверу.'
                        : 'Уведомления успешно включены и зарегистрированы на сервере! Если они не приходят, вы можете отправить локальное тестовое сообщение.'}
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      {isDeviceRegistered === false ? (
                        <Button size="m" mode="primary" onClick={handleEnablePush} style={{ borderRadius: 8 }}>
                          Зарегистрировать это устройство на сервере
                        </Button>
                      ) : (
                        <>
                          <Button size="m" mode="secondary" onClick={handleTestPush} style={{ borderRadius: 8 }}>
                            Проверить уведомления (Тест PUSH)
                          </Button>
                          <Button size="m" mode="tertiary" onClick={handleEnablePush} style={{ borderRadius: 8 }}>
                            Обновить регистрацию / Токен
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Card>

              <div style={{ height: 1, background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '24px 0' }} />

              <div className="docs-cta-banner" style={{ background: 'rgba(52, 199, 89, 0.05)', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                <div style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 24, marginTop: -2 }}>🔔</span>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>Push-уведомления после установки</h4>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--vkui--color_text_secondary)' }}>
                      После того как вы установите приложение на главный экран смартфона или рабочий стол ПК, при первом запуске оно автоматически попросит разрешение на показ уведомлений. Разрешите его, чтобы мгновенно узнавать о новых сообщениях, лайках и комментариях!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick contact widget for mobile (since sidebar is hidden on mobile) */}
          {adminProfile && (
            <div className="about-mobile-admin-card-container">
              <div style={{ height: 1, background: 'var(--vkui--color_separator_primary_alpha, rgba(0,0,0,0.06))', margin: '24px 0' }} />
              <div className="docs-admin-card" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                <div className="docs-admin-card-title">Разработчик</div>
                <SimpleCell
                  onClick={() => useAppStore.getState().selectProfile(adminProfile.id)}
                  before={<CustomAvatar size={36} src={adminProfile.avatar_url} name={adminProfile.full_name} id={adminProfile.id} />}
                  subtitle={`@${adminProfile.username}`}
                  style={{ padding: 0, margin: '8px 0' }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{adminProfile.full_name}</span>
                </SimpleCell>
                <Button 
                  size="s" 
                  mode="secondary" 
                  before={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                  onClick={() => {
                    useAppStore.getState().selectProfile(adminProfile.id)
                    useAppStore.getState().setStory('profile')
                  }}
                  style={{ width: '100%', borderRadius: 8, marginTop: 4 }}
                >
                  Открыть страницу
                </Button>
                <div style={{ fontSize: 9, color: 'var(--vkui--color_text_secondary)', marginTop: 12, textAlign: 'center', lineHeight: 1.35, opacity: 0.8 }}>
                  © Vihton. Контент не является собственностью платформы.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingKey && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--vkui--color_background_modal_card, rgba(30, 30, 30, 0.95))',
            border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.1))',
            borderRadius: 24,
            width: '100%',
            maxWidth: 540,
            maxHeight: '90vh',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--vkui--color_text_primary)' }}>
                Редактирование раздела
              </span>
              <button 
                onClick={() => setEditingKey(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: 0.6, color: 'var(--vkui--color_text_primary)' }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', marginBottom: 6 }}>
                  Заголовок
                </label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--vkui--color_field_background, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))',
                    color: 'var(--vkui--color_text_primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', marginBottom: 8 }}>
                  Контент-блоки
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {editBlocks.map((block, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 8,
                      padding: 12,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, color: 'var(--vkui--color_text_primary)' }}>
                          Блок {idx + 1} ({block.type === 'text' ? 'Текст' : block.type === 'image' ? 'Фото' : 'Видео'})
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              if (idx === 0) return
                              const next = [...editBlocks]
                              const temp = next[idx]
                              next[idx] = next[idx - 1]
                              next[idx - 1] = temp
                              setEditBlocks(next)
                            }}
                            disabled={idx === 0}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', padding: 2, opacity: idx === 0 ? 0.3 : 1 }}
                            title="Вверх"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              if (idx === editBlocks.length - 1) return
                              const next = [...editBlocks]
                              const temp = next[idx]
                              next[idx] = next[idx + 1]
                              next[idx + 1] = temp
                              setEditBlocks(next)
                            }}
                            disabled={idx === editBlocks.length - 1}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vkui--color_text_secondary)', padding: 2, opacity: idx === editBlocks.length - 1 ? 0.3 : 1 }}
                            title="Вниз"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => setEditBlocks(prev => prev.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', fontWeight: 600, padding: 2 }}
                            title="Удалить блок"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {block.type === 'text' ? (
                        <div>
                          <textarea
                            value={block.value}
                            onChange={(e) => {
                              const val = e.target.value
                              setEditBlocks(prev => prev.map((b, i) => i === idx ? { ...b, value: val } : b))
                            }}
                            style={{
                              width: '100%',
                              height: 80,
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: 'var(--vkui--color_field_background, rgba(255, 255, 255, 0.05))',
                              border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))',
                              color: 'var(--vkui--color_text_primary)',
                              fontSize: 13,
                              outline: 'none',
                              resize: 'vertical',
                              boxSizing: 'border-box'
                            }}
                            placeholder="Введите текст предложения..."
                          />
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {['👍', '❤️', '🔥', '😊', '🎉', '🔔', '✦', '✓', '•', '🛡️', '📱', '💬', '🎙️', '🛍️'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  setEditBlocks(prev => prev.map((b, i) => i === idx ? { ...b, value: b.value + emoji } : b))
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.05)',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  color: 'var(--vkui--color_text_primary)'
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            type="text"
                            value={block.value}
                            onChange={(e) => {
                              const val = e.target.value
                              setEditBlocks(prev => prev.map((b, i) => i === idx ? { ...b, value: val } : b))
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 10,
                              background: 'var(--vkui--color_field_background, rgba(255, 255, 255, 0.05))',
                              border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))',
                              color: 'var(--vkui--color_text_primary)',
                              fontSize: 13,
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            placeholder="URL медиафайла или выберите файл ниже..."
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Button
                              size="s"
                              mode="secondary"
                              onClick={() => {
                                const fileInput = document.getElementById(`media-file-input-${idx}`)
                                if (fileInput) fileInput.click()
                              }}
                              loading={block.isUploading}
                              style={{ borderRadius: 8 }}
                            >
                              Выбрать файл
                            </Button>
                            <input
                              id={`media-file-input-${idx}`}
                              type="file"
                              accept={block.type === 'image' ? 'image/*' : 'video/*'}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUploadBlockMedia(idx, file)
                              }}
                              style={{ display: 'none' }}
                            />
                            {block.value && (
                              <span style={{ fontSize: 11, color: '#34c759' }}>Загружено ✓</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <Button
                    size="s"
                    mode="tertiary"
                    onClick={() => setEditBlocks(prev => [...prev, { type: 'text', value: '' }])}
                    style={{ borderRadius: 8 }}
                  >
                    + Текст
                  </Button>
                  <Button
                    size="s"
                    mode="tertiary"
                    onClick={() => setEditBlocks(prev => [...prev, { type: 'image', value: '' }])}
                    style={{ borderRadius: 8 }}
                  >
                    + Фото
                  </Button>
                  <Button
                    size="s"
                    mode="tertiary"
                    onClick={() => setEditBlocks(prev => [...prev, { type: 'video', value: '' }])}
                    style={{ borderRadius: 8 }}
                  >
                    + Видео
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Button 
                mode="secondary" 
                onClick={() => setEditingKey(null)}
                style={{ borderRadius: 10 }}
              >
                Отмена
              </Button>
              <Button 
                mode="primary" 
                loading={saving}
                onClick={handleSaveSection}
                style={{ borderRadius: 10 }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
