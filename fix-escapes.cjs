const fs = require('fs');
const files = [
  'src/pages/mobile/MobilePedidosAdmin.jsx',
  'src/pages/mobile/MobileConfigAdmin.jsx',
  'src/pages/mobile/MobileCosteoAdmin.jsx',
  'src/pages/mobile/MobileCarteraAdmin.jsx'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/\\`/g, '`');
  c = c.replace(/\\\$/g, '$');
  c = c.replace(/\\\\n/g, '\\n');
  fs.writeFileSync(f, c);
  console.log('Fixed', f);
});
