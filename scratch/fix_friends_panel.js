import fs from 'fs';

const filePath = 'src/panels/FriendsPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: TabType definition
const target1 = `type TabType = 'my_friends' | 'find_people' | 'requests'`;
const replacement1 = `type TabType = 'my_friends' | 'find_people' | 'requests' | 'blacklist'`;


// Target 2: Filtered lists and useEffect update
const target2 = `  const filteredProfiles = allProfiles.filter(p =>
    (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (`;

const replacement2 = `  const filteredProfiles = allProfiles.filter(p =>
    (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const blockedUsers = allProfiles.filter(p => blockedUserIds.has(p.id))
  const filteredBlockedUsers = blockedUsers.filter(p =>
    (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (`;


// Target 2.5: useEffect dependencies
const target3 = `  useEffect(() => {
    fetchFriendsAndData()
  }, [myProfile?.id, activeTab])`;

const replacement3 = `  useEffect(() => {
    fetchFriendsAndData()
  }, [myProfile?.id, activeTab, blockedUserIds.size])

  useEffect(() => {
    if (blockedUserIds.size === 0 && activeTab === 'blacklist') {
      setActiveTab('my_friends')
    }
  }, [blockedUserIds.size, activeTab])`;


// Target 3: Tabs bar rendering
const target4 = `      <Tabs>
        <TabsItem id="tab-my_friends" selected={activeTab === 'my_friends'} onClick={() => setActiveTab('my_friends')} aria-controls="friends-tab-content">
          Мои друзья
        </TabsItem>
        <TabsItem id="tab-requests" selected={activeTab === 'requests'} onClick={() => setActiveTab('requests')} aria-controls="friends-tab-content">
          Заявки ({requests.length})
        </TabsItem>
        <TabsItem id="tab-find_people" selected={activeTab === 'find_people'} onClick={() => setActiveTab('find_people')} aria-controls="friends-tab-content">
          Поиск людей
        </TabsItem>
      </Tabs>`;

const replacement4 = `      <Tabs>
        <TabsItem id="tab-my_friends" selected={activeTab === 'my_friends'} onClick={() => setActiveTab('my_friends')} aria-controls="friends-tab-content">
          Мои друзья
        </TabsItem>
        <TabsItem id="tab-requests" selected={activeTab === 'requests'} onClick={() => setActiveTab('requests')} aria-controls="friends-tab-content">
          Заявки ({requests.length})
        </TabsItem>
        <TabsItem id="tab-find_people" selected={activeTab === 'find_people'} onClick={() => setActiveTab('find_people')} aria-controls="friends-tab-content">
          Поиск людей
        </TabsItem>
        {blockedUserIds.size > 0 && (
          <TabsItem id="tab-blacklist" selected={activeTab === 'blacklist'} onClick={() => setActiveTab('blacklist')} aria-controls="friends-tab-content">
            Черный список
          </TabsItem>
        )}
      </Tabs>`;


// Target 4: Group content rendering
const target5 = `        ) : activeTab === 'requests' ? (
          requests.length === 0 ? (
            <Box className="prod-empty-state-card">Нет входящих заявок</Box>
          ) : (
            requests.map(req => (
              <SimpleCell
                key={req.id}
                before={<CustomAvatar size={40} src={req.requester.avatar_url} name={req.requester.full_name} id={req.requester.id} decoration={req.requester.avatar_decoration} />}
                subtitle="хочет добавиться в друзья"
                after={
                  <Button
                    size="s"
                    disabled={processingTargetId === req.requester.id}
                    loading={processingTargetId === req.requester.id}
                    onClick={(e) => { e.stopPropagation(); handleFriendAction(req.requester.id) }}
                  >
                    Принять
                  </Button>
                }
                onClick={() => selectProfile(req.requester.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{req.requester.full_name}</span>
                  <AdminBadge username={req.requester.username} role={req.requester.role} />
                </div>
              </SimpleCell>
            ))
          )
        ) : (`;

const replacement5 = `        ) : activeTab === 'requests' ? (
          requests.length === 0 ? (
            <Box className="prod-empty-state-card">Нет входящих заявок</Box>
          ) : (
            requests.map(req => (
              <SimpleCell
                key={req.id}
                before={<CustomAvatar size={40} src={req.requester.avatar_url} name={req.requester.full_name} id={req.requester.id} decoration={req.requester.avatar_decoration} />}
                subtitle="хочет добавиться в друзья"
                after={
                  <Button
                    size="s"
                    disabled={processingTargetId === req.requester.id}
                    loading={processingTargetId === req.requester.id}
                    onClick={(e) => { e.stopPropagation(); handleFriendAction(req.requester.id) }}
                  >
                    Принять
                  </Button>
                }
                onClick={() => selectProfile(req.requester.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{req.requester.full_name}</span>
                  <AdminBadge username={req.requester.username} role={req.requester.role} />
                </div>
              </SimpleCell>
            ))
          )
        ) : activeTab === 'blacklist' ? (
          filteredBlockedUsers.length === 0 ? (
            <Box className="prod-empty-state-card">Черный список пуст</Box>
          ) : (
            filteredBlockedUsers.map(user => (
              <SimpleCell
                key={user.id}
                before={<CustomAvatar size={40} src={user.avatar_url} name={user.full_name} id={user.id} decoration={user.avatar_decoration} />}
                subtitle={user.username ? \`@\${user.username}\` : ''}
                after={
                  <Button
                    size="s"
                    mode="secondary"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await toggleBlockUser(myProfile!.id, user.id)
                    }}
                  >
                    Разблокировать
                  </Button>
                }
                onClick={() => selectProfile(user.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{user.full_name}</span>
                  <AdminBadge username={user.username} role={user.role} />
                </div>
              </SimpleCell>
            ))
          )
        ) : (`;

const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget1 = target1.replace(/\r\n/g, '\n');
const cleanReplacement1 = replacement1.replace(/\r\n/g, '\n');
const cleanTarget2 = target2.replace(/\r\n/g, '\n');
const cleanReplacement2 = replacement2.replace(/\r\n/g, '\n');
const cleanTarget3 = target3.replace(/\r\n/g, '\n');
const cleanReplacement3 = replacement3.replace(/\r\n/g, '\n');
const cleanTarget4 = target4.replace(/\r\n/g, '\n');
const cleanReplacement4 = replacement4.replace(/\r\n/g, '\n');
const cleanTarget5 = target5.replace(/\r\n/g, '\n');
const cleanReplacement5 = replacement5.replace(/\r\n/g, '\n');

if (
  cleanContent.includes(cleanTarget1) && 
  cleanContent.includes(cleanTarget2) && 
  cleanContent.includes(cleanTarget3) && 
  cleanContent.includes(cleanTarget4) && 
  cleanContent.includes(cleanTarget5)
) {
  const newContent = cleanContent
    .replace(cleanTarget1, cleanReplacement1)
    .replace(cleanTarget2, cleanReplacement2)
    .replace(cleanTarget3, cleanReplacement3)
    .replace(cleanTarget4, cleanReplacement4)
    .replace(cleanTarget5, cleanReplacement5);
  fs.writeFileSync(filePath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("FriendsPanel blacklist changes completed successfully.");
} else {
  console.error("Target strings not found in FriendsPanel.tsx!");
  if (!cleanContent.includes(cleanTarget1)) console.log("Failed: target1");
  if (!cleanContent.includes(cleanTarget2)) console.log("Failed: target2");
  if (!cleanContent.includes(cleanTarget3)) console.log("Failed: target3");
  if (!cleanContent.includes(cleanTarget4)) console.log("Failed: target4");
  if (!cleanContent.includes(cleanTarget5)) console.log("Failed: target5");
}
