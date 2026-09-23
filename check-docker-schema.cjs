const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // The DB is inside docker, so we need to check the docker container
  conn.exec(`docker exec $(docker ps -qf "name=db" | head -1) mysql -uroot -pHenogo0521 restaurante_app -e "DESCRIBE pedidos; SELECT DISTINCT estado FROM pedidos LIMIT 20;"`, (err, stream) => {
    let out = '';
    stream.on('close', () => {
      console.log('Schema + states:', out);
      conn.end();
    }).on('data', d => out += d.toString()).stderr.on('data', d => out += d.toString());
  });
}).connect({ host: '89.117.56.39', port: 22, username: 'root', password: 'Henogo0521*' });
