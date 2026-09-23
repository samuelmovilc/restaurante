const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Get the full .env to find db credentials
  conn.exec('cat /var/www/restaurante-api/.env', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('.env:', out);
      
      // Also check docker containers with db-like names
      conn.exec('docker ps --format "{{.Names}}: {{.Ports}}"', (err2, stream2) => {
        let out2 = '';
        stream2.on('close', () => {
          console.log('Docker containers:', out2);
          conn.end();
        }).on('data', d => out2 += d.toString()).stderr.on('data', d => out2 += d.toString());
      });
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
