const readline = require("readline");

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function buildSummary(notes) {
  const validNotes = notes
    .map((note) => String(note?.content || "").trim())
    .filter(Boolean);

  if (validNotes.length === 0) {
    return {
      summary: "当前没有可总结的笔记。",
      count: 0,
      keywords: [],
      categories: [],
    };
  }

  const keywords = extractKeywords(validNotes);
  const categories = classifyCategories(validNotes);
  const summary = composeSummary(validNotes, categories);

  return {
    summary,
    count: validNotes.length,
    keywords,
    categories,
  };
}

function extractKeywords(notes) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "follow",
    "need",
    "todo",
  ]);

  const counts = new Map();

  for (const note of notes) {
    const words = note.toLowerCase().match(/[a-z0-9]+/g) || [];
    for (const word of words) {
      if (word.length < 3 || stopWords.has(word)) {
        continue;
      }
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word]) => word);
}

function classifyCategories(notes) {
  const categoryRules = [
    {
      name: "开发修复",
      keywords: ["bug", "fix", "login", "release", "deploy", "api", "error", "修复", "登录", "发布", "接口"],
    },
    {
      name: "协作沟通",
      keywords: ["client", "meeting", "follow", "design", "sync", "review", "沟通", "客户", "会议", "对齐", "设计"],
    },
    {
      name: "内容准备",
      keywords: ["workshop", "content", "idea", "draft", "doc", "plan", "分享", "内容", "方案", "文档", "草稿"],
    },
  ];

  const results = categoryRules
    .map((rule) => {
      const items = notes.filter((note) => {
        const lower = note.toLowerCase();
        return rule.keywords.some((keyword) => lower.includes(keyword));
      });

      return {
        name: rule.name,
        count: items.length,
        items,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const matched = new Set(results.flatMap((item) => item.items));
  const uncategorized = notes.filter((note) => !matched.has(note));

  if (uncategorized.length > 0) {
    results.push({
      name: "其他事项",
      count: uncategorized.length,
      items: uncategorized,
    });
  }

  return results;
}

function composeSummary(notes, categories) {
  const head = `当前共有 ${notes.length} 条待处理笔记。`;

  if (categories.length === 0) {
    return `${head} 主要为零散事项。`;
  }

  const categoryText = categories
    .map((category) => `${category.name}${category.count}条`)
    .join("，");

  const topExamples = categories
    .slice(0, 2)
    .map((category) => `${category.name}：${category.items.slice(0, 2).join("；")}`)
    .join("；");

  return `${head} 主要集中在${categoryText}。示例：${topExamples}。`;
}

function handleCall(params) {
  const action = params?.action || params?.name;
  if (action !== "summarize") {
    return {
      error: { code: -32602, message: "Unsupported action" },
    };
  }

  return {
    result: buildSummary(params?.payload?.notes || params?.arguments?.notes || []),
  };
}

function handleRequest(message) {
  const { id, method, params } = message || {};

  if (!id || typeof method !== "string") {
    send({
      jsonrpc: "2.0",
      id: id || null,
      error: { code: -32600, message: "Invalid Request" },
    });
    return;
  }

  if (method === "describe") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        name: "mini-notes-summarizer",
        description: "使用简单关键词归类规则对短笔记做总结。",
        actions: [
          {
            name: "summarize",
            description: "对当前笔记列表做规则总结。",
          },
        ],
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string" },
            payload: {
              type: "object",
              properties: {
                notes: { type: "array" },
              },
            },
          },
        },
      },
    });
    return;
  }

  if (method === "call" || method === "invoke") {
    const response = handleCall(params);
    send({
      jsonrpc: "2.0",
      id,
      ...(response.error ? { error: response.error } : { result: response.result }),
    });
    return;
  }

  send({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" },
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", (line) => {
  if (!line.trim()) {
    return;
  }

  try {
    const message = JSON.parse(line);
    handleRequest(message);
  } catch {
    send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
});
