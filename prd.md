# 灵垛（LingDuo）— 产品需求文档 v0.2

## 一、项目定位

"灵垛"是一款 AI 驱动的 3D 装箱码垛仿真平台。用户通过自然语言描述需求，Agent 自动解析参数并驱动装箱算法，3D 场景实时展示结果。

核心原则：**绝不重复造轮子** — 装箱算法复用 @cratefit/pack，3D 可视化复用 cratefit-website demo，Agent 框架使用 AgentScope 2.0。

## 二、当前状态 (v0.2)

### 已实现

- [x] AgentScope 2.0 PackAgent（自然语言 → 装箱配置）
- [x] @cratefit/pack MCP 工具封装（packPallet, pack, packContainer, packTruck）
- [x] ChatSidebar 对话面板（左侧 chatbot 交互）
- [x] cratefit 3D 场景复用（Viewer3D + ViewerControls + StatsPanel）
- [x] SSE 流式事件推送
- [x] 4 种装箱场景：托盘码垛 / 通用装箱 / 集装箱装载 / 卡车装载
- [x] 4 种算法支持：extreme-point / layer-building / wall-building / eb-afit

### 待实现

- [ ] 多轮对话上下文记忆
- [ ] RAG 知识库（箱子规格管理）
- [ ] 机器人代码生成（ABB/KUKA/FANUC）
- [ ] 多智能体协作（AgentScope Agent Team）
- [ ] 用户认证与多会话管理

## 三、技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| Agent 框架 | AgentScope 2.0 | ReActAgent + MCP 工具 |
| LLM | DashScope Qwen | 可切换 GPT-4 / Claude |
| 装箱算法 | @cratefit/pack (NPM) | 通过 Node.js CLI 封装为 MCP 工具 |
| 3D 可视化 | @cratefit/viz + Three.js | 复用 cratefit-website demo |
| 前端 | Next.js 16 + React 19 | cratefit-website 改造版 |
| 后端 | FastAPI + SSE | AgentScope 事件流推送 |

## 四、MCP 工具列表

| 工具 | 说明 |
|------|------|
| calculate_packing | 核心装箱计算（支持 pallet/box/container/truck） |
| compare_algorithms | 4 种算法横向对比 |
| get_pallet_standards | 查询 8 种标准托盘尺寸 |
| get_container_standards | 查询 4 种标准集装箱尺寸 |

## 五、架构图

```
用户自然语言 → ChatSidebar → SSE → PackAgent (AgentScope)
                                       │
                                       ├── LLM 解析意图
                                       ├── 调用 MCP 工具
                                       │   └── pack_tool.mjs → @cratefit/pack
                                       └── 返回配置 + 结果
                                            │
前端接收 config → loadConfig() → autoPack → 3D 渲染
```

## 六、参考项目

- @cratefit/pack: https://www.npmjs.com/package/@cratefit/pack
- @cratefit/viz: https://www.npmjs.com/package/@cratefit/viz
- AgentScope 2.0: https://github.com/agentscope-ai/agentscope
- abb-offline-coder: 机器人代码生成参考（Phase 4）
