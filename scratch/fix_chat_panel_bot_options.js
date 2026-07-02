import fs from 'fs';

const filePath = 'src/panels/ChatPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: options menu condition
const target1 = `                          {!isGroupChat && selectedChatParticipant && selectedChatParticipant.id !== profile?.id && profile && (`;
const replacement1 = `                          {!isGroupChat && selectedChatParticipant && selectedChatParticipant.id !== profile?.id && selectedChatParticipant.id !== '00000000-0000-0000-0000-000000000000' && profile && (`;

// Target 2: actions panel condition
const target2 = `                        {!isGroupChat && selectedChatParticipant && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>`;
const replacement2 = `                        {!isGroupChat && selectedChatParticipant && selectedChatParticipant.id !== '00000000-0000-0000-0000-000000000000' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>`;

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
  console.log("ChatPanel bot block/mute protections completed successfully.");
} else {
  console.error("Targets not found in ChatPanel.tsx!");
  if (!cleanContent.includes(cleanTarget1)) console.log("Failed: target1");
  if (!cleanContent.includes(cleanTarget2)) console.log("Failed: target2");
}
