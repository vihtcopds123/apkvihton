import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Panel,
  PanelHeader,
  PanelHeaderBack,
  SimpleCell,
  Avatar,
  Button,
  Box,
  Text,
  FormItem,
  Input,
  Spinner,
  IconButton,
  Switch
} from '@vkontakte/vkui'
import {
  Icon28UsersOutline,
  Icon28SendOutline,
  Icon28CameraOutline,
  Icon28SettingsOutline,
  Icon28VolumeOutline,
  Icon28Notifications,
  Icon28NotificationDisableOutline
} from '@vkontakte/icons'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useQueryClient } from '@tanstack/react-query'
import { uploadToTelegram } from '../utils/telegramStorage'
import { PostCard } from '../components/PostCard'
import { ChannelShareSheet } from '../components/ChannelShareSheet'
import type { GroupItem } from './communityTypes'

interface CommunityDetailPanelProps {
  id: string
}

interface CommunityMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  profile: {
    id: string
    full_name: string | null
    avatar_url: string | null
    username: string | null
    role?: string | null
  }
}
type CommunityTab = 'wall' | 'discussions' | 'photos' | 'members' | 'info' | 'settings'

export const CommunityDetailPanel: React.FC<CommunityDetailPanelProps> = ({ id }) => {
  const { profile } = useAuthStore()
  const { selectedGroupId, selectGroup, showChannelInfo, setShowChannelInfo } = useAppStore()
  const queryClient = useQueryClient()

  const [community, setCommunity] = useState<GroupItem | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [memberRole, setMemberRole] = useState<'member' | 'moderator' | 'admin' | 'owner' | null>(null)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CommunityTab>('wall')
  const [settingsTab, setSettingsTab] = useState<'general' | 'privacy' | 'requests'>('general')

  const [isMuted, setIsMuted] = useState(false)
  const [isInputActive, setIsInputActive] = useState(false)
  const [showConfirmLeave, setShowConfirmLeave] = useState(false)

  const postsEndRef = useRef<HTMLDivElement>(null)
  const postsContainerRef = useRef<HTMLDivElement>(null)

  const isPrivileged = isOwner || memberRole === 'admin' || memberRole === 'moderator'
  const isManager = isOwner || memberRole === 'admin'

  const getSubscriberWord = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'подписчиков';
    if (mod10 === 1) return 'подписчик';
    if (mod10 >= 2 && mod10 <= 4) return 'подписчика';
    return 'подписчиков';
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (postsEndRef.current) {
      postsEndRef.current.scrollIntoView({ behavior })
    }
  }

  // Posts
  const [posts, setPosts] = useState<any[]>([])
  const [newPostImages, setNewPostImages] = useState<File[]>([])
  const [newPostPreviews, setNewPostPreviews] = useState<string[]>([])
  const [postingWall, setPostingWall] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const publishAsGroup = isManager

  const [sharePost, setSharePost] = useState<{id: string, content: string|null, images: string[]|null} | null>(null)

  const [isAddingPoll, setIsAddingPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const editorRef = useRef<HTMLDivElement>(null)
  const [isEditorEmpty, setIsEditorEmpty] = useState(true)
  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    quote: false,
    h1: false,
    h2: false,
    h3: false
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Members
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)



  // Settings
  const [settingsName, setSettingsName] = useState('')
  const [settingsDescription, setSettingsDescription] = useState('')
  const [settingsPrivacy, setSettingsPrivacy] = useState<'open' | 'closed' | 'private'>('open')
  const [settingsWall, setSettingsWall] = useState<'open' | 'restricted' | 'closed'>('open')
  const [settingsHideMembers, setSettingsHideMembers] = useState(false)
  const [settingsHidePhotos, setSettingsHidePhotos] = useState(false)
  const [settingsCover, setSettingsCover] = useState('')
  const [settingsIs18Plus, setSettingsIs18Plus] = useState(false)
  const [hasAccepted18Plus, setHasAccepted18Plus] = useState<boolean>(false)
  const [showColorSavedCheck, setShowColorSavedCheck] = useState(false)
  const [showGradientSavedCheck, setShowGradientSavedCheck] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)


  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (selectedGroupId) {
      setHasAccepted18Plus(localStorage.getItem(`vihton_channel_18_accepted_${selectedGroupId}`) === 'true')
    } else {
      setHasAccepted18Plus(false)
    }
  }, [selectedGroupId])

  useEffect(() => {
    if (!selectedGroupId) return
    
    const channelName = `group:${selectedGroupId}`
    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } })
    channelRef.current = channel
    
    channel
      .on('broadcast', { event: 'new-post' }, (response) => {
        const newPost = response.payload.post
        setPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev
          return [...prev, newPost]
        })
        setTimeout(() => scrollToBottom('smooth'), 100)
      })
      .on('broadcast', { event: 'post-reaction' }, (response) => {
        const { postId, reactions } = response.payload
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions } : p))
      })
      .on('broadcast', { event: 'post-view-increment' }, (response) => {
        const { postId } = response.payload
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, views_count: (p.views_count || 0) + 1 } : p))
      })
      .on('broadcast', { event: 'group-update' }, (response) => {
        const { cover_url, name, description, is_18_plus } = response.payload
        setCommunity(prev => prev ? { ...prev, cover_url, name, description, is_18_plus } : null)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [selectedGroupId])

  useEffect(() => {
    if (!selectedGroupId) return
    fetchCommunity()
  }, [selectedGroupId, profile?.id])

  useEffect(() => {
    const handleCountUpdate = (e: Event) => {
      const { groupId, count } = (e as CustomEvent).detail || {}
      if (groupId === selectedGroupId) {
        setCommunity(prev => prev ? { ...prev, members_count: count } : null)
      }
    }
    window.addEventListener('channel-members-count-updated', handleCountUpdate)
    return () => {
      window.removeEventListener('channel-members-count-updated', handleCountUpdate)
    }
  }, [selectedGroupId])





  const handleToggleMuteChannel = async () => {
    if (!profile || !selectedGroupId) return
    const nextMute = !isMuted
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ is_muted: nextMute })
        .eq('group_id', selectedGroupId)
        .eq('user_id', profile.id)
      
      if (error) throw error
      setIsMuted(nextMute)
      
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
      console.error('Error toggling mute for channel:', err)
    }
  }

  useEffect(() => {
    if (newPostImages.length === 0) {
      setNewPostPreviews([])
      return
    }
    const urls = newPostImages.map(f => URL.createObjectURL(f))
    setNewPostPreviews(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [newPostImages])



  useEffect(() => {
    const handleShowInfo = () => setShowChannelInfo(true)
    const handleShowSettings = () => {
      setActiveTab(prev => prev === 'settings' ? 'wall' : 'settings')
    }

    window.addEventListener('show-channel-info', handleShowInfo)
    window.addEventListener('show-channel-settings', handleShowSettings)

    return () => {
      window.removeEventListener('show-channel-info', handleShowInfo)
      window.removeEventListener('show-channel-settings', handleShowSettings)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'settings') {
      fetchPosts()
    } else {
      fetchJoinRequests()
    }
  }, [activeTab, selectedGroupId])

  useEffect(() => {
    if (showChannelInfo) {
      fetchMembers()
    }
  }, [showChannelInfo, selectedGroupId])

  useEffect(() => {
    const activeCover = (activeTab === 'settings' && isManager) 
      ? settingsCover 
      : community?.cover_url;

    if (!community || !activeCover) {
      document.documentElement.classList.remove('has-profile-bg');
      return;
    }
    const bgValue = activeCover.startsWith('linear-gradient') || activeCover.startsWith('#')
      ? activeCover
      : `url(${activeCover})`;
    document.documentElement.style.setProperty('--profile-cover-url', bgValue);
    document.documentElement.classList.add('has-profile-bg');

    return () => {
      document.documentElement.classList.remove('has-profile-bg');
    };
  }, [community?.cover_url, settingsCover, activeTab, isManager]);

  const fetchCommunity = async () => {
    if (!selectedGroupId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', selectedGroupId)
        .single()
      if (error) throw error
      setCommunity(data)

      if (data) {
        setSettingsName(data.name)
        setSettingsDescription(data.description || '')
        setSettingsPrivacy(data.privacy_type || 'open')
        setSettingsWall(data.wall_type || 'open')
        setSettingsHideMembers(data.hide_members || false)
        setSettingsHidePhotos(data.hide_photos || false)
        setSettingsCover(data.cover_url || '')
        setSettingsIs18Plus(data.is_18_plus || false)
      }

      if (profile) {
        const [memResult, reqResult] = await Promise.all([
          supabase
            .from('group_members')
            .select('*')
            .eq('group_id', selectedGroupId)
            .eq('user_id', profile.id)
            .maybeSingle(),
          supabase
            .from('group_join_requests')
            .select('id')
            .eq('group_id', selectedGroupId)
            .eq('user_id', profile.id)
            .maybeSingle()
        ])

        const memData = memResult.data
        setIsMember(!!memData)
        setMemberRole(memData ? memData.role : null)
        setIsOwner(data.owner_id === profile.id || (memData && memData.role === 'owner'))
        setIsMuted(!!memData?.is_muted)

        const reqData = reqResult.data
        setHasPendingRequest(!!reqData)
      } else {
        setIsMember(false)
        setMemberRole(null)
        setIsOwner(false)
        setIsMuted(false)
        setHasPendingRequest(false)
      }

      fetchPosts()
    } catch (err) {
      console.error('Error fetching community:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPosts = async () => {
    if (!selectedGroupId) return
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration),
          group:groups(id, name, avatar_url),
          poll:polls(
            id,
            question,
            options:poll_options(
              id,
              poll_id,
              text,
              votes_count
            )
          )
        `)
        .eq('group_id', selectedGroupId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setPosts((data || []) as any[])
      setTimeout(() => scrollToBottom('auto'), 50)
    } catch (err) {
      console.error('Error fetching posts:', err)
    }
  }

  const fetchMembers = async () => {
    if (!selectedGroupId) return
    setMembersLoading(true)
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('*, profile:profiles(id, full_name, avatar_url, username, role)')
        .eq('group_id', selectedGroupId)
        .order('joined_at', { ascending: true })

      if (error) throw error
      setMembers((data || []) as CommunityMember[])
    } catch (err) {
      console.error('Error fetching members:', err)
    } finally {
      setMembersLoading(false)
    }
  }



  // Settings Queries
  const fetchJoinRequests = async () => {
    if (!selectedGroupId) return
    setLoadingRequests(true)
    try {
      const { data, error } = await supabase
        .from('group_join_requests')
        .select('*, profile:profiles(id, full_name, avatar_url, username)')
        .eq('group_id', selectedGroupId)
      if (error) throw error
      setJoinRequests(data || [])
    } catch (err) {
      console.error('Error fetching join requests:', err)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleJoinLeave = async () => {
    if (!profile || !community) return
    try {
      let nextCount = community.members_count
      if (isMember) {
        await supabase
          .from('group_members')
          .delete()
          .eq('group_id', community.id)
          .eq('user_id', profile.id)
        setIsMember(false)
        setMemberRole(null)
        nextCount = Math.max(0, nextCount - 1)
      } else if (hasPendingRequest) {
        await supabase
          .from('group_join_requests')
          .delete()
          .eq('group_id', community.id)
          .eq('user_id', profile.id)
        setHasPendingRequest(false)
      } else {
        if (community.privacy_type === 'closed') {
          await supabase
            .from('group_join_requests')
            .insert({ group_id: community.id, user_id: profile.id })
          setHasPendingRequest(true)
        } else {
          await supabase
            .from('group_members')
            .insert({ group_id: community.id, user_id: profile.id, role: 'member' })
          setIsMember(true)
          setMemberRole('member')
          nextCount = nextCount + 1
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['feed-posts', profile.id] })

      setCommunity({ ...community, members_count: nextCount })
      window.dispatchEvent(new CustomEvent('channel-members-count-updated', { 
        detail: { groupId: community.id, count: nextCount } 
      }))
    } catch (err) {
      console.error('Join/leave error:', err)
      alert('Не удалось изменить статус подписки')
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop()
      const path = `community-post-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const publicUrl = await uploadToTelegram(file, path)
      return publicUrl
    } catch (err) {
      console.error('Upload error:', err)
      return null
    }
  }

  const convertHtmlToMarkdown = (html: string): string => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    const nodeToMd = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || ''
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return ''
      const el = node as HTMLElement
      const tag = el.tagName.toUpperCase()
      const inner = Array.from(el.childNodes).map(nodeToMd).join('')

      switch (tag) {
        case 'B':
        case 'STRONG': return `**${inner}**`
        case 'I':
        case 'EM': return `*${inner}*`
        case 'S':
        case 'STRIKE':
        case 'DEL': return `~~${inner}~~`
        case 'CODE': return `\`${inner}\``
        case 'U': return inner
        case 'BLOCKQUOTE': return inner.split('\n').map((l: string) => `> ${l}`).join('\n') + '\n'
        case 'H1': return `# ${inner}`
        case 'H2': return `## ${inner}`
        case 'H3': return `### ${inner}`
        case 'A': return `[${inner}](${el.getAttribute('href') || ''})`
        case 'BR': return '\n'
        case 'DIV': return (inner ? '\n' + inner : '')
        case 'P': return inner + '\n'
        default: return inner
      }
    }

    let result = Array.from(tempDiv.childNodes).map(nodeToMd).join('')
    result = result.replace(/^\n/, '')
    return result
  }



  const checkActiveStyles = () => {
    const isBold = document.queryCommandState('bold')
    const isItalic = document.queryCommandState('italic')
    const isStrikethrough = document.queryCommandState('strikeThrough')
    
    let isCode = false
    let isH1 = false
    let isH2 = false
    let isH3 = false
    let isQuote = false
    
    const selection = window.getSelection()
    if (selection && selection.anchorNode) {
      let node: Node | null = selection.anchorNode
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'CODE') isCode = true
        if (node.nodeName === 'H1') isH1 = true
        if (node.nodeName === 'H2') isH2 = true
        if (node.nodeName === 'H3') isH3 = true
        if (node.nodeName === 'BLOCKQUOTE') isQuote = true
        node = node.parentNode
      }
    }

    setActiveStyles({
      bold: isBold,
      italic: isItalic,
      strikethrough: isStrikethrough,
      code: isCode,
      quote: isQuote,
      h1: isH1,
      h2: isH2,
      h3: isH3
    })
  }



  const handleEditorInput = (e?: React.FormEvent<HTMLDivElement>) => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || ''
      setIsEditorEmpty(!text.trim())
    }
    if (!e) return

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const anchorNode = selection.anchorNode
      
      if (anchorNode && anchorNode.nodeType === Node.TEXT_NODE) {
        const textContent = anchorNode.textContent || ''
        const caretOffset = range.startOffset
        
        const beforeCaret = textContent.slice(0, caretOffset)
        const match = beforeCaret.match(/^(#{1,3})\s$/)
        if (match) {
          const hashtags = match[1]
          const level = hashtags.length
          
          anchorNode.textContent = textContent.slice(caretOffset)
          document.execCommand('formatBlock', false, `<h${level}>`)
        }
      }
    }

    checkActiveStyles()
  }

  const applyEditorFormatting = (command: string, value: string = '') => {
    document.execCommand(command, false, value)
    if (editorRef.current) {
      setIsEditorEmpty(!editorRef.current.innerText.trim() && newPostImages.length === 0 && !isAddingPoll)
    }
    setTimeout(checkActiveStyles, 10)
  }

  const wrapSelectionWithTag = (tag: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const selectedText = range.toString()
    if (!selectedText) return
    const el = document.createElement(tag)
    el.textContent = selectedText
    range.deleteContents()
    range.insertNode(el)
    range.setStartAfter(el)
    range.setEndAfter(el)
    selection.removeAllRanges()
    selection.addRange(range)
    if (editorRef.current) {
      setIsEditorEmpty(!editorRef.current.innerText.trim() && newPostImages.length === 0 && !isAddingPoll)
    }
    setTimeout(checkActiveStyles, 10)
  }

  const insertDate = () => {
    const now = new Date()
    const formatted = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand('insertText', false, formatted)
    if (editorRef.current) {
      setIsEditorEmpty(!editorRef.current.innerText.trim() && newPostImages.length === 0 && !isAddingPoll)
    }
  }



  const insertAtCaret = (text: string) => {
    if (editorRef.current) {
      editorRef.current.focus()
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const textNode = document.createTextNode(text)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        editorRef.current.innerHTML += text
      }
      setIsEditorEmpty(!editorRef.current.innerText.trim() && newPostImages.length === 0 && !isAddingPoll)
    }
    setTimeout(checkActiveStyles, 10)
  }

  // Wall Actions
  const handleCreatePost = async () => {
    if (!profile || !community || postingWall) return
    const textContent = editorRef.current ? convertHtmlToMarkdown(editorRef.current.innerHTML) : ''
    if (!textContent.trim() && newPostImages.length === 0 && !isAddingPoll) return
    setPostingWall(true)
    try {
      const imageUrls: string[] = []
      for (let i = 0; i < newPostImages.length; i++) {
        setUploadProgress(`Загрузка фото ${i + 1} из ${newPostImages.length}...`)
        const url = await uploadImage(newPostImages[i])
        if (url) imageUrls.push(url)
      }
      setUploadProgress('Публикация записи...')

      let createdPollId: string | null = null
      if (isAddingPoll && pollQuestion.trim()) {
        const { data: pollData, error: pollError } = await supabase
          .from('polls')
          .insert({ question: pollQuestion.trim() })
          .select()
          .single()

        if (pollError) throw pollError
        createdPollId = pollData.id

        const optionsToInsert = pollOptions
          .map(o => o.trim())
          .filter(o => o.length > 0)
          .map(o => ({ poll_id: createdPollId!, text: o }))

        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('poll_options')
            .insert(optionsToInsert)
          if (optionsError) throw optionsError
        }
      }

      const { data: insertData, error: insertError } = await supabase
        .from('posts')
        .insert({
          author_id: profile.id,
          content: textContent.trim(),
          images: imageUrls.length > 0 ? imageUrls : null,
          group_id: community.id,
          by_group: isManager && publishAsGroup,
          poll_id: createdPollId
        })
        .select()

      if (insertError) throw insertError

      let insertedPost = insertData && insertData[0]
      if (!insertedPost) {
        console.warn('No post data returned from insert. Creating fallback.')
        insertedPost = {
          id: 'temp-' + Math.random().toString(36).substring(2, 9),
          author_id: profile.id,
          content: textContent.trim(),
          images: imageUrls.length > 0 ? imageUrls : null,
          group_id: community.id,
          by_group: isManager && publishAsGroup,
          poll_id: createdPollId,
          created_at: new Date().toISOString()
        }
      }

      // Мгновенно скрываем лоадер
      setPostingWall(false)
      setUploadProgress(null)

      const { data: fullPost } = await supabase
        .from('posts')
        .select(`
          *, 
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, emoji_status, avatar_decoration),
          group:groups(id, name, avatar_url),
          poll:polls(
            id,
            question,
            options:poll_options(
              id,
              poll_id,
              text,
              votes_count
            )
          )
        `)
        .eq('id', insertedPost.id)
        .maybeSingle()

      const finalPost = fullPost || {
        ...insertedPost,
        author: {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          username: profile.username,
          role: profile.role || null,
          emoji_status: (profile as any).emoji_status || null,
          avatar_decoration: (profile as any).avatar_decoration || null
        },
        group: {
          id: community.id,
          name: community.name,
          avatar_url: community.avatar_url
        },
        poll: null
      }

      setPosts(prev => [...prev, finalPost])
      if (editorRef.current) {
        editorRef.current.innerHTML = ''
      }
      setIsEditorEmpty(true)
      setNewPostImages([])
      setIsAddingPoll(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setTimeout(() => scrollToBottom('smooth'), 50)

      // Броадкастим новый пост в канал группы (для тех, кто сейчас находится в канале)
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new-post',
          payload: { post: finalPost }
        })
      }

      // Рассылаем событие post:new всем участникам канала для вывода тост-уведомлений
      try {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', community.id)

        if (members) {
          members.forEach(member => {
            if (member.user_id !== profile.id) {
              const personalChan = supabase.channel(`user_calls:${member.user_id}`)
              personalChan.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                  personalChan.send({
                    type: 'broadcast',
                    event: 'post:new',
                    payload: { 
                      post: finalPost, 
                      group: { id: community.id, name: community.name, avatar_url: community.avatar_url } 
                    }
                  }).then(() => {
                    supabase.removeChannel(personalChan)
                  })
                }
              })
            }
          })
        }
      } catch (e) {
        console.error('Error broadcasting post notification:', e)
      }
    } catch (err) {
      console.error('Create post error:', err)
      const errMessage = err instanceof Error ? err.message : JSON.stringify(err)
      alert('Не удалось опубликовать запись: ' + errMessage)
    } finally {
      setPostingWall(false)
      setUploadProgress(null)
    }
  }

  const handleDeletePost = async (postId: string) => {
    try {
      await supabase.from('posts').delete().eq('id', postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err) {
      console.error('Delete post error:', err)
    }
  }

  // Settings Actions
  const handleSaveSettings = async () => {
    if (!community) return
    try {
      const { error } = await supabase
        .from('groups')
        .update({
          name: settingsName.trim(),
          description: settingsDescription.trim() || null,
          privacy_type: settingsPrivacy,
          wall_type: settingsWall,
          hide_members: settingsHideMembers,
          hide_photos: settingsHidePhotos,
          cover_url: settingsCover || null,
          is_18_plus: settingsIs18Plus
        })
        .eq('id', community.id)
      if (error) throw error

      setCommunity(prev => prev ? {
        ...prev,
        name: settingsName.trim(),
        description: settingsDescription.trim() || null,
        privacy_type: settingsPrivacy,
        wall_type: settingsWall,
        hide_members: settingsHideMembers,
        hide_photos: settingsHidePhotos,
        cover_url: settingsCover || null,
        is_18_plus: settingsIs18Plus
      } : null)

      // Рассылаем онлайн-обновление обложки и названия канала другим пользователям в канале
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'group-update',
          payload: { 
            cover_url: settingsCover || null,
            name: settingsName.trim(),
            description: settingsDescription.trim() || null,
            is_18_plus: settingsIs18Plus
          }
        })
      }

      alert('Настройки успешно сохранены')
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('Не удалось сохранить настройки')
    }
  }

  const handleAutoSaveCover = async (newCover: string, isGradient: boolean) => {
    if (!community) return
    setSettingsCover(newCover)
    setCommunity(prev => prev ? { ...prev, cover_url: newCover || null } : null)
    
    if (isGradient) {
      setShowGradientSavedCheck(true)
      setTimeout(() => setShowGradientSavedCheck(false), 1200)
    } else {
      setShowColorSavedCheck(true)
      setTimeout(() => setShowColorSavedCheck(false), 1200)
    }

    try {
      const { error } = await supabase
        .from('groups')
        .update({ cover_url: newCover || null })
        .eq('id', community.id)
      if (error) throw error

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'group-update',
          payload: { 
            cover_url: newCover || null,
            name: settingsName.trim(),
            description: settingsDescription.trim() || null
          }
        })
      }
    } catch (err) {
      console.error('Error auto-saving cover:', err)
    }
  }

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !community) return
    setUploadingAvatar(true)
    try {
      const url = await uploadImage(e.target.files[0])
      if (url) {
        const { error } = await supabase
          .from('groups')
          .update({ avatar_url: url })
          .eq('id', community.id)
        if (error) throw error
        setCommunity(prev => prev ? { ...prev, avatar_url: url } : null)
      }
    } catch (err) {
      console.error('Error uploading avatar:', err)
      alert('Ошибка при загрузке аватара')
    } finally {
      setUploadingAvatar(false)
    }
  }



  const handleApproveRequest = async (reqUserId: string) => {
    if (!selectedGroupId) return
    try {
      const { error: insErr } = await supabase
        .from('group_members')
        .insert({ group_id: selectedGroupId, user_id: reqUserId, role: 'member' })
      if (insErr) throw insErr

      await supabase
        .from('group_join_requests')
        .delete()
        .eq('group_id', selectedGroupId)
        .eq('user_id', reqUserId)

      fetchJoinRequests()
      fetchCommunity()
    } catch (err) {
      console.error('Error approving request:', err)
    }
  }

  const handleDeclineRequest = async (reqUserId: string) => {
    if (!selectedGroupId) return
    try {
      await supabase
        .from('group_join_requests')
        .delete()
        .eq('group_id', selectedGroupId)
        .eq('user_id', reqUserId)
      fetchJoinRequests()
    } catch (err) {
      console.error('Error declining request:', err)
    }
  }

  if (loading || !community) {
    return (
      <Panel id={id}>
        <Box position="sticky" insetBlockStart={0} style={{ zIndex: 10 }}>
          <PanelHeader fixed={false} before={<PanelHeaderBack onClick={() => selectGroup(null)} />}>
            Сообщество
          </PanelHeader>
        </Box>
        <Box style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner size="m" />
        </Box>
      </Panel>
    )
  }

  const isContentVisible = community.privacy_type === 'open' || isMember || isOwner
  const commentsDisabled = community.wall_type === 'closed'

  return (
    <>
      <Panel id={id}>
        <PanelHeader
          fixed={false}
          delimiter="none"
          className="desktop-hide-panel-header glass-island-header"
            before={<PanelHeaderBack onClick={() => {
              if (activeTab === 'settings') {
                setActiveTab('wall')
              } else {
                selectGroup(null)
              }
            }} />}
            after={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {activeTab !== 'settings' && isMember && (
                  <IconButton 
                    onClick={handleToggleMuteChannel} 
                    style={{ color: isMuted ? 'var(--vkui--color_text_secondary)' : '#0077ff', padding: 8 }}
                    aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                  >
                    {isMuted ? (
                      <Icon28NotificationDisableOutline width={24} height={24} style={{ opacity: 0.6 }} />
                    ) : (
                      <Icon28Notifications width={24} height={24} />
                    )}
                  </IconButton>
                )}
                {activeTab !== 'settings' && isManager && (
                  <IconButton onClick={() => setActiveTab('settings')} style={{ color: 'var(--vkui--color_text_secondary)', padding: 8 }} aria-label="Настройки">
                    <Icon28SettingsOutline width={24} height={24} />
                  </IconButton>
                )}
              </div>
            }
          >
            {activeTab === 'settings' ? (
              'Настройки канала'
            ) : (
              <div 
                onClick={() => setShowChannelInfo(true)} 
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
              >
                {community.avatar_url ? (
                  <Avatar size={36} src={community.avatar_url} />
                ) : (
                  <Avatar size={36} style={{ background: 'linear-gradient(135deg, #aa3bff 0%, var(--vkui--color_background_accent) 100%)' }}>
                    <Icon28UsersOutline width={20} height={20} />
                  </Avatar>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--vkui--color_text_primary)' }}>
                    {community.name}
                    {community.privacy_type === 'closed' && <span style={{ fontSize: 11, opacity: 0.6 }}>🔒</span>}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', fontWeight: 400 }}>
                    {community.members_count} {getSubscriberWord(community.members_count)}
                  </span>
                </div>
              </div>
            )}
          </PanelHeader>

        {community.is_18_plus && !hasAccepted18Plus && !isManager ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            minHeight: 'calc(100vh - 120px)',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.15) 0%, rgba(255, 149, 0, 0.1) 100%)',
              border: '2px solid rgba(255, 59, 48, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              boxShadow: '0 8px 24px rgba(255, 59, 48, 0.15)'
            }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#ff3b30' }}>18+</span>
            </div>
            
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--vkui--color_text_primary)', marginBottom: 12 }}>
              Предупреждение о контенте
            </h2>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '16px',
              padding: '16px 20px',
              maxWidth: 480,
              fontSize: 14,
              lineHeight: '1.6',
              color: 'var(--vkui--color_text_secondary)',
              marginBottom: 24,
              textAlign: 'left'
            }}>
              Этот канал содержит материалы возрастной категории <strong>18+</strong>.
              <br /><br />
              Контент, публикуемый в данном сообществе, может быть не предназначен для несовершеннолетних. Он может содержать деликатные темы, порнографические или эротические материалы, сцены насилия, нецензурную лексику или иную информацию, способную оказать негативное влияние на неокрепшую психику.
              <br /><br />
              Нажимая кнопку <strong>«Я согласен»</strong>, вы подтверждаете, что вам исполнилось 18 лет, и вы принимаете на себя полную ответственность за просмотр открытого контента.
            </div>
            
            <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 480 }}>
              <Button 
                stretched 
                size="l" 
                mode="secondary"
                onClick={() => selectGroup(null)}
                style={{ flex: 1 }}
              >
                Назад
              </Button>
              <Button 
                stretched 
                size="l" 
                onClick={() => {
                  localStorage.setItem(`vihton_channel_18_accepted_${community.id}`, 'true')
                  setHasAccepted18Plus(true)
                }}
                style={{
                  flex: 1.5,
                  background: 'linear-gradient(135deg, #aa3bff 0%, #0077ff 100%)',
                  border: 'none',
                  color: '#fff'
                }}
              >
                Я согласен
              </Button>
            </div>
          </div>
        ) : !isContentVisible ? (
          <div className="community-premium-card" style={{ margin: '16px' }}>
            <Box style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--vkui--color_text_secondary)' }}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🔒</span>
              <Text weight="2" style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>
                {community.privacy_type === 'closed' ? 'Это закрытый канал' : 'Это частный канал'}
              </Text>
              <Text style={{ fontSize: 13 }}>
                {community.privacy_type === 'closed'
                  ? 'Подайте заявку на вступление, чтобы получить доступ к публикациям.'
                  : 'Доступ к частному каналу предоставляется только по приглашению администрации.'}
              </Text>
              {!isOwner && (
                <div style={{ marginTop: 20 }}>
                  <Button 
                    mode={hasPendingRequest ? 'secondary' : 'primary'} 
                    onClick={handleJoinLeave}
                    disabled={community.privacy_type === 'private'}
                  >
                    {hasPendingRequest ? 'Заявка отправлена' : 'Подать заявку'}
                  </Button>
                </div>
              )}
            </Box>
          </div>
        ) : (
          <>
            {activeTab !== 'settings' && (
              <div className="tg-channel-content-container">
                {/* Лента сообщений канала */}
                <div 
                  ref={postsContainerRef}
                  style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '16px',
                    paddingBottom: isPrivileged ? '150px' : '75px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16
                  }}
                  className="tg-channel-posts-scroll"
                >
                  {posts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--vkui--color_text_secondary)', margin: 'auto' }}>
                      {isPrivileged ? 'Напишите первую публикацию в свой канал!' : 'В канале пока нет публикаций'}
                    </div>
                  ) : (
                    posts.map(post => (
                      <div key={post.id} className="tg-channel-post-wrapper" style={{
                        alignSelf: 'center',
                        width: '100%',
                        maxWidth: 600,
                      }}>
                        <PostCard
                          post={post}
                          onDeleteSuccess={handleDeletePost}
                          commentsDisabled={commentsDisabled}
                          isAdmin={isPrivileged}
                          hideGroupBadge
                          hideBookmark
                          isChannel
                          onShareClick={(p) => setSharePost({ id: p.id, content: p.content ?? null, images: p.images ?? null })}
                        />
                      </div>
                    ))
                  )}
                  <div ref={postsEndRef} />
                </div>

                {/* Нижняя панель управления */}
                {!isMember && !isOwner ? (
                  <div className="tg-channel-join-bar">
                    <Button 
                      mode="primary" 
                      size="l" 
                      stretched 
                      onClick={handleJoinLeave}
                      disabled={community.privacy_type === 'private'}
                      className="tg-channel-join-btn"
                    >
                      {hasPendingRequest ? 'Заявка отправлена' : 'Присоединиться к каналу'}
                    </Button>
                  </div>
                ) : (
                  <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 5, boxSizing: 'border-box' }}>
                    {!isPrivileged ? (
                      <div style={{ display: 'flex', width: '100%' }}>
                        <button
                          onClick={handleToggleMuteChannel}
                          style={{
                            width: '100%',
                            height: 42,
                            borderRadius: 21,
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            color: isMuted ? 'var(--vkui--color_text_secondary)' : 'var(--vkui--color_text_primary)',
                            fontSize: 14,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                            boxSizing: 'border-box',
                            padding: 0
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          }}
                        >
                          {isMuted ? (
                            <Icon28NotificationDisableOutline width={20} height={20} style={{ opacity: 0.6 }} />
                          ) : (
                            <Icon28VolumeOutline width={20} height={20} />
                          )}
                          <span>{isMuted ? 'Включить уведомления' : 'Убрать звук'}</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {postingWall && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(6px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 16,
                            zIndex: 100,
                            gap: 10
                          }}>
                            <Spinner size="s" style={{ color: '#fff' }} />
                            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
                              {uploadProgress || 'Публикация...'}
                            </div>
                          </div>
                        )}

                        {/* Превью прикрепленных картинок */}
                        {newPostImages.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, paddingBottom: 8, overflowX: 'auto' }}>
                            {newPostPreviews.map((url, i) => (
                              <div key={i} style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                                <img src={url} alt="upload" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                                <button
                                  onClick={() => {
                                    setNewPostImages(prev => prev.filter((_, idx) => idx !== i))
                                    if (editorRef.current) {
                                      const tag = ` [photo${i + 1}] `
                                      editorRef.current.innerHTML = editorRef.current.innerHTML.replace(tag, '')
                                      handleEditorInput()
                                    }
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: -4, right: -4,
                                    width: 16, height: 16,
                                    borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.7)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', fontSize: 8, fontWeight: 700
                                  }}
                                >✕</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Превью опроса */}
                        {isAddingPoll && (
                          <div style={{ background: 'rgba(0,119,255,0.08)', borderRadius: 12, padding: '10px 12px', marginBottom: 8, border: '1px solid rgba(0,119,255,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#0077ff' }}>📊 Опрос</span>
                              <button onClick={() => setIsAddingPoll(false)} style={{ background: 'none', border: 'none', color: 'var(--vkui--color_text_secondary)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
                            </div>
                            <input
                              type="text"
                              value={pollQuestion}
                              onChange={e => setPollQuestion(e.target.value)}
                              placeholder="Вопрос опроса"
                              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--vkui--color_text_primary)', marginBottom: 6, boxSizing: 'border-box', outline: 'none' }}
                            />
                            {pollOptions.map((opt, idx) => (
                              <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={e => { const next = [...pollOptions]; next[idx] = e.target.value; setPollOptions(next) }}
                                  placeholder={`Вариант ${idx + 1}`}
                                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: 'var(--vkui--color_text_primary)', outline: 'none' }}
                                />
                                {pollOptions.length > 2 && (
                                  <button onClick={() => setPollOptions(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--vkui--color_text_secondary)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                                )}
                              </div>
                            ))}
                            {pollOptions.length < 10 && (
                              <button onClick={() => setPollOptions(prev => [...prev, ''])} style={{ background: 'none', border: 'none', color: '#0077ff', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>+ Добавить вариант</button>
                            )}
                          </div>
                        )}

                        {/* Инструменты форматирования Telegram-style */}
                        <div className={`channel-bar-actions${isInputActive ? ' visible' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
                          {/* Bold */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => applyEditorFormatting('bold')}
                            title="Жирный"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: activeStyles.bold ? 'rgba(0,119,255,0.2)' : 'rgba(255,255,255,0.06)',
                              color: activeStyles.bold ? '#0077ff' : 'var(--vkui--color_text_secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, fontWeight: 700, transition: 'all 0.15s ease'
                            }}
                          >B</button>

                          {/* Italic */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => applyEditorFormatting('italic')}
                            title="Курсив"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: activeStyles.italic ? 'rgba(0,119,255,0.2)' : 'rgba(255,255,255,0.06)',
                              color: activeStyles.italic ? '#0077ff' : 'var(--vkui--color_text_secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, fontStyle: 'italic', fontWeight: 500, transition: 'all 0.15s ease'
                            }}
                          ><i>I</i></button>

                          {/* Strikethrough */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => applyEditorFormatting('strikeThrough')}
                            title="Зачёркнутый"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: activeStyles.strikethrough ? 'rgba(0,119,255,0.2)' : 'rgba(255,255,255,0.06)',
                              color: activeStyles.strikethrough ? '#0077ff' : 'var(--vkui--color_text_secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, textDecoration: 'line-through', transition: 'all 0.15s ease'
                            }}
                          >S</button>

                          {/* Quote */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => document.execCommand('formatBlock', false, 'blockquote')}
                            title="Цитата"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: activeStyles.quote ? 'rgba(0,119,255,0.2)' : 'rgba(255,255,255,0.06)',
                              color: activeStyles.quote ? '#0077ff' : 'var(--vkui--color_text_secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
                              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
                            </svg>
                          </button>

                          {/* Monospace / Code */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => wrapSelectionWithTag('code')}
                            title="Моноширинный (нажать для копирования)"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: activeStyles.code ? 'rgba(0,119,255,0.2)' : 'rgba(255,255,255,0.06)',
                              color: activeStyles.code ? '#0077ff' : 'var(--vkui--color_text_secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontFamily: 'monospace', transition: 'all 0.15s ease'
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="16 18 22 12 16 6"/>
                              <polyline points="8 6 2 12 8 18"/>
                            </svg>
                          </button>

                          {/* Date */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={insertDate}
                            title="Вставить дату"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: 'rgba(255,255,255,0.06)',
                              color: 'var(--vkui--color_text_secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                          </button>

                          {/* Poll */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setIsAddingPoll(!isAddingPoll); if (!isAddingPoll && pollOptions.length < 2) setPollOptions(['', '']) }}
                            title="Опрос"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: isAddingPoll ? 'rgba(0,119,255,0.2)' : 'rgba(255,255,255,0.06)',
                              color: isAddingPoll ? '#0077ff' : 'var(--vkui--color_text_secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 16, transition: 'all 0.15s ease'
                            }}
                          >📊</button>


                        </div>

                        {/* Строка ввода */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', boxSizing: 'border-box' }}>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Прикрепить фото"
                            className={`channel-bar-camera-btn ${isInputActive ? 'visible' : ''}`}
                          >
                            <Icon28CameraOutline width={22} height={22} />
                          </button>
                          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={e => {
                            if (e.target.files) {
                              const files = Array.from(e.target.files)
                              setNewPostImages(prev => {
                                const nextImages = [...prev, ...files].slice(0, 5)
                                let tags = ''
                                for (let i = prev.length; i < nextImages.length; i++) tags += ` [photo${i + 1}] `
                                insertAtCaret(tags)
                                return nextImages
                              })
                            }
                          }} />

                          <div className="channel-bar-input-wrap">
                            <div
                              ref={editorRef}
                              contentEditable
                              onFocus={() => setIsInputActive(true)}
                              onBlur={() => { if (isEditorEmpty && newPostImages.length === 0) setIsInputActive(false) }}
                              onInput={handleEditorInput}
                              onKeyUp={checkActiveStyles}
                              onMouseUp={checkActiveStyles}
                              onSelect={checkActiveStyles}
                              style={{ 
                                outline: 'none', 
                                border: 'none', 
                                fontSize: 14, 
                                minHeight: 18,
                                maxHeight: 120,
                                overflowY: 'auto',
                                overscrollBehavior: 'contain',
                                lineHeight: '18px', 
                                color: 'var(--vkui--color_text_primary)',
                                width: '100%',
                                wordBreak: 'break-word'
                              }}
                              {...({ placeholder: 'Написать в канал...' } as any)}
                            />
                          </div>

                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            disabled={(isEditorEmpty && newPostImages.length === 0 && !isAddingPoll) || postingWall}
                            onClick={handleCreatePost}
                            className={`channel-bar-send-btn ${isInputActive ? 'visible' : ''}`}
                          >
                            <Icon28SendOutline width={18} height={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && isManager && (() => {
              const PRESET_COLORS = [
                '#ff5e5b', '#ffb997', '#fcf6b1', '#5edc1f', '#00b4d8',
                '#0077b6', '#7209b7', '#f72585', '#4a5759', '#111215',
                '#a8dadc', '#457b9d', '#e63946', '#ffb703', '#2a9d8f'
              ];
              const PRESET_GRADIENTS = [
                'linear-gradient(135deg, #FF9a9e 0%, #Fecfef 100%)',
                'linear-gradient(135deg, #A1c4fd 0%, #C2e9fb 100%)',
                'linear-gradient(135deg, #Fbc2eb 0%, #A6c1ee 100%)',
                'linear-gradient(135deg, #Fd1d1d 0%, #Fc8c06 100%)',
                'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                'linear-gradient(135deg, #8a2387 0%, #E94057 50%, #F27121 100%)',
                'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
                'linear-gradient(135deg, #F12711 0%, #F5af19 100%)',
                'linear-gradient(135deg, #3a1c71 0%, #D76d77 50%, #Ffaf7b 100%)',
                'linear-gradient(135deg, #aa3bff 0%, #0077ff 100%)',
                'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
                'linear-gradient(135deg, #FF5F6D 0%, #FFC371 100%)',
                'linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%)',
                'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
                'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
              ];

              return (
                <div className="tg-channel-content-container">
                  <div className="hide-scrollbar channel-settings-container" style={{ 
                    padding: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 16,
                    overflowY: 'auto',
                    boxSizing: 'border-box',
                    paddingBottom: '120px',
                    WebkitOverflowScrolling: 'touch',
                    flex: 1
                  }}>
                  {/* Вкладки подменю для настроек канала */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--vkui--color_background_content)',
                    border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
                    borderRadius: '12px',
                    padding: '4px',
                    gap: '4px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    marginBottom: 4,
                    flexShrink: 0
                  }} className="hide-scrollbar">
                    <button 
                      className={`settings-tab-btn ${settingsTab === 'general' ? 'active' : ''}`}
                      onClick={() => setSettingsTab('general')}
                      style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >
                      Общее
                    </button>
                    <button 
                      className={`settings-tab-btn ${settingsTab === 'privacy' ? 'active' : ''}`}
                      onClick={() => setSettingsTab('privacy')}
                      style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >
                      Приватность
                    </button>
                    {community.privacy_type === 'closed' && (
                      <button 
                        className={`settings-tab-btn ${settingsTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setSettingsTab('requests')}
                        style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                      >
                        Заявки ({joinRequests.length})
                      </button>
                    )}
                  </div>

                  {settingsTab === 'general' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ position: 'relative', marginBottom: 8, borderRadius: 12, overflow: 'hidden' }}>
                        <div 
                          style={{
                            height: 120,
                            background: settingsCover
                              ? (settingsCover.startsWith('linear-gradient') || settingsCover.startsWith('#')
                                  ? settingsCover
                                  : `url(${settingsCover}) center/cover no-repeat`)
                              : 'linear-gradient(135deg, #aa3bff 0%, var(--vkui--color_background_accent) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            borderRadius: 12
                          }}
                        >
                          <div 
                            onClick={() => avatarInputRef.current?.click()}
                            style={{
                              width: 70,
                              height: 70,
                              borderRadius: '50%',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: '3px solid var(--vkui--color_background_page)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#19191a',
                              position: 'relative'
                            }}
                          >
                            {community?.avatar_url ? (
                              <img src={community.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Icon28UsersOutline width={28} height={28} style={{ color: 'var(--vkui--color_text_secondary)' }} />
                            )}
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              fontSize: 16
                            }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                            >
                              📷
                            </div>
                            {uploadingAvatar && <Spinner size="s" style={{ zIndex: 3 }} />}
                          </div>
                        </div>
                      </div>

                      <input 
                        type="file" 
                        ref={avatarInputRef} 
                        accept="image/*" 
                        hidden 
                        onChange={handleUploadAvatar}
                      />

                      {/* Палитра выбора цвета обложки */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Цвет обложки
                          </span>
                          {showColorSavedCheck && (
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="#0077ff" 
                              strokeWidth="3.5" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                              style={{
                                marginLeft: 8,
                                display: 'inline-block',
                                verticalAlign: 'middle',
                                animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
                              }}
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <div className="hide-scrollbar" style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 10, marginBottom: 16, paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
                          <div 
                            onClick={() => handleAutoSaveCover('', false)}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 10,
                              background: 'rgba(255, 255, 255, 0.05)',
                              cursor: 'pointer',
                              border: !settingsCover ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.15)',
                              boxShadow: !settingsCover ? '0 0 0 2px var(--vkui--color_background_accent)' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                              flexShrink: 0
                            }}
                          >
                            <span style={{ fontSize: 16, opacity: 0.6 }}>🚫</span>
                          </div>
                          {PRESET_COLORS.map(color => (
                            <div 
                              key={color}
                              onClick={() => handleAutoSaveCover(color, false)}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 10,
                                background: color,
                                cursor: 'pointer',
                                border: settingsCover === color ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.15)',
                                boxShadow: settingsCover === color ? '0 0 0 2px var(--vkui--color_background_accent)' : 'none',
                                transition: 'all 0.15s ease',
                                flexShrink: 0
                              }}
                            />
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Градиенты (Премиум) <span style={{ fontSize: 14, verticalAlign: 'middle', marginLeft: 2 }}>👑</span>
                          </span>
                          {showGradientSavedCheck && (
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="#0077ff" 
                              strokeWidth="3.5" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                              style={{
                                  marginLeft: 8,
                                  display: 'inline-block',
                                  verticalAlign: 'middle',
                                  animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                }}
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <div className="hide-scrollbar" style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 10, paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
                          <div 
                            onClick={() => handleAutoSaveCover('', true)}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 10,
                              background: 'rgba(255, 255, 255, 0.05)',
                              cursor: 'pointer',
                              border: !settingsCover ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.15)',
                              boxShadow: !settingsCover ? '0 0 0 2px var(--vkui--color_background_accent)' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                              flexShrink: 0
                            }}
                          >
                            <span style={{ fontSize: 16, opacity: 0.6 }}>🚫</span>
                          </div>
                          {PRESET_GRADIENTS.map(grad => (
                            <div 
                              key={grad}
                              onClick={() => handleAutoSaveCover(grad, true)}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 10,
                                background: grad,
                                cursor: 'pointer',
                                border: settingsCover === grad ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.15)',
                                boxShadow: settingsCover === grad ? '0 0 0 2px var(--vkui--color_background_accent)' : 'none',
                                transition: 'all 0.15s ease',
                                flexShrink: 0
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <FormItem top="Название сообщества" style={{ paddingLeft: 0, paddingRight: 0 }}>
                        <Input value={settingsName} onChange={e => setSettingsName(e.target.value)} />
                      </FormItem>
                      <FormItem top="Описание" style={{ paddingLeft: 0, paddingRight: 0 }}>
                        <textarea className="community-textarea" value={settingsDescription} onChange={e => setSettingsDescription(e.target.value)} rows={3} />
                      </FormItem>
                      <Button className="channel-settings-save-btn" stretched onClick={handleSaveSettings} size="l" style={{ marginTop: 12 }}>
                        Сохранить настройки
                      </Button>
                    </div>
                  )}

                  {settingsTab === 'privacy' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>Скрыть участников от обычных пользователей</span>
                          <Switch 
                            checked={settingsHideMembers} 
                            onChange={(e) => setSettingsHideMembers(e.target.checked)} 
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, color: 'var(--vkui--color_text_primary)' }}>Ограничение 18+</span>
                            <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)' }}>Канал содержит взрослый/деликатный контент</span>
                          </div>
                          <Switch 
                            checked={settingsIs18Plus} 
                            onChange={(e) => setSettingsIs18Plus(e.target.checked)} 
                          />
                        </div>
                      </div>

                      <Button className="channel-settings-save-btn" stretched onClick={handleSaveSettings} size="l" style={{ marginTop: 12 }}>
                        Сохранить настройки
                      </Button>
                    </div>
                  )}

                  {settingsTab === 'requests' && community.privacy_type === 'closed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {loadingRequests ? (
                        <Spinner />
                      ) : joinRequests.length === 0 ? (
                        <Box style={{ color: 'var(--vkui--color_text_secondary)', textAlign: 'center', padding: 8 }}>Нет активных заявок</Box>
                      ) : (
                        joinRequests.map(req => (
                          <SimpleCell
                            key={req.id}
                            before={<Avatar size={36} src={req.profile.avatar_url || undefined} />}
                            after={
                              <div style={{ display: 'flex', gap: 8 }}>
                                <Button size="s" mode="primary" onClick={() => handleApproveRequest(req.user_id)}>Принять</Button>
                                <Button size="s" mode="secondary" onClick={() => handleDeclineRequest(req.user_id)}>Отклонить</Button>
                              </div>
                            }
                          >
                            {req.profile.full_name}
                          </SimpleCell>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          </>
        )}
            {/* Info Drawer/Overlay */}
            {showChannelInfo && createPortal(
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--vkui--color_background_page)',
                zIndex: 10000,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box'
              }}>
                {/* Custom sticky header for the overlay */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))',
                  background: 'var(--vkui--color_background_modal_alpha, rgba(20, 20, 20, 0.65))',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}>
                  <button 
                    onClick={() => setShowChannelInfo(false)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--vkui--color_text_primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                      borderRadius: '50%',
                      transition: 'background-color 0.2s',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                  </button>
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--vkui--color_text_primary)' }}>
                    Информация
                  </span>
                </div>

                <div style={{ maxWidth: 600, width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
                  {/* Cover & Avatar */}
                  <div className="community-premium-card" style={{ padding: '24px 16px', margin: '0 0 16px 0', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2, padding: 0 }}>
                      <Avatar size={90} src={community.avatar_url || undefined} style={{ border: '4px solid var(--vkui--color_background_page)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        <Icon28UsersOutline width={45} height={45} />
                      </Avatar>
                      <Text weight="2" style={{ fontSize: 22, marginTop: 10, fontWeight: 700 }}>{community.name}</Text>
                      
                      {community.username && (
                        <span style={{ fontSize: 14, color: '#0077ff', marginTop: 4, fontWeight: 500 }}>
                          @{community.username}
                        </span>
                      )}

                      {community.num_id && isManager && (
                        <span style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)', marginTop: 2, opacity: 0.8 }}>
                          ID канала: {community.num_id}
                        </span>
                      )}

                      <span style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)', marginTop: 4 }}>
                        {community.members_count} {getSubscriberWord(community.members_count)}
                      </span>

                      <div style={{ display: 'flex', gap: 10, marginTop: 16, width: '100%' }}>
                        {!isOwner && isMember && (
                          <Button 
                            mode="secondary" 
                            appearance="negative"
                            stretched
                            onClick={() => setShowConfirmLeave(true)}
                          >
                            Покинуть канал
                          </Button>
                        )}
                        {isManager && (
                          <Button
                            mode="primary"
                            stretched
                            onClick={() => {
                              setActiveTab('settings')
                              setShowChannelInfo(false)
                            }}
                          >
                            Настройки канала
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Описание */}
                  <div className="community-premium-card" style={{ padding: '16px', margin: '0 0 16px 0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', marginBottom: 8 }}>Описание канала</div>
                    <Text style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                      {community.description || 'Описание отсутствует.'}
                    </Text>
                  </div>

                  {/* Настройки уведомлений */}
                  {isMember && (
                    <div className="community-premium-card" style={{ padding: 16, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <Text weight="2" style={{ fontSize: 14 }}>Уведомления</Text>
                        <Text style={{ fontSize: 12, color: 'var(--vkui--color_text_secondary)' }}>Получать push-уведомления о новых постах</Text>
                      </div>
                      <Switch 
                        checked={!isMuted} 
                        onChange={handleToggleMuteChannel} 
                      />
                    </div>
                  )}

                  {/* Список участников */}
                  {(!community.hide_members || isManager) && (
                    <div className="community-premium-card" style={{ padding: '16px', margin: '0 0 16px 0' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vkui--color_text_secondary)', marginBottom: 12 }}>Участники</div>
                      {membersLoading ? (
                        <Spinner />
                      ) : members.length === 0 ? (
                        <Text style={{ color: 'var(--vkui--color_text_secondary)', fontSize: 13 }}>Нет участников</Text>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {members.map(m => (
                            <SimpleCell
                              key={m.user_id}
                              before={<Avatar size={36} src={m.profile.avatar_url || undefined} />}
                              subtitle={`@${m.profile.username || 'user'}`}
                              style={{ padding: 0 }}
                              after={
                                m.user_id === profile?.id ? (
                                  <IconButton 
                                    onClick={handleToggleMuteChannel} 
                                    style={{ color: isMuted ? 'var(--vkui--color_text_secondary)' : '#0077ff', padding: 4 }}
                                    title={isMuted ? 'Включить уведомления' : 'Убрать звук'}
                                  >
                                    {isMuted ? (
                                      <Icon28NotificationDisableOutline width={20} height={20} style={{ opacity: 0.6 }} />
                                    ) : (
                                      <Icon28Notifications width={20} height={20} />
                                    )}
                                  </IconButton>
                                ) : isManager && m.user_id !== profile?.id ? (
                                  <Button 
                                    size="s" 
                                    mode="secondary" 
                                    appearance="negative" 
                                    onClick={async () => {
                                      if (confirm('Исключить участника из канала?')) {
                                        try {
                                          await supabase
                                            .from('group_members')
                                            .delete()
                                            .eq('group_id', selectedGroupId)
                                            .eq('user_id', m.user_id)
                                          
                                          fetchMembers()

                                          const { data: updatedG } = await supabase
                                            .from('groups')
                                            .select('members_count')
                                            .eq('id', selectedGroupId!)
                                            .single()
                                          if (updatedG && community) {
                                            setCommunity({ ...community, members_count: updatedG.members_count })
                                            window.dispatchEvent(new CustomEvent('channel-members-count-updated', { 
                                              detail: { groupId: selectedGroupId, count: updatedG.members_count } 
                                            }))
                                          }
                                        } catch (err) {
                                          console.error('Error kicking member:', err)
                                        }
                                      }
                                    }}
                                  >
                                    Исключить
                                  </Button>
                                ) : m.role === 'owner' ? (
                                  <span style={{ fontSize: 11, color: 'var(--vkui--color_text_accent)', fontWeight: 600 }}>Создатель</span>
                                ) : null
                              }
                            >
                              {m.profile.full_name}
                            </SimpleCell>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}

            {/* Confirm Leave Modal */}
            {showConfirmLeave && createPortal(
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
              onClick={() => setShowConfirmLeave(false)}
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
                      onClick={() => setShowConfirmLeave(false)}
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
                        await handleJoinLeave()
                        setShowConfirmLeave(false)
                        setShowChannelInfo(false)
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
      {sharePost && community && (
        <ChannelShareSheet
          post={sharePost}
          channelId={community.id}
          channelName={community.name}
          channelAvatar={community.avatar_url}
          onClose={() => setSharePost(null)}
        />
      )}
    </>
  )
}