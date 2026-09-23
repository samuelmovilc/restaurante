const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
const db = require('/var/www/restaurante-api/src/db/connection');
(async () => {
  try {
    console.log('Connecting to db...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('TRUNCATE TABLE venta_metodos_pago');
    await db.query('TRUNCATE TABLE ventas');
    await db.query('TRUNCATE TABLE pedido_detalle');
    await db.query('TRUNCATE TABLE pedidos');
    await db.query('TRUNCATE TABLE cartera');
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('All orders, sales, and cartera wiped successfully.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/wipe.js');
    ws.on('close', () => {
      conn.exec('export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH && node /tmp/wipe.js', (err2, stream) => {
        let out = '';
        stream.on('close', () => {
          console.log(out);
          conn.end();
        }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
      });
    });
    ws.write(scriptToRun);
    ws.end();
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
