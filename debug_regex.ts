const blockContent = `{
time: 清晨,
location: 史莱姆森林 — 空地中央,
scene: 场景重置：脱离刘子轩角色身份。史莱姆女孩们恢复日常休闲状态。,
info: {
姓名: 未定义（自由）,
初潮年龄: N/A,
胸围: 未测量,
乳房开发程度: 未定义
},
status: {
上衣: 自由设定,
胸部: 自由状态,
乳头: 自由状态,
下阴: 自由状态
}
}`;

// Step 1: Quote all bare keys (ASCII + CJK + hyphen)
let fixed = blockContent.replace(/([{,]\s*)([a-zA-Z0-9_\u4e00-\u9fff\u3400-\u4dbf-]+)(\s*:)/g, '$1"$2"$3');
console.log('=== After Step 1 ===');
console.log(fixed);

// Step 2: Quote unquoted string values
fixed = fixed.replace(/:\s*([^"{\[\]0-9tfn-][^,\]\n}]*,?)/g, (match: string, value: string) => {
  const trimmed = value.trim().replace(/,$/, '');
  if (['true', 'false', 'null'].includes(trimmed.toLowerCase())) return match;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return match;
  const comma = value.endsWith(',') ? ',' : '';
  return `: "${trimmed}"${comma}`;
});
console.log('=== After Step 2 ===');
console.log(fixed);

try {
  const parsed = JSON.parse(fixed);
  console.log('=== Parsed OK ===');
  console.log('time:', parsed.time);
  console.log('location:', parsed.location);
  console.log('scene:', parsed.scene);
  console.log('info:', JSON.stringify(parsed.info));
  console.log('status:', JSON.stringify(parsed.status));
} catch(e: any) {
  console.log('Parse error:', e.message);
}
