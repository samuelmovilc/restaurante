const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /var/www/restaurante-api/src/routes/pedidos.js', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      const fs = require('fs');
      fs.writeFileSync('pedidos-remote-full.js', out, 'utf8');
      console.log('Done. Lines:', out.split('\n').length);
      conn.end();
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
