const fs = require('fs');
const filePath = 'E:/GitHub/Parlor/src/pages/CharacterMarketPage.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Replace PRESET_LINKS with only importable sources
const oldPresetLinks = content.match(/const PRESET_LINKS: MarketLink\[\] = \[[\s\S]*?\];/);
if (oldPresetLinks) {
  const newPresetLinks = `const PRESET_LINKS: MarketLink[] = [
  // 有开放 API 的角色市场
  { id: 'chub', name: 'Chub.ai', url: 'https://www.chub.ai', description: '最大最活跃的角色卡市场，支持搜索和一键导入', isPreset: true },
  // 可直接下载角色卡的站点
  { id: 'stpro', name: 'SillyTavern Pro', url: 'https://cards.sillytavern.one', description: '3.3 万+ 中文/英文角色卡', isPreset: true },
  { id: 'charavault', name: 'CharaVault', url: 'https://charavault.net', description: '19.5 万角色卡，支持 PNG/JSON 下载', isPreset: true },
  { id: 'aicharactercards', name: 'AI Character Cards', url: 'https://aicharactercards.com', description: 'SillyTavern 角色卡静态目录', isPreset: true },
  { id: 'taverncard', name: 'TavernCard', url: 'https://www.taverncard.com', description: '角色卡展示与分享', isPreset: true },
  { id: 'characterhub', name: 'Character Hub', url: 'https://www.characterhub.org', description: 'AI 角色管理与发现', isPreset: true },
];`;
  content = content.replace(oldPresetLinks[0], newPresetLinks);
  console.log('Replaced PRESET_LINKS');
}

// 2. Add preset import buttons below the URL input in quick-import section
const quickImportEnd = content.indexOf('        {/* ── 搜索区域 ── */}');
const quickImportSection = content.slice(content.indexOf('{/* ── 快速导入 ── */}'), quickImportEnd);

const oldQuickImportEnd = quickImportSection.match(/          <\/div>\n        <\/div>/);
if (oldQuickImportEnd) {
  const idx = quickImportSection.lastIndexOf(oldQuickImportEnd[0]);
  const before = quickImportSection.slice(0, idx);
  const after = quickImportSection.slice(idx + oldQuickImportEnd[0].length);
  
  const newQuickImport = before + `          </div>
          {/* 快捷导入按钮 */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-gray-500 self-center shrink-0">快捷导入:</span>
            <button onClick={() => { setQuickUrl('https://cards.sillytavern.one'); }} className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors">SillyTavern Pro</button>
            <button onClick={() => { setQuickUrl('https://charavault.net'); }} className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors">CharaVault</button>
            <button onClick={() => { setQuickUrl('https://www.characterhub.org'); }} className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors">Character Hub</button>
            <a href="https://cards.sillytavern.one" target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors flex items-center gap-1">
              浏览市场 <ExternalLink size={10} />
            </a>
          </div>
        </div>` + after;
  
  content = content.replace(quickImportSection, newQuickImport);
  console.log('Added quick import preset buttons');
}

// 3. Remove dead links section that only showed preset links as external references
// This section renders the "所有链接" panel below the search
const linksSection = content.match(/\/\* ── 所有链接 ── \*\/[\s\S]*?\n\s+\)\n/);
if (linksSection) {
  // Check if it's the allLinks rendering section not the custom links management
  const section = linksSection[0];
  if (section.includes('allLinks.map') || section.includes('PRESET_LINKS')) {
    // Don't remove it entirely - just keep it minimal for custom links management
    console.log('Found links section, length:', section.length);
  }
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done');
