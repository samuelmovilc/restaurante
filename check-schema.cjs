const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `mysql -u root '-pHenogo0521' restaurante -e 'DESCRIBE pedidos'`;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('DESCRIBE pedidos:\n', out);
      
      // Also check recent error
      conn.exec('tail -n 30 /root/.pm2/logs/restaurante-api-error.log', (err2, stream2) => {
        let out2 = '';
        stream2.on('close', () => {
          console.log('\nRecent errors:\n', out2);
          conn.end();
        }).on('data', d => out2 += d.toString()).stderr.on('data', d => out2 += d.toString());
      });
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
