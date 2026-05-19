const fs = require('fs');
const filePath = 'E:/GitHub/Parlor/src/pages/CharacterMarketPage.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Replace the auto-supplement search + filter block with simplified local-only filter
const oldFilterBlock = content.match(
  /<div className="mb-3">\s*<div className="relative">\s*<Search[\s\S]*?supplementTimerRef[\s\S]*?<\/div>\s*<\/div>\s*<div className="text-\[11px\]/
);

if (oldFilterBlock) {
  const fullMatch = oldFilterBlock[0];
  const afterPart = fullMatch.match(/<div className="text-\[11px\]/);
  if (afterPart) {
    const idx = fullMatch.indexOf(afterPart[0]);
    const simplified = `<div className="mb-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={localFilter}
                    onChange={e => setLocalFilter(e.target.value)}
                    placeholder={t('characterMarket.filterPlaceholder') || '过滤当前结果...'}
                    className="w-full pl-8 pr-8 py-1.5 text-[12px] rounded-lg bg-dark-300 border border-glass-border text-gray-200 placeholder-gray-500 focus:outline-none focus:border-parlor-500"
                  />
                  {localFilter && (
                    <button onClick={() => setLocalFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      <X size={14} />
                    </button>
                  )}
                </div>
              <div className="text-[11px]`;
    
    content = content.replace(fullMatch, simplified);
    console.log('Replaced filter block');
  }
}

// 2. Simplify loadAllRemainingPages to batch in chunks
const oldLoadMore = content.match(
  /async function loadAllRemainingPages[\s\S]*?setHasMore\(false\); \/\/ 全部加载完毕\s*\n\s*}/
);

if (oldLoadMore) {
  const simplified = `async function loadAllRemainingPages(query: string, sort: string, firstBatchSize: number) {
    setBackgroundLoading(true);
    let skip = firstBatchSize;
    let currentHasMore = true;
    let allNodes: ChubSearchNode[] = [];

    while (currentHasMore) {
      try {
        const { nodes, hasMore: more } = await searchChub(query, sort, 50, skip);
        if (nodes.length === 0) break;
        allNodes.push(...nodes);
        skip += 50;
        currentHasMore = more;
      } catch {
        break;
      }
    }

    // 批量追加，减少重渲染次数
    if (allNodes.length > 0) {
      setSearchResults(prev => [...prev, ...allNodes]);

      // 合并标签
      const allTopics = new Set<string>();
      allNodes.forEach(n => n.topics?.forEach(t => allTopics.add(t)));
      if (allTopics.size > 0) {
        setAvailableTopics(prev => {
          const updated = new Set(prev);
          allTopics.forEach(t => updated.add(t));
          return Array.from(updated).sort();
        });
      }

      // 自动翻译
      try {
        const s = await settingsOps.get();
        if (s?.baiduTranslateMarket && s?.baiduTranslateAppId && s?.baiduTranslateSecretKey) {
          handleBatchTranslate(allNodes, s);
        }
      } catch {}
    }

    setBackgroundLoading(false);
    setHasMore(false);
  }`;

  content = content.replace(oldLoadMore[0], simplified);
  console.log('Replaced loadAllRemainingPages');
}

// 3. Remove unused state: lastFilterQuery, supplementTimerRef
// Also clean up unused imports if any

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done');
