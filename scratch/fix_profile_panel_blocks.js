import fs from 'fs';

const filePath = 'src/panels/ProfilePanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: Store destructuring
const target1 = `  const { 
    selectedProfileId, selectProfile, selectChat, mutedUserIds, blockedUserIds, toggleMuteUser, toggleBlockUser, activeStory, activePanel
  } = useAppStore()
  
  const targetId = selectedProfileId || myProfile?.id`;

const replacement1 = `  const { 
    selectedProfileId, selectProfile, selectChat, mutedUserIds, blockedUserIds, blockedByUserIds, toggleMuteUser, toggleBlockUser, activeStory, activePanel
  } = useAppStore()
  
  const targetId = selectedProfileId || myProfile?.id
  const hasBlockedMe = profile ? blockedByUserIds.has(profile.id) : false`;


// Target 2: Action buttons hiding/message button filtering
const target2 = `          {/* Action buttons */}
          <div className="profile-action-buttons profile-actions-wrapper" style={{ display: 'flex', gap: 10, paddingBottom: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            {isOwnProfile ? (
              <></>
            ) : (
              <>
                {profile.id !== '00000000-0000-0000-0000-000000000000' && (
                  <>
                    <Button 
                      before={<Icon28MessageOutline />} 
                      size="m" 
                      onClick={handleOpenDirectChat} 
                      className="profile-btn-message"
                    >
                      {!isMobile && <span className="profile-btn-text">Сообщение</span>}
                    </Button>`;

const replacement2 = `          {/* Action buttons */}
          <div className="profile-action-buttons profile-actions-wrapper" style={{ display: 'flex', gap: 10, paddingBottom: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            {isOwnProfile || hasBlockedMe ? (
              <></>
            ) : (
              <>
                {profile.id !== '00000000-0000-0000-0000-000000000000' && (
                  <>
                    {!blockedUserIds.has(profile.id) && (
                      <Button 
                        before={<Icon28MessageOutline />} 
                        size="m" 
                        onClick={handleOpenDirectChat} 
                        className="profile-btn-message"
                      >
                        {!isMobile && <span className="profile-btn-text">Сообщение</span>}
                      </Button>
                    )}`;


// Target 3: Online status
const target3 = `            {/* Row 2: Online status + bio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: profile.id === '00000000-0000-0000-0000-000000000000' ? '#34c759' : (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : '#8e8e93',
                flexShrink: 0
              }} />
              <Text style={{ fontSize: 13, color: profile.id === '00000000-0000-0000-0000-000000000000' ? '#34c759' : (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : 'var(--vkui--color_text_secondary)' }}>
                {profile.id === '00000000-0000-0000-0000-000000000000'
                  ? 'Бот'
                  : profile.status_preference === 'offline'
                    ? 'скрыт статус'
                    : (profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000)
                      ? 'в сети'
                      : profile.last_seen
                        ? (() => {
                            const diff = Math.floor((Date.now() - new Date(profile.last_seen).getTime()) / 60000)
                            if (diff < 60) return \`был(а) \${diff} мин. назад\`
                            const h = Math.floor(diff / 60)
                            if (h < 24) return \`был(а) \${h} ч. назад\`
                            const d = Math.floor(h / 24)
                            if (d === 1) return 'был(а) вчера'
                            if (d < 7) return \`был(а) \${d} дн. назад\`
                            return \`был(а) \${new Date(profile.last_seen).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}\`
                          })()
                        : 'не в сети'
                }
              </Text>
            </div>`;

const replacement3 = `            {/* Row 2: Online status + bio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: hasBlockedMe ? '#8e8e93' : profile.id === '00000000-0000-0000-0000-000000000000' ? '#34c759' : (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : '#8e8e93',
                flexShrink: 0
              }} />
              <Text style={{ fontSize: 13, color: hasBlockedMe ? 'var(--vkui--color_text_secondary)' : profile.id === '00000000-0000-0000-0000-000000000000' ? '#34c759' : (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : 'var(--vkui--color_text_secondary)' }}>
                {hasBlockedMe
                  ? 'никогда не заходил'
                  : profile.id === '00000000-0000-0000-0000-000000000000'
                    ? 'Бот'
                    : profile.status_preference === 'offline'
                      ? 'скрыт статус'
                      : (profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000)
                        ? 'в сети'
                        : profile.last_seen
                          ? (() => {
                              const diff = Math.floor((Date.now() - new Date(profile.last_seen).getTime()) / 60000)
                              if (diff < 60) return \`был(а) \${diff} мин. назад\`
                              const h = Math.floor(diff / 60)
                              if (h < 24) return \`был(а) \${h} ч. назад\`
                              const d = Math.floor(h / 24)
                              if (d === 1) return 'был(а) вчера'
                              if (d < 7) return \`был(а) \${d} дн. назад\`
                              return \`был(а) \${new Date(profile.last_seen).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}\`
                            })()
                          : 'не в сети'
                }
              </Text>
            </div>`;


// Target 4: Info & Stats block start
const target4_start = `          {/* Info & Stats - Expandable Block inside profile-card */}
          <div style={{
            width: '100%',
            marginTop: 12,
            borderTop: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))',
            overflow: 'hidden'
          }}>`;

const replacement4_start = `          {/* Info & Stats - Expandable Block inside profile-card */}
          {!hasBlockedMe && (
            <div style={{
              width: '100%',
              marginTop: 12,
              borderTop: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255, 255, 255, 0.08))',
              overflow: 'hidden'
            }}>`;

// Target 4: Info & Stats block end
const target4_end = `                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single main column layout */}
      <div className="profile-main-column"`;

const replacement4_end = `                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Single main column layout */}
      <div className="profile-main-column"`;


// Target 5: Wrapper for profile-main-column content
const target5_start = `      {/* Single main column layout */}
      <div className="profile-main-column" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 0 }}>`;

const replacement5_start = `      {/* Single main column layout */}
      <div className="profile-main-column" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 0 }}>
        {!hasBlockedMe && (
          <>`;

// Target 5: End of column content wrap
const target5_end = `              ))
            )
          )}
    </div>
  </div>`;

const replacement5_end = `              ))
            )
          )}
          </>
        )}
    </div>
  </div>`;

// Clean windows carriage returns to make sure matching is exact
const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget1 = target1.replace(/\r\n/g, '\n');
const cleanReplacement1 = replacement1.replace(/\r\n/g, '\n');
const cleanTarget2 = target2.replace(/\r\n/g, '\n');
const cleanReplacement2 = replacement2.replace(/\r\n/g, '\n');
const cleanTarget3 = target3.replace(/\r\n/g, '\n');
const cleanReplacement3 = replacement3.replace(/\r\n/g, '\n');
const cleanTarget4Start = target4_start.replace(/\r\n/g, '\n');
const cleanReplacement4Start = replacement4_start.replace(/\r\n/g, '\n');
const cleanTarget4End = target4_end.replace(/\r\n/g, '\n');
const cleanReplacement4End = replacement4_end.replace(/\r\n/g, '\n');
const cleanTarget5Start = target5_start.replace(/\r\n/g, '\n');
const cleanReplacement5Start = replacement5_start.replace(/\r\n/g, '\n');
const cleanTarget5End = target5_end.replace(/\r\n/g, '\n');
const cleanReplacement5End = replacement5_end.replace(/\r\n/g, '\n');

if (
  cleanContent.includes(cleanTarget1) && 
  cleanContent.includes(cleanTarget2) && 
  cleanContent.includes(cleanTarget3) && 
  cleanContent.includes(cleanTarget4Start) && 
  cleanContent.includes(cleanTarget4End) && 
  cleanContent.includes(cleanTarget5Start) && 
  cleanContent.includes(cleanTarget5End)
) {
  const newContent = cleanContent
    .replace(cleanTarget1, cleanReplacement1)
    .replace(cleanTarget2, cleanReplacement2)
    .replace(cleanTarget3, cleanReplacement3)
    .replace(cleanTarget4Start, cleanReplacement4Start)
    .replace(cleanTarget4End, cleanReplacement4End)
    .replace(cleanTarget5Start, cleanReplacement5Start)
    .replace(cleanTarget5End, cleanReplacement5End);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("ProfilePanel block adjustments completed successfully.");
} else {
  console.error("Target strings not found in ProfilePanel.tsx!");
  if (!cleanContent.includes(cleanTarget1)) console.log("Failed: target1");
  if (!cleanContent.includes(cleanTarget2)) console.log("Failed: target2");
  if (!cleanContent.includes(cleanTarget3)) console.log("Failed: target3");
  if (!cleanContent.includes(cleanTarget4Start)) console.log("Failed: target4_start");
  if (!cleanContent.includes(cleanTarget4End)) console.log("Failed: target4_end");
  if (!cleanContent.includes(cleanTarget5Start)) console.log("Failed: target5_start");
  if (!cleanContent.includes(cleanTarget5End)) console.log("Failed: target5_end");
}
