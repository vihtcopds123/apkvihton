const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Fetching users to find a test target...');
  const { data: { users }, error: userErr } = await adminClient.auth.admin.listUsers();
  if (userErr) {
    console.error('Error listing users:', userErr);
    return;
  }
  
  if (users.length === 0) {
    console.log('No users found in auth.users');
    return;
  }

  // Find two users that have a conversation
  const { data: convs } = await adminClient.from('conversations').select('*').limit(5);
  console.log('Conversations:', convs);

  if (!convs || convs.length === 0) {
    console.log('No conversations found.');
    return;
  }

  // Use the first conversation
  const conv = convs[0];
  const userA_id = conv.participant_1;
  const userB_id = conv.participant_2;

  console.log(`Testing realtime between User A (${userA_id}) and User B (${userB_id}) in conversation ${conv.id}`);

  // Get user details
  const userA = users.find(u => u.id === userA_id);
  if (!userA) {
    console.error(`Could not find auth user for ID: ${userA_id}`);
    return;
  }

  console.log(`Logging in as User A: ${userA.email}`);

  // Create user A client
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Sign in as User A using admin API to create custom session/token
  // Actually, we can use adminClient.auth.admin.generateLink or we can sign in if we set a temporary password,
  // or we can just sign in with service_role using adminClient and use that... wait, to simulate the actual user
  // we must authenticate the userClient with User A's token.
  // How do we get a token for userA? We can generate a magic link or we can update userA's password to a test password and login,
  // or we can use administrative sign in (which doesn't require password).
  // Wait! In Supabase v2, we can call:
  // const { data: sessionData, error: sessionErr } = await adminClient.auth.admin.generateLink({
  //   type: 'login',
  //   email: userA.email
  // });
  // Wait, let's see if we can use a simpler way: adminClient.auth.admin.signInUser (not always available),
  // or we can just set the session on userClient using:
  // userClient.auth.setSession({ access_token: jwt, refresh_token: '' })
  // But how do we get the jwt? We can generate a token since we know the JWT secret of Supabase!
  // Wait! The JWT secret is not in .env.local.
  // But wait! Can we update the password of User A to 'password123' temporarily, login, then change it back?
  // Yes, we can update the user password using admin API:
  const oldPassword = 'temporaryPassword123';
  await adminClient.auth.admin.updateUserById(userA_id, { password: oldPassword });

  const { data: signInData, error: signInErr } = await userClient.auth.signInWithPassword({
    email: userA.email,
    password: oldPassword
  });

  if (signInErr) {
    console.error('Sign in error:', signInErr);
    return;
  }

  console.log('Successfully signed in as User A!');
  
  // Now let's subscribe as User A to:
  // 1. messages
  const userAMsgChannel = userClient
    .channel('user-a-messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      console.log('USER A CLIENT: RECEIVED MESSAGE:', payload);
    })
    .subscribe((status) => {
      console.log('USER A client messages subscription status:', status);
    });

  // 2. notifications
  const userANotifChannel = userClient
    .channel('user-a-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      console.log('USER A CLIENT: RECEIVED NOTIFICATION:', payload);
    })
    .subscribe((status) => {
      console.log('USER A client notifications subscription status:', status);
    });

  // Wait 4 seconds for subscriptions to become active, then insert a message from User B
  setTimeout(async () => {
    console.log('Inserting message from User B...');
    const { data: msgData, error: msgErr } = await adminClient
      .from('messages')
      .insert({
        conversation_id: conv.id,
        sender_id: userB_id,
        content: 'HELLO FROM USER B REALTIME TEST'
      })
      .select();

    if (msgErr) {
      console.error('Error inserting message:', msgErr);
    } else {
      console.log('Message inserted successfully:', msgData);
    }
  }, 4000);

  // Wait another 4 seconds, then exit
  setTimeout(() => {
    console.log('Test completed, exiting.');
    process.exit(0);
  }, 9000);
}

main().catch(console.error);
