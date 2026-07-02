import fs from 'fs';

const filePath = 'src/store/useAppStore.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: toggleMuteUser
const target1 = `    toggleMuteUser: async (myId, targetId) => {
      const { mutedUserIds } = get()`;

const replacement1 = `    toggleMuteUser: async (myId, targetId) => {
      if (targetId === '00000000-0000-0000-0000-000000000000') return;
      const { mutedUserIds } = get()`;

// Target 2: toggleBlockUser
const target2 = `    toggleBlockUser: async (myId, targetId) => {
      const { blockedUserIds } = get()`;

const replacement2 = `    toggleBlockUser: async (myId, targetId) => {
      if (targetId === '00000000-0000-0000-0000-000000000000') return;
      const { blockedUserIds } = get()`;

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
  console.log("useAppStore block/mute protections added successfully.");
} else {
  console.error("Targets not found in useAppStore.ts!");
}
