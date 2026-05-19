const fs = require('fs');
const filePath = 'E:/GitHub/Parlor/src/pages/CharacterMarketPage.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. PER_PAGE: 50 → 24（4列×6行，一次加载刚好填满可视区）
content = content.replace('const PER_PAGE = 50;', 'const PER_PAGE = 24;');

// 2. Remove loadAllRemainingPages entirely
const loadFnRegex = /async function loadAllRemainingPages[\s\S]*?\n  }/;
content = content.replace(loadFnRegex, '// loadAllRemainingPages removed — on-demand pagination only');

// 3. In handleSearchWithQuery: remove the background load call, load PER_PAGE first batch
content = content.replace(
  "const FIRST_BATCH = 50;",
  "const FIRST_BATCH = PER_PAGE;"
);
content = content.replace(
  `// 首次展示完成 → 立即静默加载剩余页面\n      setIsSearching(false);  // 先结束搜索状态\n\n      if (more && query.trim()) {\n        // 不 await，让后台静默加载\n        loadAllRemainingPages(query.trim(), searchSort, FIRST_BATCH);\n      }\n\n      return; // 提前 return，finally 中的 setIsSearching(false) 已在此处执行`,
  `// 首次展示完成
      setIsSearching(false);`
);

// 4. Remove setHasMore(false) from the removed function remnant
// The comment line we inserted might have a dangling setBackgroundLoading etc.
// Let me check what's left

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done');
