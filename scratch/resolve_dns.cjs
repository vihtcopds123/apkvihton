const dns = require('dns');

console.log('Resolving DNS for vihtclub.ru...');
dns.resolve4('vihtclub.ru', (err, addresses) => {
  if (err) {
    console.error('DNS resolve error:', err);
  } else {
    console.log('IP addresses for vihtclub.ru:', addresses);
  }
});
