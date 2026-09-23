const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const newFolioLogic = `    // Generar folio
    const hoy = new Date();
    const yy = String(hoy.getFullYear()).slice(2);
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    
    // Mejor lógica para evitar colisiones: obtener el último folio del día y sumarle 1
    const [maxRow] = await conn.query(
      "SELECT folio FROM ventas WHERE fecha_venta = CURDATE() ORDER BY id DESC LIMIT 1"
    );
    let numSeq = 1;
    if (maxRow.length && maxRow[0].folio) {
      const parts = maxRow[0].folio.split('-');
      if (parts.length === 3) {
        numSeq = parseInt(parts[2], 10) + 1;
      }
    }
    const seq = String(numSeq).padStart(3, '0');
    const waiter_id = filasPed[0].vendedor_id;
    const folio = \`VENTA-\${yy}\${mm}\${dd}-\${seq}\`;`;

conn.on('ready', () => {
  conn.exec('cat /var/www/restaurante-api/src/routes/ventas.js', (err, stream) => {
    let content = '';
    stream.on('close', () => {
      // Reemplazar la lógica vieja
      const oldLogic = `    // Generar folio
    const hoy = new Date();
    const yy = String(hoy.getFullYear()).slice(2);
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const [cntRow] = await conn.query(
      \`SELECT COUNT(*) AS cnt FROM ventas WHERE fecha_venta = CURDATE()\`
    );
    const seq = String(parseInt(cntRow[0].cnt || 0) + 1).padStart(3, '0');
    const waiter_id = filasPed[0].vendedor_id;
    const folio = \`VENTA-\${yy}\${mm}\${dd}-\${seq}\`;`;
      
      let fixed = content.replace(oldLogic, newFolioLogic);
      
      if (fixed === content) {
        console.error('No se encontró la lógica vieja para reemplazar.');
        process.exit(1);
      }
      
      conn.sftp((err2, sftp) => {
        if (err2) throw err2;
        const ws = sftp.createWriteStream('/var/www/restaurante-api/src/routes/ventas.js');
        ws.on('close', () => {
          console.log('Folio generator fixed in ventas.js');
          conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && pm2 restart restaurante-api', (err3, stream3) => {
            stream3.on('close', () => {
              console.log('PM2 restarted successfully.');
              conn.end();
            });
          });
        });
        ws.write(fixed);
        ws.end();
      });
    }).on('data', d => content += d.toString()).stderr.on('data', d => content += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
