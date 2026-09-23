const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  let content = fs.readFileSync('ventas-remote.js', 'utf8');
  content = content.replace(/pedRows/g, 'filasPed');
  
  // Also we should fix the Data truncated error. The `estado` column might expect 'Pendiente', 'Completado', 'Cancelado'
  // But wait, the frontend uses 'liquidado' for updatePedido! 
  // Let's just fix the SyntaxError first.
  
  conn.exec(`cat > /var/www/restaurante-api/src/routes/ventas.js`, (err, stream) => {
    stream.on('close', () => {
      console.log('File updated. Restarting PM2...');
      conn.exec('export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" && pm2 restart restaurante-api', (err2, stream2) => {
        stream2.on('close', () => {
          console.log('PM2 restarted.');
          conn.end();
        });
      });
    });
    stream.write(content);
    stream.end();
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
