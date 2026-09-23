const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('npx pm2 restart restaurante-api && sleep 2 && npx pm2 logs restaurante-api --lines 20 --nostream', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log(out);
      conn.end();
    }).on('data', data => out += data.toString()).stderr.on('data', data => out += data.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
