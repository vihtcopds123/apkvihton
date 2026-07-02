const net = require('net');

const ports = [22, 80, 443];
const host = '194.5.78.150';

ports.forEach(port => {
  const socket = new net.Socket();
  console.log(`Connecting to ${host}:${port}...`);
  
  socket.setTimeout(3000);
  
  socket.connect(port, host, () => {
    console.log(`Successfully connected to ${host}:${port}`);
    socket.destroy();
  });
  
  socket.on('error', (err) => {
    console.error(`Error connecting to ${host}:${port}:`, err.message);
  });
  
  socket.on('timeout', () => {
    console.error(`Timeout connecting to ${host}:${port}`);
    socket.destroy();
  });
});
