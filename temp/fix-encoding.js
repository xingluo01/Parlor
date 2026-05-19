const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'presets.json');

// 读取原始字节
const raw = fs.readFileSync(filePath);

// 输出文件相关信息供诊断
console.log('File size (bytes):', raw.length);
console.log('First 4 bytes (hex):', Array.from(raw.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
console.log('First 10 chars:', raw.toString('utf-8').substring(0, 10));

// 查找第一个 [ 的位置
const bracketIndex = raw.indexOf(0x5B); // '[' 的 ASCII
console.log('First [ position:', bracketIndex);

if (bracketIndex > 0) {
  // 移除 BOM/乱码前缀
  const clean = raw.slice(bracketIndex);
  const content = clean.toString('utf-8');
  
  // 验证 JSON
  try {
    JSON.parse(content);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('✅ 修复成功：移除了 BOM/乱码前缀');
  } catch (e) {
    console.error('❌ JSON 仍无效:', e.message);
    process.exit(1);
  }
} else if (bracketIndex === 0) {
  console.log('✅ 文件已经是干净的 UTF-8 without BOM');
} else {
  console.error('❌ 未找到 JSON 数组起始符 [');
  process.exit(1);
}
