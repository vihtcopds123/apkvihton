import fs from 'fs';

const filePath = 'src/panels/ProfilePanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: AdminBadge replacement
const target1 = `              <AdminBadge username={profile.username} role={profile.role} roles={profile.roles ?? undefined} />`;
const replacement1 = `              {profile.id === '00000000-0000-0000-0000-000000000000'
                ? <span style={{ fontSize: 15, verticalAlign: 'middle' }}>🤖</span>
                : <AdminBadge username={profile.username} role={profile.role} roles={profile.roles ?? undefined} />
              }`;

// Target 2: status block
const target2 = `            {/* Row 2: Online status + bio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : '#8e8e93',
                flexShrink: 0
              }} />
              <Text style={{ fontSize: 13, color: (profile.status_preference !== 'offline' && profile.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60 * 1000) ? '#34c759' : 'var(--vkui--color_text_secondary)' }}>
                {profile.status_preference === 'offline'
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

const replacement2 = `            {/* Row 2: Online status + bio */}
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

// Clean windows carriage returns to make sure matching is exact
const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget1 = target1.replace(/\r\n/g, '\n');
const cleanReplacement1 = replacement1.replace(/\r\n/g, '\n');
const cleanTarget2 = target2.replace(/\r\n/g, '\n');
const cleanReplacement2 = replacement2.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget1) && cleanContent.includes(cleanTarget2)) {
  const newContent = cleanContent.replace(cleanTarget1, cleanReplacement1).replace(cleanTarget2, cleanReplacement2);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("ProfilePanel replacements completed successfully.");
} else {
  console.error("Target strings not found in ProfilePanel.tsx!");
}
