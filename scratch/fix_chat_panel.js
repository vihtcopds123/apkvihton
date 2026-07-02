import fs from 'fs';

const filePath = 'c:/Users/andnv/Desktop/ID VH/src/panels/ChatPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetRegex = /\/\/ === SYSTEM BROADCAST[\s\S]+?await supabase\.from\('messages'\)\.insert\(broadcastInserts\)[\s\S]+?\}[\s\S]+?\}[\s\S]+?\}/;

// Let's print if it matches
const match = content.match(targetRegex);
if (!match) {
  console.error("Regex did not match!");
  process.exit(1);
}

console.log("Matched block length:", match[0].length);

const replacement = `// === SYSTEM BROADCAST: viht sends to system chat -> broadcast to ALL users via RPC ===
      if (isSystemChat && isVihtAdmin) {
        const { data, error } = await supabase
          .rpc('broadcast_system_message', {
            p_content: text || null,
            p_image_url: imageUrl,
            p_video_url: videoUrl,
            p_audio_id: trackToSend?.id || null
          });
        if (error) throw error;
        if (data) {
          const fullData = {
            ...data,
            audio: trackToSend || null
          };
          setMessages(prev => prev.map(m => m.id === tempId ? fullData : m));
        }
      }`;

content = content.replace(targetRegex, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Replacement completed successfully.");
