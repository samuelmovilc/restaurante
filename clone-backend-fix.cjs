const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
echo "Starting backend cloning process..."

# 1. Create new database and clone structure
echo "Cloning database structure from restaurante_app to minipos_db..."
mysql -u root -p"R00t#C0nt4b0_P0S!2026" -P 3308 -e "CREATE DATABASE IF NOT EXISTS minipos_db;"
mysqldump -u root -p"R00t#C0nt4b0_P0S!2026" -P 3308 -d restaurante_app > /tmp/schema.sql
mysql -u root -p"R00t#C0nt4b0_P0S!2026" -P 3308 minipos_db < /tmp/schema.sql
echo "Database cloned successfully."

# 3. Update .env file for the new backend
cd /var/www/minipos-api
echo "Updating .env..."
sed -i 's/DB_NAME=restaurante_app/DB_NAME=minipos_db/g' .env
sed -i 's/PORT=3006/PORT=3007/g' .env

# 4. Restart the new backend with PM2
echo "Restarting minipos-api on PM2..."
export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH
pm2 restart minipos-api
pm2 save

echo "Backend cloning complete."
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/clone-backend-fix.sh');
    ws.on('close', () => {
      conn.exec('chmod +x /tmp/clone-backend-fix.sh && /tmp/clone-backend-fix.sh', (err2, stream) => {
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
