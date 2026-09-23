const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  let content = fs.readFileSync('ventas-remote.js', 'utf8');
  content = content.replace(/pedRows/g, 'filasPed');
  content = content.replace(/estado = 'liquidado'/g, "estado = 'entregado'");
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/var/www/restaurante-api/src/routes/ventas.js');
    writeStream.on('close', () => {
      console.log('File successfully uploaded via SFTP.');
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && pm2 restart restaurante-api && sleep 2 && tail -n 20 /root/.pm2/logs/restaurante-api-error.log', (err2, stream2) => {
        let out = '';
        stream2.on('close', () => {
          console.log('PM2 Output:', out);
          conn.end();
        }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
      });
    });
    writeStream.write(content);
    writeStream.end();
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
