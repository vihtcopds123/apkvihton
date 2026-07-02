import express from 'express';
import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOXz22wbQguxYIQ_LqEPIZMGkec4jXUbfaIoe4cXPf6b5CXq07UB4Z6gILuWMPpLndxdiq3Db9jGKvhzFfFn8zs';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'xiP30MaA6Lgk1FkxTYeIdoy2JHxEkZwePTSCWgirkh8';

webpush.setVapidDetails(
  'mailto:support@vihtclub.ru',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Endpoint called by Supabase custom trigger
app.post('/send', async (req, res) => {
  const { title, body, url, subscriptions } = req.body;

  if (!subscriptions || !Array.isArray(subscriptions)) {
    return res.status(400).json({ error: 'Missing subscriptions array' });
  }

  const payload = JSON.stringify({
    title: title || 'Vihton',
    body: body || 'Новое уведомление',
    url: url || '/'
  });

  console.log(`Sending push to ${subscriptions.length} devices...`);

  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      console.error('Failed to send push notification to subscription:', err.message);
    }
  });

  await Promise.all(sendPromises);
  return res.status(200).json({ status: 'success' });
});

const PORT = process.env.PORT || 8095;
app.listen(PORT, () => {
  console.log(`Push notifications server listening on port ${PORT}`);
});
