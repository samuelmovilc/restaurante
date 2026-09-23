const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /var/www/restaurante-api/src/server.js', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      fs.writeFileSync('server-remote.js', out);
      console.log('Saved to server-remote.js');
      conn.end();
    }).on('data', data => out += data.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
