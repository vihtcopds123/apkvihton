import fs from 'fs';

const filePath = 'src/components/MessageItem.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: Bubble container class/style configuration
const target1 = `          <div
            data-message-id={msg.id}
            data-is-me={isMe ? 'true' : 'false'}
            data-is-deleted={msg.is_deleted ? 'true' : 'false'}
            data-is-pinned={isPinned ? 'true' : 'false'}
            data-message-content={msg.content || ''}
            className={\`v-chat-bubble \${isMe ? 'me' : 'other'} \${isMediaOnly ? 'media-only' : ''} \${msg.is_deleted ? 'deleted' : ''} virtualized-item\`}
            style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '65%', outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : isPinned ? '1px solid rgba(0,122,255,0.3)' : 'none', outlineOffset: 2 }}`;

const replacement1 = `          <div
            data-message-id={msg.id}
            data-is-me={isMe ? 'true' : 'false'}
            data-is-deleted={msg.is_deleted ? 'true' : 'false'}
            data-is-pinned={isPinned ? 'true' : 'false'}
            data-message-content={msg.content || ''}
            className={msg.sender_id === '00000000-0000-0000-0000-000000000000' 
              ? 'virtualized-item' 
              : \`v-chat-bubble \${isMe ? 'me' : 'other'} \${isMediaOnly ? 'media-only' : ''} \${msg.is_deleted ? 'deleted' : ''} virtualized-item\`
            }
            style={msg.sender_id === '00000000-0000-0000-0000-000000000000'
              ? {
                  alignSelf: 'center',
                  textAlign: 'center',
                  margin: '10px auto',
                  padding: '8px 14px',
                  borderRadius: 16,
                  background: 'var(--vkui--color_background_secondary)',
                  border: '1px solid var(--vkui--color_separator_primary_alpha, rgba(255,255,255,0.08))',
                  color: 'var(--vkui--color_text_primary)',
                  fontSize: 13,
                  fontWeight: 500,
                  maxWidth: '85%',
                  lineHeight: 1.4,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6
                }
              : { 
                  alignSelf: isMe ? 'flex-end' : 'flex-start', 
                  maxWidth: '65%', 
                  outline: isSearchMatch ? '2px solid #007aff' : isAnyMatch ? '1px solid rgba(0,122,255,0.4)' : isPinned ? '1px solid rgba(0,122,255,0.3)' : 'none', 
                  outlineOffset: 2 
                }
            }`;

// Target 2: Timestamp positioning
const target2 = `        <div style={{ fontSize: '10px', color: 'var(--vkui--color_text_secondary)', marginTop: '3px', marginBottom: '2px', padding: '0 4px', alignSelf: isMe ? 'flex-end' : 'flex-start', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85 }}>`;

const replacement2 = `        <div style={{ fontSize: '10px', color: 'var(--vkui--color_text_secondary)', marginTop: '3px', marginBottom: '2px', padding: '0 4px', alignSelf: msg.sender_id === '00000000-0000-0000-0000-000000000000' ? 'center' : isMe ? 'flex-end' : 'flex-start', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85 }}>`;

// Clean windows carriage returns to make sure matching is exact
const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget1 = target1.replace(/\r\n/g, '\n');
const cleanReplacement1 = replacement1.replace(/\r\n/g, '\n');
const cleanTarget2 = target2.replace(/\r\n/g, '\n');
const cleanReplacement2 = replacement2.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget1) && cleanContent.includes(cleanTarget2)) {
  const newContent = cleanContent
    .replace(cleanTarget1, cleanReplacement1)
    .replace(cleanTarget2, cleanReplacement2);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("MessageItem replacements completed successfully.");
} else {
  console.error("Target strings not found in MessageItem.tsx!");
}
