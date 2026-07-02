import fs from 'fs';

async function testHealth() {
  try {
    const res = await fetch('https://vihtclub.ru/push-api/health');
    const json = await res.json();
    console.log('Push API Health status:', json);
  } catch (err) {
    console.error('Failed to fetch health status:', err.message);
  }
}

testHealth();
