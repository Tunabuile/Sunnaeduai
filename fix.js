const fs = require('fs');
let c = fs.readFileSync('app/actions.ts', 'utf8');
c = c.replace(/rút gọn\\`/g, 'rút gọn`');
fs.writeFileSync('app/actions.ts', c);
console.log('Fixed!');
