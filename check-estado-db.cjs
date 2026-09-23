const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Use papeleria_app_mariadb container - it's the MariaDB at port 3308 = the DB used by restaurante-api
  const cmd = `docker exec papeleria_app_mariadb mysql -uroot '-pR00t#C0nt4b0_P0S!2026' restaurante_app -e "DESCRIBE pedidos; SELECT DISTINCT estado FROM pedidos LIMIT 20;"`;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('Pedidos schema + states:\n', out);
      conn.end();
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
