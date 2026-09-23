const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

// Fixed pedidos.js - line 170: remove 'liquidado' from valid states since it's not in DB ENUM
const pedidosContent = fs.readFileSync('pedidos-remote-full.js', 'utf8');
const fixedPedidos = pedidosContent.replace(
  `const estados = ['pendiente', 'preparacion', 'listo', 'entregado', 'cancelado', 'liquidado'];`,
  `const estados = ['pendiente', 'preparacion', 'listo', 'entregado', 'cancelado'];`
);

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP err:', err); return; }
    
    const ws = sftp.createWriteStream('/var/www/restaurante-api/src/routes/pedidos.js');
    ws.on('close', () => {
      console.log('pedidos.js uploaded successfully');
      
      // Restart PM2
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && pm2 restart restaurante-api', (err2, stream2) => {
        let out = '';
        stream2.on('close', () => {
          console.log('PM2 restart result:', out);
          conn.end();
        }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
      });
    });
    ws.write(fixedPedidos);
    ws.end();
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
