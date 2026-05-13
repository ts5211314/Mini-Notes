# Mini Notes

这是一个按照 Anna 开发文档设计思路实现的本地最小示例，用于完成面试题中的 `Mini Notes App`。

项目目标不是接入完整线上平台，而是理解并体现 Anna App、Executa Tool、`JSON-RPC over stdio`、`manifest` 和本地 harness 的设计模型。

## 项目包含内容

- 一个本地可运行的前端 UI，用于创建、查看、删除笔记
- 一个本地 `Executa` 风格 tool，通过 `stdin/stdout` 处理 `JSON-RPC 2.0`
- 一个本地 Node 服务，用于在非 Anna harness 环境下模拟调用链
- 一个最小 `manifest.json`，表达 app 入口和 tool 关系

## 功能说明

- 创建简短笔记
- 按添加顺序查看已保存笔记
- 删除笔记
- 点击 `Summarize` 对当前全部笔记生成总结

## 对 Anna 核心概念的理解

### Anna App 是什么

Anna App 可以理解为运行在 Anna host/runtime 内的一段前端应用。它本身主要负责 UI、用户交互和状态管理，不直接承担复杂工具执行，而是通过 host API 调用平台提供的能力。

在这个项目里，前端页面就是 Anna App 的最小近似实现。

### Executa Tool 是什么

Executa Tool 可以理解为一个由 Anna App 调用的本地工具进程。它通常承担某个明确能力，比如总结、转换、提取或分析。Anna App 不需要知道 tool 的内部实现，只通过约定协议发请求、收结果。

在这个项目里，`tool/executa-tool.js` 就是本地 tool，负责把笔记做简单关键词归类总结。

### JSON-RPC over stdio 是什么

这是 tool 与 host 之间的一种本地进程通信方式：

- host 启动 tool 进程
- host 通过 `stdin` 发送 JSON-RPC 请求
- tool 通过 `stdout` 返回 JSON-RPC 响应

这里的重点不是 HTTP，而是“本地子进程 + 标准输入输出 + JSON-RPC 协议”。

本项目中的 tool 已实现：

- `describe`
- `call`

同时兼容了此前本地调试使用的 `invoke`，但主路径已经收敛到 `describe + call`。

### manifest 的作用

`manifest` 的作用是声明这个 app 是什么、入口在哪里、会用到哪些 tool，以及运行时应如何理解这个应用结构。

在这个项目里，`manifest.json` 主要承担两件事：

- 声明前端入口文件
- 声明本地 tool 的名字、启动命令、参数和通信方式

### Anna App 的整体架构思路

可以把 Anna App 理解成下面这个结构：

1. 前端 bundle 被 Anna runtime 加载
2. 页面通过 `AnnaAppRuntime.connect()` 连接 host API
3. 前端通过 host API 调用 tool
4. host 启动本地 tool 进程
5. host 与 tool 通过 `JSON-RPC over stdio` 通信
6. tool 返回结果后，前端更新 UI

这个项目就是按这个思路做的最小闭环。

## 当前实现的调用链

本项目前端启动后会优先执行：

```js
AnnaAppRuntime.connect()
```

如果运行在 Anna harness 中，预期会拿到 host API，再通过 host 调用 tool。

本项目当前优先尝试：

- `host.tools.call(...)`
- 兼容 `host.tools.invoke(...)`

如果当前不是 Anna harness 环境，就退回到本地：

- `POST /api/summarize`

本地 Node 服务再去启动同一个 tool 进程，从而保持“前端不直接实现 summary，而是通过 tool 边界完成”的设计。

## Summary 生成规则

这里不接真实 LLM，而是按题目要求使用简单规则生成 summary：

- 先统计当前笔记总数
- 再按关键词做简单归类
- 输出分类数量
- 输出部分示例内容

当前内置分类：

- `开发修复`
- `协作沟通`
- `内容准备`
- `其他事项`

## 目录说明

- `public/` 前端静态资源
- `server.js` 本地开发服务器
- `tool/executa-tool.js` 基于 stdio 的 JSON-RPC tool
- `tool/tool-client.js` 本地服务使用的 tool 调用封装
- `scripts/test-tool.js` tool 联调脚本
- `manifest.json` 最小 manifest 文件

## 运行方式

环境要求：

- Node.js 18 及以上

安装依赖：

```bash
npm install
```

启动本地独立模式：

```bash
npm run dev
```

打开页面：

```text
http://localhost:3000
```

## 直接测试 JSON-RPC Tool

执行：

```bash
npm run tool:test
```

这个脚本会启动 tool，先发送 `describe`，再发送 `call` 请求，并打印返回结果。

## Tool 协议示例

请求示例：

```json
{
  "jsonrpc": "2.0",
  "id": "call-1",
  "method": "call",
  "params": {
    "name": "summarize",
    "arguments": {
      "notes": [
        { "id": "1", "content": "Fix login bug" }
      ]
    }
  }
}
```

返回示例：

```json
{
  "jsonrpc": "2.0",
  "id": "call-1",
  "result": {
    "summary": "当前共有 1 条待处理笔记。主要集中在开发修复1条。示例：开发修复：Fix login bug。",
    "count": 1,
    "keywords": ["bug", "fix"],
    "categories": [
      {
        "name": "开发修复",
        "count": 1,
        "items": ["Fix login bug"]
      }
    ]
  }
}
```



