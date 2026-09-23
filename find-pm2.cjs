const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('which pm2 || find / -name pm2 -type f -executable 2>/dev/null | head -n 3', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('PM2 Paths:', out);
      conn.end();
    }).on('data', data => out += data.toString()).stderr.on('data', data => out += data.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
