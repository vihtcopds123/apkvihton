import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `    return () => {
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(notifChannel)
    }`;

const replacement = `    // 3. Subscribe to blocks and mutes changes
    const blocksChannel = supabase
      .channel('global-blocks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_blocks_mutes'
      }, () => {
        useAppStore.getState().fetchMutesAndBlocks(user.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(blocksChannel)
    }`;

const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget = target.replace(/\r\n/g, '\n');
const cleanReplacement = replacement.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget)) {
  const newContent = cleanContent.replace(cleanTarget, cleanReplacement);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("App.tsx blocks subscription added successfully.");
} else {
  console.error("Target string not found in App.tsx!");
}
