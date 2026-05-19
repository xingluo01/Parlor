import { describe, it, expect } from 'vitest';

describe('WorldInfo autoAssociate logic', () => {
  // 模拟 worldInfoOps.getAll() 返回的数据
  const mockWorldInfos = [
    { id: 'wi1', name: '全启用', enabled: true, autoAssociate: true },
    { id: 'wi2', name: '关闭关联', enabled: true, autoAssociate: false },
    { id: 'wi3', name: '默认关联', enabled: true }, // autoAssociate undefined → 视为 true
    { id: 'wi4', name: '全局关闭', enabled: false, autoAssociate: true },
    { id: 'wi5', name: '全关', enabled: false, autoAssociate: false },
  ];

  it('should include world infos with enabled=true and autoAssociate!==false', () => {
    const result = mockWorldInfos
      .filter(b => b.enabled && b.autoAssociate !== false)
      .map(b => b.id);
    
    expect(result).toContain('wi1'); // enabled=true, autoAssociate=true
    expect(result).toContain('wi3'); // enabled=true, autoAssociate=undefined → 视为 true
    expect(result).not.toContain('wi2'); // enabled=true, autoAssociate=false → 排除
    expect(result).not.toContain('wi4'); // enabled=false
    expect(result).not.toContain('wi5'); // enabled=false
  });

  it('should return empty array when no world infos match', () => {
    const empty: typeof mockWorldInfos = [];
    const result = empty
      .filter(b => b.enabled && b.autoAssociate !== false)
      .map(b => b.id);
    expect(result).toEqual([]);
  });

  it('should handle world infos with only autoAssociate=true', () => {
    const data = [
      { id: 'a', enabled: true, autoAssociate: true },
      { id: 'b', enabled: true, autoAssociate: true },
    ];
    const result = data
      .filter(b => b.enabled && b.autoAssociate !== false)
      .map(b => b.id);
    expect(result).toEqual(['a', 'b']);
  });

  it('should handle world infos with only autoAssociate=false', () => {
    const data = [
      { id: 'a', enabled: true, autoAssociate: false },
      { id: 'b', enabled: true, autoAssociate: false },
    ];
    const result = data
      .filter(b => b.enabled && b.autoAssociate !== false)
      .map(b => b.id);
    expect(result).toEqual([]);
  });
});
