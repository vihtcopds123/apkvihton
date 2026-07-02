const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufihkyhvvqfusgavndmh.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxMzAzMCwiZXhwIjoyMDk3ODg5MDMwfQ.wZl0WCdoV7Ywa7DfaeINo129n0D4nrbV8vsIwXjL_b0';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaWhreWh2dnFmdXNnYXZuZG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTMwMzAsImV4cCI6MjA5Nzg4OTAzMH0.QP_2pBEBHZcjqEnKAA20lU0ti5C9YmosYu_-MAWyOu4';

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: { users } } = await adminClient.auth.admin.listUsers();
  const userA = users[0];
  console.log(`Using user A: ${userA.email} (${userA.id})`);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const oldPassword = 'temporaryPassword123';
  await adminClient.auth.admin.updateUserById(userA.id, { password: oldPassword });

  const { data: signInData, error: signInErr } = await userClient.auth.signInWithPassword({
    email: userA.email,
    password: oldPassword
  });

  if (signInErr) {
    console.error('Sign in error:', signInErr);
    return;
  }

  console.log('Signed in successfully.');

  userClient
    .channel('notifications-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      console.log('REALTIME NOTIFICATION INSERT RECEIVED IN USER CLIENT:', payload);
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  setTimeout(async () => {
    console.log('Inserting notification...');
    const { data, error } = await adminClient
      .from('notifications')
      .insert({
        user_id: userA.id,
        type: 'like',
        from_user_id: userA.id // send it to himself for test
      })
      .select();

    if (error) console.error('Notification insert error:', error);
    else console.log('Notification inserted:', data);
  }, 4000);

  setTimeout(() => {
    console.log('Done.');
    process.exit(0);
  }, 9000);
}

main().catch(console.error);
