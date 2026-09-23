const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Let's first fix the SyntaxError by sed replacing pedRows with filasPed
  // Then let's change 'liquidado' to 'entregado' in ventas.js line 134
  // And then check the DB enum just in case
  const cmds = [
    "sed -i 's/pedRows/filasPed/g' /var/www/restaurante-api/src/routes/ventas.js",
    "sed -i 's/estado = \\x27liquidado\\x27/estado = \\x27entregado\\x27/g' /var/www/restaurante-api/src/routes/ventas.js",
    "export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && pm2 restart restaurante-api",
    "sleep 2",
    "tail -n 20 /root/.pm2/logs/restaurante-api-error.log"
  ];
  
  conn.exec(cmds.join(' && '), (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('Result:', out);
      conn.end();
    }).on('data', data => out += data.toString()).stderr.on('data', data => out += data.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
