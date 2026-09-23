const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // First find which DB is in use
  conn.exec('cat /var/www/restaurante-api/.env | grep -E "DB_NAME|DB_DATABASE|DATABASE"', (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('ENV DB:', out);
      conn.end();
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
