# 灵垛 LingDuo — AI 装箱码垛平台

自然语言驱动的 3D 装箱码垛仿真平台。基于 AgentScope 2.0 + @cratefit/pack。

## 架构

```
┌──────────────────────────────────────────┐
│  前端 (cratefit-website demo)            │
│  ┌────────────┐  ┌────────────────────┐  │
│  │ ChatSidebar│  │ 3D Viewer (cratefit)│ │
│  │ (Agent 对话)│  │ ViewerControls      │ │
│  │            │  │ StatsPanel          │  │
│  └────────────┘  └────────────────────┘  │
└──────────────────────────────────────────┘
        │ SSE (/api/chat)
        ▼
┌──────────────────────────────────────────┐
│  后端 (AgentScope 2.0)                   │
│  ┌────────────────────────────────────┐  │
│  │  PackAgent (ReActAgent)            │  │
│  │  ├── Model: DashScope Qwen         │  │
│  │  ├── Tools: MCP 封装               │  │
│  │  │   @cratefit/pack                │  │
│  │  └── Event Stream → SSE            │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  pack_tool.mjs (Node.js)           │  │
│  │  @cratefit/pack 完整 CLI 封装      │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## 技术栈

| 层 | 技术 |
|---|---|
| Agent 框架 | AgentScope 2.0 (Python) |
| LLM | DashScope / Qwen |
| 前端 | Next.js 16 + React 19 (TypeScript) |
| 3D 可视化 | @cratefit/viz + Three.js |
| 装箱算法 | @cratefit/pack |
| 后端 | FastAPI + SSE |

## 快速开始

### 前置要求

- Node.js >= 18
- Python >= 3.11
- DashScope API Key

### 1. 后端

```bash
cd backend
cp .env.example .env   # 编辑填入 DASHSCOPE_API_KEY
pip install -r requirements.txt
python main.py          # → http://localhost:8000
```

### 2. 前端

```bash
cd reference/cratefit-website
npm install
npm run dev             # → http://localhost:3000
```

### 3. 使用

打开 `http://localhost:3000`，在左侧聊天框输入码垛需求：

> 用EUR托盘码放400×300×200mm的箱子25个

Agent 自动解析需求 → 填入配置 → 右侧 3D 场景展示结果。

## 项目结构

```
lingduo_agent/
├── backend/                       # Python 后端 (AgentScope 2.0)
│   ├── main.py                    # FastAPI 入口 + SSE
│   ├── agent.py                   # PackAgent (LLM → 装箱配置)
│   ├── pack_api.py                # MCP 工具封装
│   ├── tools/
│   │   ├── pack_tool.mjs          # Node.js @cratefit/pack CLI
│   │   └── pack-service/          # npm 依赖
│   └── requirements.txt
├── reference/
│   ├── cratefit-website/          # 前端 (demo only)
│   │   ├── app/                   # Next.js pages
│   │   ├── components/demo/       # 装箱组件 + ChatSidebar
│   │   └── lib/                   # demo-store, utils
│   └── abb-offline-coder/         # 机器人代码生成参考
├── docker-compose.yml
└── prd.md
```
