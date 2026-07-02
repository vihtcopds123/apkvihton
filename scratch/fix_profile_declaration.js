import fs from 'fs';

const filePath = 'src/panels/ProfilePanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `  const targetId = selectedProfileId || myProfile?.id
  const hasBlockedMe = profile ? blockedByUserIds.has(profile.id) : false
  const queryClient = useQueryClient()
  const { data: profile = null } = useProfile(targetId)`;

const replacement = `  const targetId = selectedProfileId || myProfile?.id
  const queryClient = useQueryClient()
  const { data: profile = null } = useProfile(targetId)
  const hasBlockedMe = profile ? blockedByUserIds.has(profile.id) : false`;

const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget = target.replace(/\r\n/g, '\n');
const cleanReplacement = replacement.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget)) {
  const newContent = cleanContent.replace(cleanTarget, cleanReplacement);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("ProfilePanel declaration order fixed successfully.");
} else {
  console.error("Target string not found in ProfilePanel.tsx!");
}
