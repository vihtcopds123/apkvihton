import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Panel,
  Group,
  SimpleCell,
  Avatar,
  Button,
  Box,
  FormItem,
  Input,
  Header,
  Tabs,
  TabsItem,
  Spinner,
  Select,
  Switch
} from '@vkontakte/vkui'
import {
  Icon28UsersOutline,
  Icon28AddOutline,
  Icon28SearchOutline,
  Icon20CheckCircleOutline,
  Icon20CancelCircleOutline,
  Icon28VolumeOutline,
  Icon28NotificationDisableOutline,
  Icon24Dismiss
} from '@vkontakte/icons'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useQueryClient } from '@tanstack/react-query'
import { CommunityDetailPanel } from './CommunityDetailPanel'
import type { GroupItem } from './communityTypes'

interface GroupsPanelProps {
  id: string
}

export const GroupsPanel: React.FC<GroupsPanelProps> = ({ id }) => {
  const { profile } = useAuthStore()
  const { selectedGroupId } = useAppStore()
  const queryClient = useQueryClient()

  const [groups, setGroups] = useState<GroupItem[]>([])
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set())
  const [mutedGroupIds, setMutedGroupIds] = useState<Set<string>>(new Set())
  const [confirmLeaveGroupId, setConfirmLeaveGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'my' | 'discover' | 'manage'>('my')
  const [searchQuery, setSearchQuery] = useState('')

  // Creation form state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [channelUsername, setChannelUsername] = useState('')
  const [is18Plus, setIs18Plus] = useState(false)
  const [privacyType, setPrivacyType] = useState<'open' | 'closed' | 'private'>('open')
  const wallType = 'restricted'
  const [creating, setCreating] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | 'invalid' | 'checking' | null>(null)

  useEffect(() => {
    if (!channelUsername.trim()) {
      setUsernameStatus(null)
      return
    }

    const cleanUsername = channelUsername.replace(/^@/, '').trim().toLowerCase()
    
    if (cleanUsername.length === 0) {
      setUsernameStatus(null)
      return
    }

    const tagRegex = /^[a-z0-9_-]{4,30}$/
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
        const { data: existingGroup, error: checkError } = await supabase
          .from('groups')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle()

        if (checkError) throw checkError

        if (existingGroup) {
          setUsernameStatus('taken')
        } else {
          setUsernameStatus('available')
        }
      } catch (err) {
        console.error('Error checking channel tag availability:', err)
        setUsernameStatus(null)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [channelUsername])

  useEffect(() => {
    fetchAll()
  }, [profile?.id])




  const fetchAll = async () => {
    setLoading(true)
    try {
      if (profile) {
        const [groupsResult, membersResult] = await Promise.all([
          supabase
            .from('groups')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('group_members')
            .select('group_id, is_muted')
            .eq('user_id', profile.id)
        ])

        if (groupsResult.error) throw groupsResult.error
        setGroups(groupsResult.data || [])

        const memData = membersResult.data
        if (memData) {
          setMyGroupIds(new Set(memData.map(m => m.group_id)))
          setMutedGroupIds(new Set(memData.filter(m => m.is_muted).map(m => m.group_id)))
        }
      } else {
        const { data: groupsData, error: gErr } = await supabase
          .from('groups')
          .select('*')
          .order('created_at', { ascending: false })

        if (gErr) throw gErr
        setGroups(groupsData || [])
        setMyGroupIds(new Set())
        setMutedGroupIds(new Set())
      }
    } catch (err) {
      console.error('Error fetching groups:', err)
    } finally {
      setLoading(false)
    }
  }

  const myGroups = useMemo(
    () => groups.filter(g => myGroupIds.has(g.id)),
    [groups, myGroupIds]
  )

  const discoverGroups = useMemo(
    () => groups.filter(g => !myGroupIds.has(g.id) && g.privacy_type !== 'private'),
    [groups, myGroupIds]
  )

  const managedGroups = useMemo(
    () => groups.filter(g => g.owner_id === profile?.id),
    [groups, profile]
  )

  const filtered = (list: GroupItem[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    )
  }

  const handleCreate = async () => {
    if (!profile || !name.trim() || creating) return
    setCreating(true)
    try {
      let cleanUsername = null
      if (channelUsername.trim()) {
        cleanUsername = channelUsername.replace(/^@/, '').trim().toLowerCase()
        if (!/^[a-z0-9_-]{3,20}$/.test(cleanUsername)) {
          alert('Тег канала должен содержать от 3 до 20 латинских букв, цифр, знаков подчеркивания или дефисов.')
          setCreating(false)
          return
        }

        // Проверяем уникальность тега в БД
        const { data: existingGroup } = await supabase
          .from('groups')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle()

        if (existingGroup) {
          alert('Этот тег канала уже занят.')
          setCreating(false)
          return
        }
      }

      const { data: newG, error } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          username: cleanUsername,
          is_18_plus: is18Plus,
          owner_id: profile.id,
          privacy_type: privacyType,
          wall_type: wallType,
          members_count: 1
        })
        .select()
        .single()

      if (error) throw error

      if (newG) {
        await supabase
          .from('group_members')
          .insert({
            group_id: newG.id,
            user_id: profile.id,
            role: 'owner'
          })

        setName('')
        setDescription('')
        setChannelUsername('')
        setIs18Plus(false)
        setShowCreateModal(false)
        await fetchAll()
        useAppStore.getState().selectGroup(newG.id, newG.username)
      }
    } catch (err) {
      console.error('Error creating community:', err)
      alert('Не удалось создать канал')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleMute = async (groupId: string) => {
    if (!profile) return
    const isCurrentlyMuted = mutedGroupIds.has(groupId)
    const nextMute = !isCurrentlyMuted
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ is_muted: nextMute })
        .eq('group_id', groupId)
        .eq('user_id', profile.id)

      if (error) throw error
      
      setMutedGroupIds(prev => {
        const next = new Set(prev)
        if (nextMute) {
          next.add(groupId)
        } else {
          next.delete(groupId)
        }
        return next
      })

      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            title: 'Уведомления',
            text: nextMute ? 'Уведомления от канала выключены' : 'Уведомления от канала включены',
            duration: 2000
          }
        })
      )
    } catch (err) {
      console.error('Error toggling mute:', err)
    }
  }

  const handleLeaveChannel = async (groupId: string) => {
    if (!profile) return
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', profile.id)

      if (error) throw error
      
      setMyGroupIds(prev => {
        const next = new Set(prev)
        next.delete(groupId)
        return next
      })

      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          const nextCount = Math.max(0, g.members_count - 1)
          window.dispatchEvent(new CustomEvent('channel-members-count-updated', { 
            detail: { groupId, count: nextCount } 
          }))
          return { ...g, members_count: nextCount }
        }
        return g
      }))

      queryClient.invalidateQueries({ queryKey: ['feed-posts', profile.id] })

      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            title: 'Подписки',
            text: 'Вы покинули канал',
            duration: 2000
          }
        })
      )
    } catch (err) {
      console.error('Error leaving channel:', err)
    }
  }

  const renderCommunityCard = (g: GroupItem) => (
    <SimpleCell
      key={g.id}
      before={
        g.avatar_url ? (
          <Avatar size={48} src={g.avatar_url} />
        ) : (
          <Avatar size={48} style={{ background: 'linear-gradient(135deg, #aa3bff 0%, var(--vkui--color_background_accent) 100%)' }}>
            <Icon28UsersOutline />
          </Avatar>
        )
      }
      subtitle={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{g.description || 'Без описания'}</span>
        </span>
      }
      onClick={() => useAppStore.getState().selectGroup(g.id, g.username)}
      style={{ cursor: 'pointer' }}
      after={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={(e) => e.stopPropagation()}>
          <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>
            {g.members_count} участн.
          </span>
          
          {activeTab === 'my' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Кнопка включения/выключения уведомлений */}
              <button
                onClick={() => handleToggleMute(g.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: mutedGroupIds.has(g.id) ? 'var(--vkui--color_text_secondary)' : '#0077ff',
                  opacity: mutedGroupIds.has(g.id) ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.opacity = mutedGroupIds.has(g.id) ? '0.4' : '1';
                }}
                title={mutedGroupIds.has(g.id) ? 'Включить уведомления' : 'Заглушить уведомления'}
              >
                {mutedGroupIds.has(g.id) ? (
                  <Icon28NotificationDisableOutline width={20} height={20} />
                ) : (
                  <Icon28VolumeOutline width={20} height={20} />
                )}
              </button>

              {/* Кнопка покинуть канал (крестик) */}
              <button
                onClick={() => setConfirmLeaveGroupId(g.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--vkui--color_text_secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
                  e.currentTarget.style.color = '#ff3b30';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--vkui--color_text_secondary)';
                }}
                title="Покинуть канал"
              >
                <Icon24Dismiss width={20} height={20} />
              </button>
            </div>
          )}

          {activeTab === 'discover' && (
            <Button
              size="s"
              mode="primary"
              style={{ borderRadius: 8 }}
              onClick={async () => {
                try {
                  if (!profile) return
                  if (g.privacy_type === 'closed') {
                    const { error } = await supabase
                      .from('group_join_requests')
                      .insert({ group_id: g.id, user_id: profile.id })
                    if (error) throw error
                    alert('Заявка на вступление отправлена!')
                  } else {
                    const { error } = await supabase
                      .from('group_members')
                      .insert({ group_id: g.id, user_id: profile.id, role: 'member' })
                    if (error) throw error
                    await fetchAll()
                  }
                } catch (err) {
                  console.error('Error joining from card:', err)
                  alert('Не удалось вступить в канал')
                }
              }}
            >
              {g.privacy_type === 'closed' ? 'Заявка' : 'Вступить'}
            </Button>
          )}
        </div>
      }
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
        {g.name}
        {g.is_closed && (
          <span title="Закрытое сообщество" style={{ fontSize: 11, opacity: 0.7 }}>🔒</span>
        )}
        {g.owner_id === profile?.id && (
          <span style={{ fontSize: 10, color: 'var(--vkui--color_text_accent)', fontWeight: 600, textTransform: 'uppercase' }}>
            Владелец
          </span>
        )}
      </span>
    </SimpleCell>
  )

  const renderEmptyState = (text: string) => (
    <Box style={{ textAlign: 'center', padding: 40, color: 'var(--vkui--color_text_secondary)' }}>
      <Icon28UsersOutline width={48} height={48} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div>{text}</div>
    </Box>
  )

  // If a group is selected, delegate to CommunityDetailPanel
  if (selectedGroupId) {
    return <CommunityDetailPanel id={id} />
  }

  return (
    <Panel id={id}>


      <Tabs>
        <TabsItem
          id="my-communities-tab"
          aria-controls="my-communities-panel"
          selected={activeTab === 'my'}
          onClick={() => setActiveTab('my')}
        >
          Мои ({myGroups.length})
        </TabsItem>
        <TabsItem
          id="discover-communities-tab"
          aria-controls="discover-communities-panel"
          selected={activeTab === 'discover'}
          onClick={() => setActiveTab('discover')}
        >
          Поиск
        </TabsItem>
        <TabsItem
          id="manage-communities-tab"
          aria-controls="manage-communities-panel"
          selected={activeTab === 'manage'}
          onClick={() => setActiveTab('manage')}
        >
          Управление
        </TabsItem>
      </Tabs>

      <Box style={{ padding: '12px 16px' }}>
        <Input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Поиск каналов..."
          before={<Icon28SearchOutline />}
        />
      </Box>

      {showCreateModal && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px 16px',
            boxSizing: 'border-box',
            overflowY: 'auto'
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'rgba(25, 25, 30, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 24,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              margin: 'auto',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#ffffff' }}>Новый канал</span>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <FormItem top="Имя канала">
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Например: Новости Vihton"
                style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}
              />
            </FormItem>

            <FormItem top="Тег канала">
              <Input
                type="text"
                value={channelUsername}
                onChange={e => setChannelUsername(e.target.value)}
                placeholder="@my_channel"
                style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}
                after={
                  usernameStatus === 'checking' ? (
                    <Spinner size="s" style={{ marginRight: 8 }} />
                  ) : usernameStatus === 'available' ? (
                    <Icon20CheckCircleOutline fill="#4bb34b" style={{ marginRight: 8 }} />
                  ) : usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
                    <Icon20CancelCircleOutline fill="var(--vkui--color_text_negative)" style={{ marginRight: 8 }} />
                  ) : null
                }
              />
              {usernameStatus === 'taken' && (
                <div style={{ fontSize: 12, color: 'var(--vkui--color_text_negative)', marginTop: 4, paddingLeft: 4 }}>
                  Этот тег уже занят
                </div>
              )}
              {usernameStatus === 'available' && (
                <div style={{ fontSize: 12, color: '#4bb34b', marginTop: 4, paddingLeft: 4 }}>
                  Тег свободен
                </div>
              )}
              {usernameStatus === 'invalid' && (
                <div style={{ fontSize: 12, color: 'var(--vkui--color_text_negative)', marginTop: 4, paddingLeft: 4 }}>
                  Минимум 4 символа (латиница, цифры, дефис, подчеркивание)
                </div>
              )}
            </FormItem>

            <FormItem top="Описание о чём канал">
              <textarea
                className="community-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="О чём ваш канал?"
                rows={3}
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  borderRadius: 10, 
                  border: '1px solid rgba(255,255,255,0.12)', 
                  color: 'white',
                  width: '100%',
                  padding: 10,
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: 14
                }}
              />
            </FormItem>

            <FormItem top="Тип канала">
              <Select
                value={privacyType}
                onChange={e => setPrivacyType(e.target.value as any)}
                options={[
                  { label: 'Открытое (вступить может любой)', value: 'open' },
                  { label: 'Закрытое (вступление по заявкам)', value: 'closed' },
                  { label: 'Частное (только по приглашениям владельца)', value: 'private' }
                ]}
                style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}
              />
            </FormItem>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', margin: '4px 0' }}>
              <span style={{ fontSize: 14, color: 'var(--vkui--color_text_secondary)' }}>Контент 18+ (возрастное ограничение)</span>
              <Switch
                checked={is18Plus}
                onChange={e => setIs18Plus(e.target.checked)}
              />
            </div>

            <FormItem style={{ marginTop: 12 }}>
              <Button
                size="l"
                stretched
                disabled={!name.trim() || creating}
                onClick={handleCreate}
                style={{ borderRadius: 12, background: '#0077ff' }}
              >
                {creating ? 'Создание...' : 'Создать'}
              </Button>
            </FormItem>
          </div>
        </div>
      , document.body)}

      {loading ? (
        <Box style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size="m" />
        </Box>
      ) : (
        <>
          {activeTab === 'my' && (
            <Group header={
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 6px' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Подписки
                </span>
                <button
                  onClick={() => setShowCreateModal(!showCreateModal)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#0077ff',
                    cursor: 'pointer',
                    marginLeft: 8,
                    padding: 0,
                    transition: 'background-color 0.15s ease, transform 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <Icon28AddOutline width={14} height={14} />
                </button>
              </div>
            }>
              {myGroups.length === 0 ? (
                renderEmptyState('Вы пока не подписаны ни на один канал')
              ) : (
                filtered(myGroups).map(renderCommunityCard)
              )}
            </Group>
          )}

          {activeTab === 'discover' && (
            <Group header={<Header size="s">Рекомендации</Header>}>
              {discoverGroups.length === 0 ? (
                renderEmptyState('Нет доступных каналов')
              ) : (
                filtered(discoverGroups).map(renderCommunityCard)
              )}
            </Group>
          )}

          {activeTab === 'manage' && (
            <Group header={
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 6px' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Мои каналы
                </span>
                <button
                  onClick={() => setShowCreateModal(!showCreateModal)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#0077ff',
                    cursor: 'pointer',
                    marginLeft: 8,
                    padding: 0,
                    transition: 'background-color 0.15s ease, transform 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <Icon28AddOutline width={14} height={14} />
                </button>
              </div>
            }>
              {managedGroups.length === 0 ? (
                renderEmptyState('Вы пока не создали ни одного канала')
              ) : (
                filtered(managedGroups).map(renderCommunityCard)
              )}
            </Group>
          )}
        </>
      )}
      {/* Confirm Leave Modal */}
      {confirmLeaveGroupId !== null && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'confirm-overlay-fade 0.25s ease-out forwards',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
        onClick={() => setConfirmLeaveGroupId(null)}
        >
          <div style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            maxWidth: 320,
            width: '90%',
            background: 'var(--vkui--color_background_content)',
            border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
            borderRadius: 24,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            textAlign: 'center',
            animation: 'confirm-modal-slide 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            boxSizing: 'border-box'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.15) 0%, rgba(255, 69, 58, 0.05) 100%)',
              border: '1px solid rgba(255, 59, 48, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              boxShadow: '0 8px 16px rgba(255, 59, 48, 0.1)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--vkui--color_text_primary)' }}>Покинуть канал?</div>
              <div style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', lineHeight: '1.4' }}>
                Вы уверены, что хотите выйти из этого сообщества? Вы больше не будете получать его новости.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                size="l"
                mode="secondary"
                stretched
                onClick={() => setConfirmLeaveGroupId(null)}
                style={{ 
                  borderRadius: 14, 
                  background: 'var(--vkui--color_background_secondary, rgba(255,255,255,0.05))',
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
                  color: 'var(--vkui--color_text_primary)'
                }}
              >
                Отмена
              </Button>
              <Button
                size="l"
                stretched
                onClick={async () => {
                  if (confirmLeaveGroupId) {
                    await handleLeaveChannel(confirmLeaveGroupId)
                  }
                  setConfirmLeaveGroupId(null)
                }}
                style={{ 
                  borderRadius: 14, 
                  background: 'linear-gradient(135deg, #ff3b30 0%, #ff453a 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(255, 59, 48, 0.2)'
                }}
              >
                Выйти
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Panel>
  )
}