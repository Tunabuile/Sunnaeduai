const fs = require('fs');
let lines = fs.readFileSync('app/actions.ts', 'utf8').split(/\r?\n/);

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('danh sách rút gọn')) {
    lines[i] = 'Sau đó có một phần "Đáp án ẩn" bằng cách dùng Markdown spoiler hoặc danh sách rút gọn.`';
    break;
  }
}

fs.writeFileSync('app/actions.ts', lines.join('\n'));
console.log('Fixed literal by array splitting!');
