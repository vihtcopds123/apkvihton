import fs from 'fs';

const filePath = 'c:/Users/andnv/Desktop/ID VH/.agents/AGENTS.md';
let content = fs.readFileSync(filePath, 'utf8');

// Check if the rule is already there to prevent double append
if (!content.includes('Критические правила реалтайма')) {
  const rule = `

## Критические правила реалтайма и триггеров
- НИКОГДА не ломайте конфигурацию Supabase Realtime и не удаляйте таблицы из публикации \`supabase_realtime\` (особенно \`messages\`, \`notifications\`, \`conversations\`, \`profiles\`, \`groups\`, \`conversation_members\`).
- ОБЯЗАТЕЛЬНО следите за тем, чтобы триггеры на таблицах \`messages\` и \`notifications\` не вызывали необработанных исключений, так как это приведет к откату всей транзакции отправки сообщения и сломает чат.
- НЕ меняйте фильтры подписок на реалтайм-каналы в \`ChatPanel.tsx\` и \`ConversationsPanel.tsx\` без тестирования мгновенного обновления сообщений и списков чатов.
`;
  content += rule;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Rule appended successfully.");
} else {
  console.log("Rule already exists.");
}
