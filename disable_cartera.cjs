const fs = require('fs');
const f = 'src/pages/mobile/MobileConfigAdmin.jsx';
let content = fs.readFileSync(f, 'utf8');

// Use a regex to comment out the line that contains id: 'nav_cartera'
content = content.replace(/^(\s*)(\{ id: 'nav_cartera',.*)/gm, '$1// $2');

fs.writeFileSync(f, content);
console.log('Patched MobileConfigAdmin.jsx');
