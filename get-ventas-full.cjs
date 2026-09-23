const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Get full ventas.js content
  conn.exec('cat /var/www/restaurante-api/src/routes/ventas.js', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log(out);
      conn.end();
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
