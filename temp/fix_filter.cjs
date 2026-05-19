const fs = require('fs');
const filePath = 'E:/GitHub/Parlor/src/pages/CharacterMarketPage.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Find and replace the entire filter+supplement section
const searchStr = 'onChange={e => {\n                      const val = e.target.value;\n                      setLocalFilter(val);\n\n                      // 当过滤文本变化且有搜索结果时，自动补充搜索';
const replaceStr = 'onChange={e => setLocalFilter(e.target.value)}';

const idx = content.indexOf(searchStr);
if (idx !== -1) {
  // Find the end of this onChange handler - after the closing })
  const onChangeEnd = content.indexOf('}\n                    placeholder={t', idx);
  if (onChangeEnd !== -1) {
    const before = content.slice(0, idx);
    const after = content.slice(onChangeEnd);
    content = before + replaceStr + after;
    console.log('Replaced onChange handler');
  }
}

// Replace the X button onClick that references setLastFilterQuery
content = content.replace(
  "onClick={() => { setLocalFilter(''); setLastFilterQuery(''); }}",
  "onClick={() => setLocalFilter('')}"
);

// Remove unused state declarations
content = content.replace(
  "const [lastFilterQuery, setLastFilterQuery] = useState('');\n  // 防抖补充搜索\n  const supplementTimerRef = useRef<ReturnType<typeof setTimeout>>(null);",
  "// (lastFilterQuery + supplementTimerRef removed — local filter only)"
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done');
