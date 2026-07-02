import fs from 'fs';

const filePath = 'src/panels/ConversationsPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: State injection (dashed comment)
const target1 = `  // ── Chat folders state ────────────────────────────────────────────────────
  const [folders, setFolders] = useState<ChatFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null) // null = "Все"
  const [showFolderCreate, setShowFolderCreate] = useState(false)`;

const replacement1 = `  // ── Chat folders state ────────────────────────────────────────────────────
  const [folders, setFolders] = useState<ChatFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null) // null = "Все"
  const [showFolderCreate, setShowFolderCreate] = useState(false)

  // Archived conversations state
  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('archived_conversations') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('archived_conversations', JSON.stringify(archivedIds))
  }, [archivedIds])

  useEffect(() => {
    if (archivedIds.length === 0 && activeFolderId === '__archive__') {
      setActiveFolderId(null)
    }
  }, [archivedIds, activeFolderId])

  const touchTimerRef = React.useRef<any>(null)
  const isLongPressRef = React.useRef(false)`;


// Target 2: Folder filtering (dashed comment)
const target2 = `  // ── Filter conversations by active folder ─────────────────────────────────
  const filteredConversations = (() => {
    if (activeFolderId === null) return conversations // "Все"
    if (activeFolderId === '__groups__') return conversations.filter(c => c.is_group) // "Группы"
    const folder = folders.find(f => f.id === activeFolderId)
    if (!folder) return conversations
    return conversations.filter(c => folder.conversation_ids.includes(c.id))
  })()`;

const replacement2 = `  // ── Filter conversations by active folder ─────────────────────────────────
  const filteredConversations = (() => {
    const nonArchived = conversations.filter(c => !archivedIds.includes(c.id))
    const archived = conversations.filter(c => archivedIds.includes(c.id))

    if (activeFolderId === '__archive__') {
      return archived
    }
    if (activeFolderId === null) return nonArchived // "Все"
    if (activeFolderId === '__groups__') return nonArchived.filter(c => c.is_group) // "Группы"
    const folder = folders.find(f => f.id === activeFolderId)
    if (!folder) return nonArchived
    return nonArchived.filter(c => folder.conversation_ids.includes(c.id))
  })()`;


// Target 3: Sorting (dashed comment, remove Favorites permanent pinning)
const target3 = `      // ── 4. Sort ────────────────────────────────────────────────────────────
      allConvs.sort((a, b) => {
        const isSavedA = !a.is_group && a.participant.id === profile.id
        const isSavedB = !b.is_group && b.participant.id === profile.id
        if (isSavedA && !isSavedB) return -1
        if (!isSavedA && isSavedB) return 1

        const isPinnedA = a.pinned_by?.includes(profile.id)
        const isPinnedB = b.pinned_by?.includes(profile.id)
        if (isPinnedA && !isPinnedB) return -1
        if (!isPinnedA && isPinnedB) return 1
        if (isPinnedA && isPinnedB) return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()

        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })`;

const replacement3 = `      // ── 4. Sort ────────────────────────────────────────────────────────────
      allConvs.sort((a, b) => {
        const isPinnedA = a.pinned_by?.includes(profile.id)
        const isPinnedB = b.pinned_by?.includes(profile.id)
        if (isPinnedA && !isPinnedB) return -1
        if (!isPinnedA && isPinnedB) return 1
        if (isPinnedA && isPinnedB) return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()

        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })`;


// Target 4: Tabs rendering
const target4 = `      {/* Folder tabs */}
      <div style={{ padding: '12px 4px 0', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <button
          onClick={() => setActiveFolderId(null)}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === null ? 600 : 400, background: activeFolderId === null ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === null ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
        >
          Все
        </button>
        <button
          onClick={() => setActiveFolderId('__groups__')}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === '__groups__' ? 600 : 400, background: activeFolderId === '__groups__' ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === '__groups__' ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
        >
          Группы
        </button>`;

const replacement4 = `      {/* Folder tabs */}
      <div style={{ padding: '12px 4px 0', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <button
          onClick={() => setActiveFolderId(null)}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === null ? 600 : 400, background: activeFolderId === null ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === null ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
        >
          Все
        </button>
        <button
          onClick={() => setActiveFolderId('__groups__')}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === '__groups__' ? 600 : 400, background: activeFolderId === '__groups__' ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === '__groups__' ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
        >
          Группы
        </button>
        {archivedIds.length > 0 && (
          <button
            onClick={() => setActiveFolderId('__archive__')}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeFolderId === '__archive__' ? 600 : 400, background: activeFolderId === '__archive__' ? '#007aff' : 'var(--vkui--color_background_secondary)', color: activeFolderId === '__archive__' ? '#fff' : 'var(--vkui--color_text_primary)', transition: 'all 0.15s' }}
          >
            Архив
          </button>
        )}`;


// Target 5: Touch events & onClick longpress bypass
const target5 = `            return (
              <React.Fragment key={c.id}>
                <div
                  className={\`conversation-card \${hasUnread ? 'is-unread' : ''} \${isPinned ? 'is-pinned' : ''}\`}
                  onClick={() => {
                    if (c.is_group) {
                      selectChat(c.id, {
                        id: c.id,
                        full_name: c.group_name || 'Группа',
                        avatar_url: c.group_avatar_url || null,
                        is_online: false,
                        username: null,
                        is_group: true,
                        group_name: c.group_name,
                        group_avatar_url: c.group_avatar_url,
                        created_by: c.created_by,
                        members_count: c.members_count
                      })
                    } else {
                      selectChat(c.id, c.participant)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    const menuWidth = 180
                    const menuHeight = 160
                    let x = e.clientX, y = e.clientY
                    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
                    if (x < 10) x = 10
                    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
                    if (y < 10) y = 10
                    setContextMenu({ visible: true, x, y, conv: c })
                  }}
                >`;

const replacement5 = `            return (
              <React.Fragment key={c.id}>
                <div
                  className={\`conversation-card \${hasUnread ? 'is-unread' : ''} \${isPinned ? 'is-pinned' : ''}\`}
                  onTouchStart={(e) => {
                    const touch = e.touches[0]
                    const x = touch.clientX
                    const y = touch.clientY
                    isLongPressRef.current = false
                    touchTimerRef.current = setTimeout(() => {
                      isLongPressRef.current = true
                      setContextMenu({ visible: true, x, y, conv: c })
                    }, 600)
                  }}
                  onTouchEnd={() => {
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
                  }}
                  onTouchMove={() => {
                    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
                  }}
                  onClick={() => {
                    if (isLongPressRef.current) {
                      isLongPressRef.current = false
                      return
                    }
                    if (c.is_group) {
                      selectChat(c.id, {
                        id: c.id,
                        full_name: c.group_name || 'Группа',
                        avatar_url: c.group_avatar_url || null,
                        is_online: false,
                        username: null,
                        is_group: true,
                        group_name: c.group_name,
                        group_avatar_url: c.group_avatar_url,
                        created_by: c.created_by,
                        members_count: c.members_count
                      })
                    } else {
                      selectChat(c.id, c.participant)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    const menuWidth = 180
                    const menuHeight = 160
                    let x = e.clientX, y = e.clientY
                    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
                    if (x < 10) x = 10
                    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
                    if (y < 10) y = 10
                    setContextMenu({ visible: true, x, y, conv: c })
                  }}
                >`;


// Target 6: Conversation title & system bot badge / status formatting (with 'Закреплён')
const target6 = `                          <span className="conversation-card__title">
                            {isSavedMessages ? 'Избранное' : c.is_group ? (c.group_name || 'Группа') : c.participant.full_name}
                          </span>
                          {!isSavedMessages && !c.is_group && <AdminBadge username={c.participant.username} role={c.participant.role} />}
                          {c.is_group && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--vkui--color_text_secondary)" style={{ opacity: 0.5, flexShrink: 0 }}>
                              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                          )}
                          {isPinned && (
                            <span className="conversation-card__pin" title="Закреплён">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        {(() => {
                          const statusText = formatParticipantStatus(c.participant.last_seen, c.participant.status_preference, c.members_count, c.is_group)
                          return statusText ? (
                            <span style={{ fontSize: 11, color: 'var(--vkui--color_text_secondary)', opacity: 0.65, lineHeight: 1.2, display: 'block', marginTop: 1 }}>
                              {statusText}
                            </span>
                          ) : null
                        })()}`;

const replacement6 = `                          <span 
                            className="conversation-card__title"
                            style={(!c.is_group && c.participant.id === '00000000-0000-0000-0000-000000000000') ? { color: '#ff9800', fontWeight: 'bold' } : undefined}
                          >
                            {isSavedMessages ? 'Избранное' : c.is_group ? (c.group_name || 'Группа') : c.participant.full_name}
                          </span>
                          {!isSavedMessages && !c.is_group && (
                            c.participant.id === '00000000-0000-0000-0000-000000000000'
                              ? <span style={{ fontSize: 13, verticalAlign: 'middle', marginLeft: 4 }}>🤖</span>
                              : <AdminBadge username={c.participant.username} role={c.participant.role} />
                          )}
                          {c.is_group && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--vkui--color_text_secondary)" style={{ opacity: 0.5, flexShrink: 0 }}>
                              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                          )}
                          {isPinned && (
                            <span className="conversation-card__pin" title="Закреплён">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        {(() => {
                          const statusText = c.participant?.id === '00000000-0000-0000-0000-000000000000'
                            ? 'Бот'
                            : formatParticipantStatus(c.participant?.last_seen, c.participant?.status_preference, c.members_count, c.is_group)
                          return statusText ? (
                            <span style={{ fontSize: 11, color: c.participant?.id === '00000000-0000-0000-0000-000000000000' ? '#4caf50' : 'var(--vkui--color_text_secondary)', opacity: c.participant?.id === '00000000-0000-0000-0000-000000000000' ? 0.95 : 0.65, lineHeight: 1.2, display: 'block', marginTop: 1 }}>
                              {statusText}
                            </span>
                          ) : null
                        })()}`;


// Target 7: Context Menu Items (with 'Прочитано')
const target7 = `      {/* Context Menu */}
      {contextMenu.visible && contextMenu.conv && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }} className="custom-context-menu" onClick={e => e.stopPropagation()}>
          {contextMenu.conv.participant.id !== profile?.id && (
            <button onClick={() => handleTogglePin(contextMenu.conv!)} className="context-menu-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>{contextMenu.conv.pinned_by?.includes(profile?.id || '') ? 'Открепить' : 'Закрепить'}</span>
            </button>
          )}
          <button onClick={() => handleMarkAsRead(contextMenu.conv!)} className="context-menu-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Прочитано</span>
          </button>
          {contextMenu.conv.participant.id !== profile?.id && (`;

const replacement7 = `      {/* Context Menu */}
      {contextMenu.visible && contextMenu.conv && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }} className="custom-context-menu" onClick={e => e.stopPropagation()}>
          {contextMenu.conv.participant.id !== profile?.id && (
            <button onClick={() => handleTogglePin(contextMenu.conv!)} className="context-menu-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>{contextMenu.conv.pinned_by?.includes(profile?.id || '') ? 'Открепить' : 'Закрепить'}</span>
            </button>
          )}
          <button onClick={() => handleMarkAsRead(contextMenu.conv!)} className="context-menu-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Прочитано</span>
          </button>

          {/* Archive / Unarchive Option */}
          <button 
            onClick={() => {
              const isArchived = archivedIds.includes(contextMenu.conv!.id)
              if (isArchived) {
                setArchivedIds(prev => prev.filter(id => id !== contextMenu.conv!.id))
              } else {
                setArchivedIds(prev => [...prev, contextMenu.conv!.id])
              }
              setContextMenu(prev => ({ ...prev, visible: false }))
            }} 
            className="context-menu-item"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M21 8v13H3V8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <span>{archivedIds.includes(contextMenu.conv!.id) ? 'Убрать из архива' : 'В архив'}</span>
          </button>

          {contextMenu.conv.participant.id !== profile?.id && (`.replace(/\r\n/g, '\n');

// Clean windows carriage returns to make sure matching is exact
const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget1 = target1.replace(/\r\n/g, '\n');
const cleanReplacement1 = replacement1.replace(/\r\n/g, '\n');
const cleanTarget2 = target2.replace(/\r\n/g, '\n');
const cleanReplacement2 = replacement2.replace(/\r\n/g, '\n');
const cleanTarget3 = target3.replace(/\r\n/g, '\n');
const cleanReplacement3 = replacement3.replace(/\r\n/g, '\n');
const cleanTarget4 = target4.replace(/\r\n/g, '\n');
const cleanReplacement4 = replacement4.replace(/\r\n/g, '\n');
const cleanTarget5 = target5.replace(/\r\n/g, '\n');
const cleanReplacement5 = replacement5.replace(/\r\n/g, '\n');
const cleanTarget6 = target6.replace(/\r\n/g, '\n');
const cleanReplacement6 = replacement6.replace(/\r\n/g, '\n');
const cleanTarget7 = target7.replace(/\r\n/g, '\n');
const cleanReplacement7 = replacement7.replace(/\r\n/g, '\n');

if (
  cleanContent.includes(cleanTarget1) && 
  cleanContent.includes(cleanTarget2) && 
  cleanContent.includes(cleanTarget3) && 
  cleanContent.includes(cleanTarget4) && 
  cleanContent.includes(cleanTarget5) && 
  cleanContent.includes(cleanTarget6) && 
  cleanContent.includes(cleanTarget7)
) {
  const newContent = cleanContent
    .replace(cleanTarget1, cleanReplacement1)
    .replace(cleanTarget2, cleanReplacement2)
    .replace(cleanTarget3, cleanReplacement3)
    .replace(cleanTarget4, cleanReplacement4)
    .replace(cleanTarget5, cleanReplacement5)
    .replace(cleanTarget6, cleanReplacement6)
    .replace(cleanTarget7, cleanReplacement7);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("ConversationsPanel replacements completed successfully.");
} else {
  console.error("Target strings not found in ConversationsPanel.tsx!");
  if (!cleanContent.includes(cleanTarget1)) console.log("Failed: target1");
  if (!cleanContent.includes(cleanTarget2)) console.log("Failed: target2");
  if (!cleanContent.includes(cleanTarget3)) console.log("Failed: target3");
  if (!cleanContent.includes(cleanTarget4)) console.log("Failed: target4");
  if (!cleanContent.includes(cleanTarget5)) console.log("Failed: target5");
  if (!cleanContent.includes(cleanTarget6)) console.log("Failed: target6");
  if (!cleanContent.includes(cleanTarget7)) console.log("Failed: target7");
}
