// ===== 卡片尺寸高度映射 =====
export const CARD_HEIGHT_MAP: Record<string, string> = {
  small: 'h-[160px] sm:h-[180px]',
  medium: 'h-[200px] sm:h-[220px]',
  large: 'h-[240px] sm:h-[260px]',
};

// ===== NovelParserPage.tsx =====
// 小说分析专家系统提示词
export const SYSTEM_PROMPT = `你是一个专业的小说分析专家。请分析用户提供的小说文本，提取其中的世界观设定和角色信息。

请严格按照以下 JSON 格式输出，不要包含任何其他内容（不要 markdown 代码块，纯 JSON）：

{
  "title": "小说标题或标识",
  "worldEntries": [
    {
      "name": "条目名称",
      "content": "详细描述",
      "keywords": ["触发关键词1", "触发关键词2"]
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "description": "角色详细描述，包括外貌、身份背景、能力特长、与其他角色的关系等",
      "personality": "角色性格特征的多维度描述",
      "firstMessage": "至少30字的第一句话，包含*号包裹的动作描写和人物对话，要高度符合角色性格",
      "scenario": "角色在故事中出现的典型场景描述",
      "tags": ["标签1", "标签2", "标签3"],
      "age": "年龄（如"18岁"）",
      "gender": "性别",
      "race": "种族",
      "occupation": "职业",
      "height": "身高",
      "appearance": "整体外貌描述",
      "personalityTraits": ["勇敢", "执着"],
      "likes": ["喜好1"],
      "dislikes": ["厌恶1"],
      "background": "背景故事简述",
      "speechStyle": "说话风格描述",
      "relations": [
        { "targetName": "关联角色名", "relationType": "情侣", "summary": "关系简述" }
      ]
    }
  ]
}

【条目粒度要求 - 非常重要】
每个 worldEntry 必须只聚焦一个具体的事物，不要合并：
- 地点类：每个重要场所各占一个独立条目
- 组织类：每个家族、势力、团体各占一个条目
- 物品类：每个重要物品各占一个条目
- 事件类：每个关键历史事件、预言各占一个条目
- 设定类：每项规则、概念各占一个条目

【数量要求 - 非常重要】
根据文本长度决定提取数量：
- 5000字以下：worldEntries 至少 5 个，characters 至少 3 个
- 1万字左右：worldEntries 至少 10 个，characters 至少 5 个
- 5万字左右：worldEntries 至少 20 个，characters 至少 8 个
- 10万字以上：worldEntries 至少 30 个，characters 至少 12 个

【角色关系要求】
在 characters 数组中，每个角色增加 relations 数组，描述该角色与其他角色的关系：
- targetName: 关联角色的名称
- relationType: 关系类型（枚举值：情侣、师徒、好友、敌对、家人、主仆、师生、同门、其他）
- summary: 关系简述，60 字以内

例如：
"characters": [
  {
    "name": "唐三",
    ...
    "relations": [
      { "targetName": "小舞", "relationType": "情侣", "summary": "青梅竹马，互相深爱" },
      { "targetName": "比比东", "relationType": "敌对", "summary": "武魂殿教皇，杀母仇人" }
    ]
  }
]

【角色详细信息要求】
请尽可能提取每个角色的以下信息，填入对应的字段：

基础属性：age(年龄), gender(性别), race(种族), occupation(职业), height(身高)

外貌细节：appearance(整体外貌描述), hairStyle(发型), eyeColor(瞳色), clothing(服饰风格), bodyFeatures(身体特征，包括体型、肤色等显著特征)

性格深度：personality(性格描述，已有), personalityTraits(性格特质列表，如["勇敢","执着","温柔"]), mbti(MBTI人格类型), likes(喜好列表), dislikes(厌恶列表), habits(习惯列表)

背景经历：background(详细背景故事，包括身世、成长经历等), keyEvents(关键事件描述)

能力/技能：abilities(特殊能力、战斗技巧、知识领域等的描述)

语言风格：speechStyle(说话风格描述), catchphrases(口头禅列表)

隐秘特征：intimateDetails(隐秘的、不对外公开的特征细节，包括身体私密特征等)

注意：如果小说文本中没有提供某些信息，对应字段可以省略或留空，不要编造。

【内容质量要求】
- 每个 worldEntry 的 keywords 至少 2 个，建议 3-4 个
- 每个 worldEntry 的 content 要求描述详尽（50-200字）
- 每个 character 的 firstMessage 要求至少 30 字
- description 要包含外貌特征、身份背景、核心能力、关键经历

【语言要求】
description、personality、scenario 字段必须使用中文输出。
如果原文包含非中文内容，请翻译为中文后再输出。`;

// ===== CharacterEditorPage.tsx =====
// 字段中文标签映射
export const FIELD_LABELS: Record<string, string> = {
  description: '角色描述',
  personality: '角色性格',
  scenario: '角色场景',
  firstMessage: '角色开场白',
};

// 翻译/处理模式提示词映射
export const MODE_PROMPTS: Record<string, Record<string, string>> = {
  description: {
    polish: '请润色以下角色描述，使其表达更流畅、生动、自然，保持原意不改变任何事实：',
    expand: '请扩写以下角色描述，在不虚构新设定的前提下，增加修饰性词汇和细节描述：',
    abridge: '请缩写以下角色描述，保留核心身份、特征和关键信息：',
    erotic: '请对以下角色描述进行色情化处理，在保持核心设定的前提下，加入性感、诱惑方面的描述：',
  },
  personality: {
    polish: '请润色以下角色性格描述，使性格特征表达更鲜明、层次更分明：',
    expand: '请扩写以下角色性格描述，增加心理活动、情感倾向和性格细节的修饰，不虚构新特质：',
    abridge: '请缩写以下角色性格描述，保留核心性格特质，去除冗余描述：',
    erotic: '请对以下角色性格描述进行色情化处理，在保持核心性格的前提下，增加性欲、诱惑、情色倾向的性格特质描述：',
  },
  scenario: {
    polish: '请润色以下角色场景描述，使场景氛围更生动、画面感更强：',
    expand: '请扩写以下角色场景描述，增加环境氛围、感官细节的修饰，不虚构新场景元素：',
    abridge: '请缩写以下角色场景描述，保留核心场景信息和氛围：',
    erotic: '请对以下角色场景描述进行色情化处理，在保持核心场景设定的前提下，加入色情的环境和互动描写：',
  },
  firstMessage: {
    standard: '请将以下角色开场白翻译为中文，保持角色语气和情感不变：',
    polish: '请润色以下角色开场白，使其更自然流畅，更符合角色性格：',
    expand: '请扩写以下角色开场白，在不改变核心意思的前提下增加细节描写，使其更生动：',
    abridge: '请缩写以下角色开场白，保留核心信息和角色语气：',
    erotic: '请对以下角色开场白进行色情化处理，在保持角色性格的前提下加入性感、诱惑的表达：',
  },
};

// 翻译/处理模式描述
export const MODE_DESCRIPTIONS: Record<string, string> = {
  polish: '对其进行润色，使表达更流畅自然',
  expand: '对其进行扩写，增加细节描述',
  abridge: '对其进行缩写，保留核心信息',
  erotic: '对其进行色情化处理',
};

// AI 智能填充 prompt 构建函数
export function buildAIFillPrompt(description: string, personality: string, scenario: string): string {
  return `你是一个角色卡信息提取专家。请根据以下角色信息，提取结构化的角色参数。

角色描述：
${description || '（无）'}

角色性格：
${personality || '（无）'}

角色场景：
${scenario || '（无）'}

请从以上信息中提取并推断以下字段，严格按照 JSON 格式输出（纯 JSON，不要 markdown 代码块）：

{
  "age": "年龄",
  "gender": "性别",
  "race": "种族",
  "occupation": "职业",
  "height": "身高",
  "appearance": "整体外貌描述",
  "hairStyle": "发型",
  "eyeColor": "瞳色",
  "clothing": "服饰风格",
  "bodyFeatures": "身体特征（体型、肤色等）",
  "personalityTraits": ["性格特质1", "性格特质2"],
  "mbti": "MBTI类型",
  "likes": ["喜好1", "喜好2"],
  "dislikes": ["厌恶1", "厌恶2"],
  "habits": ["习惯1", "习惯2"],
  "background": "背景故事",
  "keyEvents": "关键事件描述",
  "abilities": "能力技能描述",
  "speechStyle": "说话风格",
  "catchphrases": ["口头禅1", "口头禅2"],
  "intimateDetails": "隐秘特征细节"
}

要求：
1. 只基于提供的信息推断，不要编造
2. 如果某字段没有足够信息，设为空字符串或空数组
3. 年龄用字符串表示（如"18岁"、"25岁"）
4. 所有列表类字段如果无信息则为空数组 []`;
}

// ===== CharacterImportPage.tsx =====
// 角色拆解 prompt 构建函数
export function buildSplitCharacterPrompt(char: {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  systemPrompt?: string;
  characterBook?: any;
  alternateGreetings?: string[];
}): string {
  return `你是一个专业的角色卡分析专家。请分析以下角色卡，判断它是否包含多个角色（群聊型角色卡）。

如果角色卡描述的是一个团队、群组、或包含多个角色，请拆解出每个角色的详细信息。
进行拆解时，允许进行少量合理的思维扩散——基于角色卡已有设定，适当补充和完善角色细节，使角色形象更丰满。

## 角色卡信息
角色卡名称：${char.name}
描述：${char.description || '无'}
性格：${char.personality || '无'}
场景：${char.scenario || '无'}
开场白：${char.firstMessage || '无'}
系统提示：${char.systemPrompt || '无'}
内嵌世界书：${char.characterBook ? JSON.stringify(char.characterBook).slice(0, 3000) : '无'}
备选开场白：${char.alternateGreetings?.join(' | ') || '无'}

请分析并严格按照以下 JSON 格式输出（纯 JSON，不要 markdown 代码块）：

{
  "isMultiCharacter": true,
  "groupName": "群聊名称（基于角色卡名称生成）",
  "characters": [
    {
      "name": "角色1的名称",
      "description": "角色1的详细描述（100-300字）",
      "personality": "角色1的性格描述",
      "firstMessage": "角色1的开场白（至少30字，含*动作*和对话）",
      "scenario": "角色1的典型场景",
      "tags": ["标签1", "标签2"],
      "relations": [
        { "targetName": "其他角色名", "relationType": "关系类型（情侣/师徒/好友/敌对/家人/主仆/师生/同门/其他）", "summary": "关系描述" }
      ]
    }
  ],
  "worldEntries": [
    {
      "name": "世界观条目名称",
      "content": "条目详细描述",
      "keywords": ["关键词1", "关键词2", "关键词3"]
    }
  ]
}

要求：
1. 如果角色卡确实只包含单个角色（不是群聊型），则 isMultiCharacter 设为 false，characters 数组中只放一个角色
2. 至少分析 2 个角色才算 isMultiCharacter=true
3. 每个角色必须有 firstMessage
4. worldEntries 从角色卡的 character_book 或描述中提取
5. 允许进行少量合理的思维扩散：如果角色卡中的信息不足以完全描述某个角色，可以基于已有设定进行合理推断和补充，使角色形象更丰满、更立体。但要标注清楚哪些是原始信息、哪些是推断内容。`;
}

// ===== PersonasPage.tsx =====
// AI 创建人设 prompt 构建函数
export function buildCreatePersonaPrompt(worldContext: string, charContext: string, userPrompt: string, charRefContext?: string): string {
  return `请根据以下要求生成一个人设（Persona），用于 AI 角色扮演中代表用户身份。

${worldContext ? worldContext + '\n' : ''}${charContext ? charContext + '\n' : ''}${charRefContext ? charRefContext + '\n' : ''}
用户补充要求：${userPrompt}

请严格按照 JSON 格式输出（纯 JSON）：
{
  "name": "人设名称",
  "description": "人设详细描述（100-300字）",
  "personality": "性格特征描述"
}`;
}

// ===== CharactersPage.tsx =====
// AI 创建角色 prompt 构建函数
export function buildCreateCharacterPrompt(
  worldContext: string,
  personaContext: string,
  bookContext: string,
  charName: string,
  userPrompt: string,
  charRefContext?: string
): string {
  return `请为以下世界观创建一个新角色。

${worldContext}${personaContext ? '\n' + personaContext + '\n' : ''}${bookContext ? '\n' + bookContext + '\n' : ''}${charRefContext ? charRefContext + '\n' : ''}
角色名称：${charName}
${userPrompt ? `补充要求：${userPrompt}` : ''}

请严格按照 JSON 格式输出：
{
  "name": "${charName}",
  "description": "角色详细描述（100-300字，包括外貌、身份、背景）",
  "personality": "性格特征描述（50-150字）",
  "firstMessage": "开场白（至少30字，含*动作*和对话）",
  "scenario": "典型场景",
  "tags": ["标签1", "标签2", "标签3"]
}`;
}

// ===== LorebookPage.tsx =====
// AI 补充设定 prompt 构建函数
export function buildSupplementPrompt(
  existingEntries: string,
  charGroupContext: string,
  personaContext: string,
  userPrompt: string,
  charRefContext?: string
): string {
  return `以下是世界观的现有设定条目：

${existingEntries}${charGroupContext}${personaContext}${charRefContext ? '\n' + charRefContext + '\n' : ''}
用户希望补充以下方向的设定：${userPrompt}

请生成新的设定条目，要求：
1. 与现有设定一致，不冲突
2. 每个条目包含 keywords（3-5个关键词）和 content（100-300字详细描述）
3. 生成 3-5 个新条目

请严格按照 JSON 格式输出：
{
  "entries": [
    { "keywords": ["关键词1", "关键词2", "关键词3"], "content": "详细描述" }
  ]
}`;
}

// ===== BridgeModal.tsx =====
// 世界观桥接 prompt 构建函数
export interface WorldInfoBrief {
  name: string;
  entries: Array<{ keywords: string[]; content: string }>;
}

export function buildBridgePrompt(source: WorldInfoBrief, target: WorldInfoBrief): string {
  return `你是一个世界观融合分析专家。你的任务是比较两个世界观分组中的设定条目，找出它们之间的关联、共同点和可融合的内容。

## 世界观A：${source.name}
条目列表：
${source.entries.map((e, i) => `${i + 1}. 【${e.keywords.join(', ')}】${e.content.slice(0, 200)}`).join('\n')}

## 世界观B：${target.name}
条目列表：
${target.entries.map((e, i) => `${i + 1}. 【${e.keywords.join(', ')}】${e.content.slice(0, 200)}`).join('\n')}

请分析以上两个世界观，生成一组"桥接条目"，用于融合两个世界观。
每个桥接条目应该：
1. 选取两个世界观中共通、或可以互相解释、或可以融合的概念
2. 将两个世界观中的相关内容整合为一个统一的描述
3. 包含双方的关键词，以便在聊天中触发

请严格按照以下 JSON 格式输出，不要包含其他内容（不要 markdown 代码块，纯 JSON）：
{
  "entries": [
    {
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "content": "整合后的详细描述（100-300字）"
    }
  ]
}

要求：
- 至少生成 3 个桥接条目，最多 10 个
- 每个条目至少 3 个关键词
- content 要融合两个世界观的设定，不能只偏向一边
- 如果两个世界观有同名或同类型的概念，优先融合它们`;
}

// ===== useChatGeneration.ts =====
// 继续生成指令
export const CONTINUE_INSTRUCTION = '\n\n【继续生成指令】请从你上一条回复中断的地方继续输出，严格保持当前角色视角、语气和风格。直接继续书写，不要重复已有内容，不要代替用户发言，不要添加额外说明。';

// ===== 状态提取工具 =====
/** 清洗状态值：去除尾随逗号/分号、包裹引号、多余空格 */
function sanitizeValue(val: string): string {
  if (typeof val !== 'string') return String(val ?? '');
  if (!val) return val;
  return val
    .trim()
    .replace(/^["']|["']$/g, '')    // 去掉包裹的引号
    .replace(/[,;]+$/, '')           // 去掉尾随逗号/分号
    .trim();
}

// 从消息内容中提取场景头和状态块（[STATUS] 块格式）
export function extractStatusFromContent(
  content: string,
  fieldConfig?: { sceneFields?: string[]; infoFields?: string[]; statusFields?: string[] }
): {
  sceneHeader?: string;
  infoLines: { label: string; value: string }[];
  statusLines: { label: string; value: string }[];
} {
  if (typeof content !== 'string') {
    return { sceneHeader: undefined, infoLines: [], statusLines: [] };
  }
  const result = {
    sceneHeader: undefined as string | undefined,
    infoLines: [] as { label: string; value: string }[],
    statusLines: [] as { label: string; value: string }[],
  };

  const sceneFields = fieldConfig?.sceneFields ?? ['时间', '地点', '天气', '场景', '氛围'];
  const infoFields = fieldConfig?.infoFields ?? ['姓名', '年龄', '身高', '体重', '三围', '胸围', '腰围', '臀围', '发色', '瞳色', '肤色', '服装', '特征', '性格', '职业', '学历', '信仰', '居住', '种族', '初潮', '初潮年龄', '手淫经验', '性经验', '性知识', '自慰频率', '敏感带', '癖好', '随机事实', '乳房开发程度', '阴道开发程度', '阴蒂开发程度', '尿道开发程度', '子宫开发程度', '膀胱开发程度', '肛门开发程度'];
  const statusFields = fieldConfig?.statusFields ?? ['脸颊', '瞳孔', '嘴唇', '唾液', '呼吸', '乳头', '乳晕', '子宫', '纹身', '阴唇', '阴蒂', '阴毛', '淫水', '肛门', '尿道口', '上衣', '下衣', '胸部', '下阴', '大腿', '指尖', '心情', '疲劳', '体力', '阴道', '尿道', '阴道口', '膀胱', '内裤', '内衣'];

  // 支持多种状态块格式：[STATUS]（大小写不敏感）、【状态】
  let statusMatch = content.match(/\[STATUS\]([\s\S]*?)\[\/STATUS\]/i);
  if (!statusMatch) {
    statusMatch = content.match(/【状态】\n?([\s\S]*?)(?=\n【|$|【)/);
  }
  if (!statusMatch) {
    // 兼容无闭合 [/STATUS] 标签：通过花括号平衡匹配 [STATUS] 后的大括号块
    const startTag = content.match(/\[STATUS\]\s*(\{)/i);
    if (startTag) {
      const startIdx = startTag.index! + startTag[0].length - 1; // 指向 '{'
      let depth = 1;
      let endIdx = -1;
      for (let i = startIdx + 1; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') {
          depth--;
          if (depth === 0) { endIdx = i + 1; break; }
        }
      }
      if (endIdx > 0) {
        const block = content.slice(startIdx, endIdx);
        statusMatch = ['', block];
      }
    }
  }
  // 如果找不到 [STATUS] 块，尝试从 ```json 代码块中提取
  if (!statusMatch) {
    const jsonBlockMatch = content.match(/```json\n?([\s\S]*?)```/i);
    if (jsonBlockMatch) {
      statusMatch = jsonBlockMatch;
    }
  }
  if (statusMatch) {
    // 先尝试 JSON 解析（兼容新格式）
    const blockContent = statusMatch[1].trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(blockContent);
    } catch {
      // JSON 解析失败时，尝试修复无引号 key 再解析
      try {
        // Step 1: Quote all bare keys (ASCII + CJK + hyphen)
        let fixed = blockContent.replace(/([{,]\s*)([a-zA-Z0-9_\u4e00-\u9fff\u3400-\u4dbf-]+)(\s*:)/g, '$1"$2"$3');
        // Step 2: Quote unquoted string values
        fixed = fixed.replace(/:\s*([^"{\[\]tfn][^,\]\n}]*),?/g, (match: string, value: string) => {
          const trimmed = value.trim().replace(/,$/, '');
          // 数字值优先判断（纯数字不加引号，必须放在结构标记判断之前）
          if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return `: ${trimmed}`;
          // Skip JSON structural tokens (prevents \s* backtracking from matching `{`/`[`/`"`)
          if (['{', '[', '"'].includes(trimmed[0])) return match;
          if (['true', 'false', 'null'].includes(trimmed.toLowerCase())) return match;
          const escaped = trimmed.replace(/"/g, '\\"');
          const comma = match.endsWith(',') ? ',' : '';
          return `: "${escaped}"${comma}`;
        });
        parsed = JSON.parse(fixed);
      } catch {
        console.debug('[StatusParser] JSON 修复失败，回退到逐行解析:', blockContent.slice(0, 100));
      }
    }
    if (parsed && typeof parsed === 'object') {
        // 场景信息
        const sceneParts: string[] = [];
        if (parsed.time) sceneParts.push(`时间: ${parsed.time}`);
        if (parsed.location) sceneParts.push(`地点: ${parsed.location}`);
        if (parsed.scene) sceneParts.push(`场景: ${parsed.scene}`);
        if (sceneParts.length > 0) result.sceneHeader = sceneParts.join(' | ');

        // 角色信息
        if (parsed.info && typeof parsed.info === 'object') {
          for (const [key, val] of Object.entries(parsed.info)) {
            if (val != null && val !== '') result.infoLines.push({ label: key, value: sanitizeValue(String(val)) });
          }
        }

        // 状态字段
        if (parsed.status && typeof parsed.status === 'object') {
          for (const [key, val] of Object.entries(parsed.status)) {
            if (val != null && val !== '') result.statusLines.push({ label: key, value: sanitizeValue(String(val)) });
          }
        }

        // 处理 clothing 嵌套对象
        if (parsed.clothing && typeof parsed.clothing === 'object') {
          for (const [key, val] of Object.entries(parsed.clothing)) {
            if (val != null && val !== '') result.infoLines.push({ label: `衣着-${key}`, value: sanitizeValue(String(val)) });
          }
        }

        // 处理 body 嵌套对象
        if (parsed.body && typeof parsed.body === 'object') {
          for (const [key, val] of Object.entries(parsed.body)) {
            if (val != null && typeof val === 'object') {
              // 二级嵌套：如 body.胸部 = {罩杯: "C", 胸围: "88cm"}
              for (const [subKey, subVal] of Object.entries(val)) {
                if (subVal != null && subVal !== '') result.infoLines.push({ label: `${key}-${subKey}`, value: sanitizeValue(String(subVal)) });
              }
            } else if (val != null && val !== '') {
              result.infoLines.push({ label: key, value: sanitizeValue(String(val)) });
            }
          }
        }

        // 处理 story
        if (parsed.story) {
          result.infoLines.push({ label: '剧情', value: String(parsed.story).slice(0, 100) });
        }

        // 处理用户自定义字段：身体/服装/记忆修正等非标准key
        if (!result.sceneHeader && !result.infoLines.length && !result.statusLines.length) {
          // 兜底：将未识别的第一层 key 按规则分类
          for (const [key, val] of Object.entries(parsed)) {
            if (['time','location','scene','info','status','body','clothing','story','场景','时间','地点'].includes(key)) continue;
            if (['身体','服装','记忆修正'].includes(key)) continue;
            // 角色名对象 → 展开为 info
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              for (const [subKey, subVal] of Object.entries(val)) {
                if (subVal != null && subVal !== '') {
                  result.infoLines.push({ label: subKey, value: sanitizeValue(String(subVal)) });
                }
              }
            }
          }
          // 身体 → 取生理和心理作为 statusLines
          if (parsed['身体'] && typeof parsed['身体'] === 'object') {
            const body = parsed['身体'];
            if (body.生理) result.statusLines.push({ label: '生理', value: sanitizeValue(String(body.生理)) });
            if (body.心理) result.statusLines.push({ label: '心理', value: sanitizeValue(String(body.心理)) });
            // 身体.细节 → 展开为 info（递归展开所有层级，避免 [object Object]）
            if (body.细节 && typeof body.细节 === 'object') {
              const flattenDetail = (obj: any, prefix: string) => {
                for (const [key, val] of Object.entries(obj)) {
                  const fullKey = prefix ? `${prefix}-${key}` : key;
                  if (val != null && typeof val === 'object' && !Array.isArray(val)) {
                    // 对象→递归继续展开
                    flattenDetail(val, fullKey);
                  } else if (val != null && val !== '') {
                    result.infoLines.push({ label: fullKey, value: sanitizeValue(String(val)) });
                  }
                }
              };
              flattenDetail(body.细节, '');
            }
          }
          // 服装
          if (parsed['服装'] && typeof parsed['服装'] === 'object') {
            for (const [key, val] of Object.entries(parsed['服装'])) {
              if (val != null && val !== '') result.infoLines.push({ label: `衣着-${key}`, value: sanitizeValue(String(val)) });
            }
          }
          // 记忆修正（数组）→ 展开为 infoLines
          if (parsed['记忆修正'] && Array.isArray(parsed['记忆修正'])) {
            for (const item of parsed['记忆修正']) {
              if (item && typeof item === 'object') {
                const type = item['类型'] || item.type || '';
                const content = item['内容'] || item.content || '';
                if (content) {
                  result.infoLines.push({
                    label: `记忆修正${type ? `-${type}` : ''}`,
                    value: sanitizeValue(String(content)),
                  });
                }
              }
            }
          }
        }

        return result;  // JSON 解析成功，直接返回
    }

    // 逐行解析（清洗前缀，兼容旧格式）
    const lines = statusMatch[1].split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      // 支持中文冒号和英文冒号
      const sep = line.includes('：') ? '：' : ':';
      const idx = line.indexOf(sep);
      if (idx <= 0) continue;

      let label = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!label || !value) continue;

      // 清洗列表前缀：- 脸颊 → 脸颊
      label = label.replace(/^[-*•]\s*/, '').trim();
      if (!label) continue;

      // 场景/时间/地点/天气 → sceneHeader
      if (sceneFields.includes(label)) {
        result.sceneHeader = result.sceneHeader || '';
        result.sceneHeader += `${result.sceneHeader ? ' | ' : ''}${label}: ${value}`;
        continue;
      }

      // 角色信息类字段
      if (infoFields.includes(label)) {
        result.infoLines.push({ label, value: sanitizeValue(value) });
        continue;
      }

      // 显式配置了 statusFields → 仅匹配的归为状态，其余忽略
      if (statusFields && statusFields.length > 0) {
        if (statusFields.includes(label)) {
          result.statusLines.push({ label, value: sanitizeValue(value) });
        }
        continue;
      }

      // 未配置 statusFields → 其他全部归为状态（原逻辑）
      result.statusLines.push({ label, value: sanitizeValue(value) });
    }
  }

  // ===== 第二阶段：提取散装格式（始终执行，不依赖状态块是否匹配）=====
  const regex = /【([^】]+?)】([\s\S]*?)(?=\n【|$|\n{2})/g;
  let bracketMatch;
  while ((bracketMatch = regex.exec(content)) !== null) {
    const title = bracketMatch[1].trim();
    const value = bracketMatch[2].trim();
    if (!title || !value) continue;

    // 跳过已被状态块处理的 【状态】 块
    if (title === '状态') continue;
    // 如果已解析了状态块中的 scene 字段，跳过避免重复
    if (statusMatch && ['场景', '位置', '时间', '天气', '地点', '氛围'].includes(title)) continue;

    // 场景/位置/时间 → sceneHeader
    if (['场景', '位置', '时间', '天气', '地点', '氛围'].includes(title)) {
      result.sceneHeader = result.sceneHeader || '';
      result.sceneHeader += `${result.sceneHeader ? ' | ' : ''}${title}: ${value}`;
      continue;
    }

    // 包含"状态"的标题 → statusLines（如 "阿比盖尔 状态"、"角色状态"）
    if (title.includes('状态') || title.includes('Status')) {
      // 对长文本状态值按标点拆解为多条独立状态
      if (title.includes('状态') && value.length > 30) {
        // 按句号/分号/感叹号拆解
        const sentences = value.split(/[。；！.;!]/).map(s => s.trim()).filter(Boolean);
        if (sentences.length > 1) {
          for (let i = 0; i < sentences.length; i++) {
            result.statusLines.push({ label: `${title}#${i + 1}`, value: sanitizeValue(sentences[i]) });
          }
        } else {
          result.statusLines.push({ label: title, value: sanitizeValue(value) });
        }
      } else {
        result.statusLines.push({ label: title, value: sanitizeValue(value) });
      }
      continue;
    }

    // 其他 → infoLines
    // 尝试按行拆解多行内容（如 【角色信息】 块中的 姓名:xxx\n年龄:xxx）
    const lines = value.split('\n').map(l => l.trim()).filter(Boolean);
    const hasMultiFields = lines.length > 1 && lines.every(l => l.includes('：') || l.includes(':'));
    if (hasMultiFields) {
      for (const line of lines) {
        const sep = line.includes('：') ? '：' : ':';
        const idx = line.indexOf(sep);
        if (idx > 0) {
          result.infoLines.push({
            label: line.slice(0, idx).trim(),
            value: sanitizeValue(line.slice(idx + 1).trim()),
          });
        }
      }
    } else {
      result.infoLines.push({ label: title, value: sanitizeValue(value) });
    }
  }

  return result;
}

// LRU 缓存：避免对相同内容重复执行正则替换
const stripCache = new Map<string, string>();
const CACHE_MAX = 50;

// 从消息内容中移除状态块（[STATUS] 块和散装【标题】内容格式），只保留叙事内容
export function stripStatusBlocks(content: string): string {
  if (typeof content !== 'string') return '';

  // 缓存命中
  if (stripCache.has(content)) return stripCache.get(content)!;

  // 1. 移除 [STATUS]...[/STATUS] 块
  let cleaned = content.replace(/\[STATUS\][\s\S]*?\[\/STATUS\]/gi, '');
  // 2. 移除 ```json 状态代码块（已由 extractStatusFromContent 消费）
  cleaned = cleaned.replace(/```json[\s\S]*?```/gi, '');

  // 3. 移除散装状态格式：【场景】xxx、【位置】xxx、【时间】xxx、【天气】xxx 等
  cleaned = cleaned.replace(/【(场景|位置|时间|地点|天气|氛围)】[^】\n]*(?:\n|$)/g, '');

  // 4. 移除任何以"状态"结尾的标题格式：【xxx状态】xxx
  cleaned = cleaned.replace(/【[^】]*?状态】[^】\n]*(?:\n|$)/g, '');

  // 5. 压缩连续空行（3个以上换行符 → 2个换行符，即最多保留一个空行）
  cleaned = cleaned.replace(/\n{2,}/g, '\n');

  // 6. 清理首尾空白
  cleaned = cleaned.trim();

  // 写入缓存（限制大小防止内存泄漏）
  if (stripCache.size >= CACHE_MAX) {
    const firstKey = stripCache.keys().next().value;
    if (firstKey) stripCache.delete(firstKey);
  }
  stripCache.set(content, cleaned);

  return cleaned;
}

// ===== 通用工具函数 =====
// 从 AI 输出文本中提取 JSON
export function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) { try { return JSON.parse(match[1].trim()); } catch {} }
  const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
  if (fb >=0 && lb > fb) { try { return JSON.parse(text.slice(fb, lb+1)); } catch {} }
  throw new Error('无法解析 AI 输出');
}


