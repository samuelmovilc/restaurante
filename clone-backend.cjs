const { Client } = require('ssh2');
const conn = new Client();

const scriptToRun = `
echo "Starting backend cloning process..."

# 1. Create new database and clone structure
echo "Cloning database structure from amarillo_pollo to minipos_db..."
mysql -u root -pHenogo0521* -e "CREATE DATABASE IF NOT EXISTS minipos_db;"
mysqldump -u root -pHenogo0521* -d amarillo_pollo > /tmp/schema.sql
mysql -u root -pHenogo0521* minipos_db < /tmp/schema.sql
echo "Database cloned successfully."

# 2. Duplicate backend folder
echo "Copying backend folder..."
cp -R /var/www/restaurante-api /var/www/minipos-api
cd /var/www/minipos-api

# 3. Update .env file for the new backend
echo "Updating .env..."
sed -i 's/DB_NAME=amarillo_pollo/DB_NAME=minipos_db/g' .env
sed -i 's/PORT=3006/PORT=3007/g' .env
sed -i 's/PORT=3000/PORT=3007/g' .env  # Just in case

# 4. Start the new backend with PM2
echo "Starting minipos-api on PM2..."
export PATH=/root/.nvm/versions/node/v14.21.3/bin:$PATH
pm2 start src/server.js --name minipos-api
pm2 save

echo "Backend cloning complete."
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/tmp/clone-backend.sh');
    ws.on('close', () => {
      conn.exec('chmod +x /tmp/clone-backend.sh && /tmp/clone-backend.sh', (err2, stream) => {
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
