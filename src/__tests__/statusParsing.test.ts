import { describe, it, expect } from 'vitest';
import { extractStatusFromContent } from '../utils/prompts';

describe('extractStatusFromContent - CJK JSON keys', () => {
  const fullBlock = `[STATUS]
{
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
}
[/STATUS]`;

  it('should extract sceneHeader from time/location/scene', () => {
    const result = extractStatusFromContent(fullBlock);
    console.log('=== CJK test result ===');
    console.log('sceneHeader:', result.sceneHeader);
    console.log('infoLines:', JSON.stringify(result.infoLines));
    console.log('statusLines:', JSON.stringify(result.statusLines));
    expect(result.sceneHeader).toBeTruthy();
    expect(result.sceneHeader).toContain('时间');
  });

  it('should extract info fields with Chinese labels', () => {
    const result = extractStatusFromContent(fullBlock);
    expect(result.infoLines.length).toBeGreaterThan(0);
    const hasName = result.infoLines.some(l => l.label === '姓名');
    expect(hasName).toBe(true);
  });

  it('should extract status fields with Chinese labels', () => {
    const result = extractStatusFromContent(fullBlock);
    expect(result.statusLines.length).toBeGreaterThan(0);
    const hasTop = result.statusLines.some(l => l.label === '上衣');
    expect(hasTop).toBe(true);
  });
});

describe('extractStatusFromContent - valid JSON', () => {
  it('should parse properly quoted JSON', () => {
    const content = `[STATUS]
{
"time": "傍晚",
"location": "花园",
"info": { "姓名": "测试" },
"status": { "心情": "好" }
}
[/STATUS]`;
    const result = extractStatusFromContent(content);
    expect(result.sceneHeader).toBeTruthy();
    expect(result.infoLines.length).toBeGreaterThan(0);
    expect(result.statusLines.length).toBeGreaterThan(0);
  });
});

describe('extractStatusFromContent - missing [/STATUS] tag', () => {
  it('should parse [STATUS] block without closing [/STATUS] tag', () => {
    const content = `[STATUS]
{
time: 2024年8月7日 星期三 早上7:18,
location: 星落的卧室,
info: {
姓名: 冯晓琳,
胸围: 88cm,
腰围: 62cm
},
status: {
上衣: 无,
下装: 无,
胸部: 赤裸
}
}`;
    const result = extractStatusFromContent(content);
    console.log('Missing [/STATUS] test result:', JSON.stringify(result));
    expect(result.sceneHeader).toBeTruthy();
    expect(result.infoLines.length).toBeGreaterThan(0);
    expect(result.statusLines.length).toBeGreaterThan(0);
  });

  it('should handle values starting with digits like dates and measurements', () => {
    const content = `[STATUS]
{
time: 2024年8月7日 星期三 早上7:18,
location: 卧室,
status: {
胸围: 88cm,
腰围: 62cm,
温度: 36.5度
}
}
[/STATUS]`;
    const result = extractStatusFromContent(content);
    console.log('Digit values test result:', JSON.stringify(result));
    expect(result.sceneHeader).toBeTruthy();
    expect(result.sceneHeader).toContain('时间');
    expect(result.statusLines.length).toBeGreaterThan(0);
    const hasChest = result.statusLines.some(l => l.label === '胸围');
    expect(hasChest).toBe(true);
  });
});
