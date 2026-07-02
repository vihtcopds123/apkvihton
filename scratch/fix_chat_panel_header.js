import fs from 'fs';

const filePath = 'src/panels/ChatPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target string to replace (using a robust substring that matches the exact text in the file)
const target = `                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="v-chat-header-name">
                          {selectedChatParticipant.id === profile?.id ? 'Избранное' : isGroupChat ? (selectedChatParticipant.group_name || 'Группа') : selectedChatParticipant.full_name}
                        </span>
                        {!isGroupChat && selectedChatParticipant.id !== profile?.id && <AdminBadge username={selectedChatParticipant.username} role={selectedChatParticipant.role} />}
                        {!isGroupChat && selectedChatParticipant.id !== profile?.id && isPartnerTyping && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'typing-pencil 1.4s infinite', flexShrink: 0 }}>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            <path d="m15 5 4 4"/>
                          </svg>
                        )}
                      </div>
                      <span className={\`v-chat-header-status \${isPartnerTyping ? 'typing' : isGroupChat ? 'offline' : selectedChatParticipant.id === profile?.id ? 'offline' : (selectedChatParticipant.status_preference !== 'offline' && isRecentlyOnline(selectedChatParticipant.last_seen)) ? 'online' : 'offline'}\`}>
                        {isGroupChat
                          ? (isPartnerTyping ? 'кто-то печатает...' : \`\${selectedChatParticipant.members_count || groupMembers.length || '?'} участников\`)
                          : selectedChatParticipant.id === profile?.id ? 'Вы общаетесь сами с собой'
                          : isPartnerTyping ? 'печатает...'
                          : selectedChatParticipant.status_preference === 'offline' ? 'Скрыть статус'
                          : formatLastSeen(selectedChatParticipant.last_seen || null)
                        }
                      </span>`;

const replacement = `                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span 
                          className="v-chat-header-name"
                          style={selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000' ? { color: '#ff9800', fontWeight: 'bold' } : undefined}
                        >
                          {selectedChatParticipant.id === profile?.id ? 'Избранное' : isGroupChat ? (selectedChatParticipant.group_name || 'Группа') : selectedChatParticipant.full_name}
                        </span>
                        {!isGroupChat && selectedChatParticipant.id !== profile?.id && (
                          selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000'
                            ? <span style={{ fontSize: 13, verticalAlign: 'middle' }}>🤖</span>
                            : <AdminBadge username={selectedChatParticipant.username} role={selectedChatParticipant.role} />
                        )}
                        {!isGroupChat && selectedChatParticipant.id !== profile?.id && isPartnerTyping && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'typing-pencil 1.4s infinite', flexShrink: 0 }}>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            <path d="m15 5 4 4"/>
                          </svg>
                        )}
                      </div>
                      <span className={\`v-chat-header-status \${isPartnerTyping ? 'typing' : isGroupChat ? 'offline' : selectedChatParticipant.id === profile?.id ? 'offline' : selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000' ? 'online' : (selectedChatParticipant.status_preference !== 'offline' && isRecentlyOnline(selectedChatParticipant.last_seen)) ? 'online' : 'offline'}\`}>
                        {isGroupChat
                          ? (isPartnerTyping ? 'кто-то печатает...' : \`\${selectedChatParticipant.members_count || groupMembers.length || '?'} участников\`)
                          : selectedChatParticipant.id === profile?.id ? 'Вы общаетесь сами с собой'
                          : isPartnerTyping ? 'печатает...'
                          : selectedChatParticipant.id === '00000000-0000-0000-0000-000000000000' ? 'Бот'
                          : selectedChatParticipant.status_preference === 'offline' ? 'Скрыть статус'
                          : formatLastSeen(selectedChatParticipant.last_seen || null)
                        }
                      </span>`;

// Clean windows carriage returns to make sure matching is exact
const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget = target.replace(/\r\n/g, '\n');
const cleanReplacement = replacement.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget)) {
  const newContent = cleanContent.replace(cleanTarget, cleanReplacement);
  // Restore original Windows line endings if they were there
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("Header replacement completed successfully.");
} else {
  console.error("Target string not found in ChatPanel.tsx!");
}
