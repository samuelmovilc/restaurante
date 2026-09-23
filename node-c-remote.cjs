const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('node -c /var/www/restaurante-api/src/routes/ventas.js', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('Result:', out);
      conn.end();
    }).on('data', data => out += data.toString()).stderr.on('data', data => out += data.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
