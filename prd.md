灵垛（LingDuo）AI+混合码垛算法开发与仿真平台 — 技术开发规格书

目标读者：Claude Code / AI 编程助手
核心原则：绝不重复造轮子 — 每个模块都基于成熟的 GitHub 开源项目/NPM 库进行集成与适配
一、项目概述

1.1 项目定位

“灵垛”是一款面向高校机器人、自动化、人工智能相关专业的 Web 端实训教学平台。它以码垛这一典型工业场景为载体，将大语言模型（LLM）、运筹优化算法、3D仿真、机器人离线编程等前沿技术融合，为学生提供从自然语言需求到完整码垛方案的一站式实验环境-。

1.2 核心功能（一句话版）

用户在浏览器中用自然语言描述码垛需求 → 系统自动解析 → 调用算法计算最优垛型 → 3D动画展示码垛过程 → 支持多轮对话调整 → 导出机器人程序文件
1.3 目标用户与使用场景

用户	场景
教师	课堂演示、实验教学、课程设计
学生	完成实验报告、算法对比研究、项目开发
实验室管理员	快速部署、无需安装客户端
二、技术选型与参考项目（核心：复用“轮子”）

2.1 智能体框架 — AgentScope 2.0（Python）

选型理由：AgentScope 2.0 是生产级的 AI Agent 开发框架，具备以下与项目高度契合的特性-：

特性	对项目的价值
Event System（事件系统）	将 Agent 推理过程流式推送到前端，实现“思考过程可视化”
Multi-tenancy & Multi-session	支持多学生同时使用，会话隔离
Workspace / Sandbox	安全执行算法代码，隔离运行环境
RAG 支持	内置知识库能力，用于管理箱子规格型号
Middleware System	可在推理-行动循环中插入自定义逻辑
官方资源：

• GitHub：https://github.com/agentscope-ai/agentscope[reference:8]
• 文档：https://docs.agentscope.io/
• 中文 README：https://github.com/agentscope-ai/agentscope/blob/main/README_zh.md
版本要求：使用 v2.0.0 及以上版本-

2.2 核心码垛算法 — @cratefit/pack（NPM）

选型理由：这是项目中最关键的“轮子”，直接决定码垛方案的质量。

@cratefit/pack 是一个功能强大的 3D 装箱库，支持-7-：

• 多种算法：极值点（Extreme Point）、层构建（Layer Building）、墙体构建（Wall Building）、EB-AFIT-7
• 元启发式优化：模拟退火、禁忌搜索、遗传算法-7
• 内置标准：托盘规格（EUR、ISO 等）-7
• 高级约束：重量限制、堆叠规则、旋转限制、支撑检查-7
• 专用函数：packPallet() 专用于托盘码垛-7
javascript
复制
下载
// 核心用法示例（直接取自官方文档）
import { packPallet, PALLET_STANDARDS } from '@cratefit/pack';

const result = packPallet({
  pallet: PALLET_STANDARDS.EUR1,  // 1200x800mm 欧标托盘
  items: [
    { id: 'box1', width: 400, height: 300, depth: 200, weight: 10, quantity: 25 },
    { id: 'box2', width: 300, height: 200, depth: 150, weight: 5, quantity: 18 }
  ],
  options: {
    maxStackHeight: 1800,
    stackingRules: true,           // 启用堆叠规则
    algorithm: 'layer-building'    // 层构建算法，最稳定
  }
});
官方资源：

• NPM：https://www.npmjs.com/package/@cratefit/pack[reference:20]
• 版本：0.1.1-7
2.3 3D 可视化 — @cratefit/viz + Three.js

选型理由：@cratefit/viz 是 @cratefit/pack 的官方可视化模块，基于 Three.js，开箱即用，无需从零搭建 3D 场景-9。

核心功能-9：

功能	API
2D 顶视图/前视图/侧视图	renderTopView, renderFrontView, renderSideView
3D 交互场景	create3DScene, renderPackedBin3D
码垛序列动画	animatePacking — 逐层播放码垛过程
爆炸视图	createExplosionView — 展示每层结构
分层显示	showByLayer — 单独查看某一层
javascript
复制
下载
// 3D 可视化示例（官方文档）
import { create3DScene, renderPackedBin3D, animate } from '@cratefit/viz';

const container = document.getElementById('container');
const { scene, camera, renderer, controls } = await create3DScene(container);
await renderPackedBin3D(scene, result.packed[0], { showEdges: true });
animate(renderer, scene, camera, controls);
安装命令：

bash
复制
下载
npm install @cratefit/pack @cratefit/viz three
官方资源：

• NPM：https://www.npmjs.com/package/@cratefit/viz[reference:25]
2.4 前端框架 — React 19 + TypeScript + Vite

选型理由：AgentScope 官方 Web UI 基于 React 构建-，保持技术栈一致可最大化复用。

推荐参考项目：

项目	用途	链接
3D Node Visualization	React Three Fiber + GSAP 3D 可视化示例	https://github.com/hemjay07/3d-node-visualization[reference:27]
react-threejs-examples	React Three Fiber 学习项目	https://github.com/alexyunxiang/react-threejs-examples[reference:28]
3D-Mine-Lab	Next.js + React Three Fiber 高性能 3D 应用	https://github.com/planwithdata/3D-Mine-Lab[reference:29]
2.5 机器人代码生成 — 模板引擎 + 参考项目

核心思路：不自己实现机器人代码生成逻辑，而是使用 Jinja2 模板引擎（Python 后端）填充点位数据，生成特定品牌机器人的程序文件。

可直接参考的开源项目：

项目	说明	借鉴点
abb-offline-coder	中文需求 → ABB RAPID 程序（.mod 文件）	代码模板结构、RAG 知识库设计
RoboDK-API	支持任何工业机器人的仿真与离线编程-	API 设计思路、多品牌适配方案
Palletizer OS	开源码垛软件基础，硬件无关设计-28	模块化架构、混合 SKU 处理-28
代码模板策略：

text
复制
下载
用户选择机器人品牌（ABB/KUKA/FANUC）
    ↓
后端加载对应的 Jinja2 模板
    ↓
填充 @cratefit/pack 计算出的点位数据（x, y, z, 旋转角度）
    ↓
生成可下载的 .mod / .src 文件
2.6 其他可借鉴的 GitHub 项目

项目	说明	借鉴点
Smart Stowage	Gemini 3 + Three.js 3D 货物数字孪生-	React 19 + Three.js 架构、实时物理稳定性分析-
3D Warehouse Simulator	Three.js 仓储 3D 可视化-	3D 场景布局、交互控制
automation-sim	Three.js 仓库仿真-	动画传送带、动态货架系统-
三、系统架构

3.1 整体架构图

text
复制
下载
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (React 19 + TS)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  聊天界面     │  │  3D 场景     │  │  参数控制面板        │ │
│  │  (AgentScope  │  │  (@cratefit/ │  │  (知识库管理/        │ │
│  │   Web UI)     │  │   viz + R3F) │  │   算法切换)          │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ SSE (流式事件) + REST API
┌─────────────────────────────────────────────────────────────────┐
│                     后端 (Python + AgentScope 2.0)              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Supervisor Agent (主控智能体)                             │ │
│  │  ├── 意图解析 (LLM: GPT-4 / Qwen / Claude)               │ │
│  │  ├── 多轮对话管理 (Session)                               │ │
│  │  └── 任务分发                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Planner      │  │ Knowledge    │  │ Code Generator       │ │
│  │ Subagent     │  │ Subagent     │  │ Subagent             │ │
│  │ (调用        │  │ (RAG +       │  │ (Jinja2 模板 +       │ │
│  │ @cratefit/   │  │  向量检索)   │  │  机器人品牌适配)     │ │
│  │  pack)       │  │              │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Workspace / Sandbox (隔离执行环境)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
3.2 模块划分与职责

模块	技术实现	职责
前端 UI	React 19 + TypeScript + Vite	聊天界面、3D 场景、控制面板
3D 渲染	@cratefit/viz + Three.js	码垛结果 3D 展示、动画
Agent 框架	AgentScope 2.0 (Python)	多智能体编排、对话管理、事件流
LLM 集成	AgentScope 内置模型适配器	自然语言→结构化参数
码垛算法	@cratefit/pack (NPM)	核心码垛计算
知识库	AgentScope RAG 模块	箱子规格管理、语义检索
代码生成	Jinja2 + 机器人品牌模板	导出机器人程序文件
前后端通信	SSE (流式) + REST API	实时事件推送、状态同步
四、开发步骤（分阶段实施）

Phase 1：基础框架搭建（1-2周）

目标：跑通“用户输入 → Agent 响应 → 3D 展示”的最小闭环。

1. 初始化 AgentScope 项目

bash
复制
下载
pip install agentscope
参考官方快速开始：https://docs.agentscope.io/
2. 搭建前端骨架

◦ Vite + React 19 + TypeScript-
◦ 集成 AgentScope 官方 Web UI 示例-
3. 集成 @cratefit/pack

bash
复制
下载
npm install @cratefit/pack @cratefit/viz three
◦ 编写一个简单的测试脚本，验证码垛计算功能-7
4. 实现 3D 场景渲染

◦ 使用 create3DScene + renderPackedBin3D 渲染码垛结果-9
◦ 验证 3D 场景在浏览器中的展示
Phase 2：Agent 核心逻辑开发（2-3周）

目标：实现自然语言→结构化参数→算法调用→结果返回的完整链路。

1. 设计 Supervisor Agent

◦ 参考 AgentScope 官方示例中的多智能体协作模式
◦ 定义 Agent 间的消息协议
2. 实现意图解析

◦ 使用 AgentScope 的 LLM 适配器（支持 GPT-4/Claude/Qwen 等）
◦ 设计 Prompt，将自然语言解析为 @cratefit/pack 所需的参数结构
3. 实现 Planner Subagent

◦ 接收结构化参数
◦ 调用 @cratefit/pack 的 packPallet() 函数-7
◦ 返回码垛结果
4. 实现事件流推送

◦ 使用 AgentScope 的 Event System 将推理过程推送到前端
◦ 前端实时展示 Agent 的“思考过程”
Phase 3：知识库与多轮对话（1-2周）

目标：支持箱子规格预置和多轮对话调整。

1. 实现 RAG 知识库

◦ 使用 AgentScope 内置 RAG 模块
◦ 导入箱子规格数据（尺寸、重量、型号等）作为知识文档
◦ 用户提到型号时自动检索对应规格
2. 实现多轮对话管理

◦ 使用 AgentScope 的 Multi-session Service
◦ 维护对话上下文，支持“把箱子2放到上面”这类后续指令
Phase 4：机器人代码生成（1-2周）

目标：导出可执行的机器人程序文件。

1. 设计代码模板

◦ 参考 abb-offline-coder 的模板结构
◦ 为 ABB/KUKA/FANUC 各准备一套 Jinja2 模板
2. 实现 Code Generator Subagent

◦ 接收码垛点位数据
◦ 根据用户选择的机器人品牌加载对应模板
◦ 填充点位数据，生成程序文件
3. 提供下载接口

◦ REST API 返回生成的文件
Phase 5：UI 打磨与部署（1-2周）

目标：产品化交付，界面炫酷，易于教学使用。

1. 优化 3D 场景

◦ 添加地面网格、光影效果、半透明托盘轮廓-
◦ 实现 animatePacking 码垛序列动画-9
2. 设计教学友好的 UI

◦ 新手引导（Onboarding Tour）
◦ 算法参数调节面板（切换算法、调整约束）
◦ 对比实验功能（同时展示多种算法结果）
3. 部署方案

◦ 前端：Vercel / 静态托管
◦ 后端：Docker 容器化部署
五、关键开发要点与注意事项

5.1 必须复用的“轮子”清单

功能	复用方案	禁止行为
Agent 框架	AgentScope 2.0	❌ 自研 Agent 框架
码垛算法	@cratefit/pack	❌ 自研 3D 装箱算法
3D 可视化	@cratefit/viz + Three.js	❌ 从零搭建 WebGL 场景
代码生成	Jinja2 + 开源模板	❌ 手写机器人代码生成器
知识库	AgentScope RAG	❌ 自研向量检索
前端 3D	React Three Fiber	❌ 原生 Three.js 手动管理
5.2 前后端通信策略

• 流式事件：使用 SSE (Server-Sent Events) 推送 Agent 推理过程
• 状态管理：使用 REST API 进行配置查询、文件下载等操作
• 原因：SSE 单向流式传输更适合“思考过程可视化”场景，实现简单且兼容性好
5.3 安全与沙箱

• 使用 AgentScope 的 Workspace / Sandbox 功能隔离代码执行
• 支持 Local、Docker、E2B、OpenSandbox 等多种后端
5.4 模型选择建议

场景	推荐模型	理由
教学演示	Qwen / DeepSeek	成本低，中文支持好
高精度解析	GPT-4 / Claude	意图理解准确
离线环境	Qwen2.5-Coder-7B	可本地部署
AgentScope 支持灵活切换模型适配器。

六、项目文件结构建议

text
复制
下载
lingduo/
├── frontend/                      # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface/    # 聊天界面
│   │   │   ├── ThreeScene/       # 3D 场景 (@cratefit/viz)
│   │   │   ├── ControlPanel/     # 参数控制
│   │   │   └── KnowledgeBase/    # 知识库管理
│   │   ├── hooks/                # 自定义 Hooks
│   │   ├── services/             # API 调用
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                       # Python + AgentScope
│   ├── agents/
│   │   ├── supervisor.py         # 主控 Agent
│   │   ├── planner.py            # 规划 Subagent
│   │   ├── knowledge.py          # 知识库 Subagent
│   │   └── code_gen.py           # 代码生成 Subagent
│   ├── tools/
│   │   └── pack_wrapper.py       # @cratefit/pack 的 Python 封装
│   ├── templates/                # 机器人代码模板
│   │   ├── abb/
│   │   ├── kuka/
│   │   └── fanuc/
│   ├── knowledge/                # RAG 知识库数据
│   │   └── box_specs.json
│   ├── main.py                   # FastAPI 入口
│   └── requirements.txt
│
├── docker-compose.yml
└── README.md
七、参考资源汇总

核心框架与库

名称	用途	链接
AgentScope 2.0	Agent 框架	https://github.com/agentscope-ai/agentscope[reference:60]
@cratefit/pack	码垛算法	https://www.npmjs.com/package/@cratefit/pack[reference:61]
@cratefit/viz	3D 可视化	https://www.npmjs.com/package/@cratefit/viz[reference:62]
Three.js	3D 引擎	https://threejs.org/
可借鉴的开源项目

项目	链接	借鉴内容
abb-offline-coder	https://github.com/Hollis36/abb-offline-coder	代码模板、RAG 设计
Palletizer OS	https://github.com/iceccarelli/palletizer[reference:65]	模块化架构-28
RoboDK-API	https://github.com/RoboDK/RoboDK-API[reference:67]	多品牌机器人适配
Smart Stowage	https://gist.github.com/...[reference:68]	React + Three.js 架构-
3D Node Visualization	https://github.com/hemjay07/3d-node-visualization[reference:70]	R3F + GSAP 动效-
官方文档

• AgentScope 文档：https://docs.agentscope.io/
• @cratefit/pack API：https://www.npmjs.com/package/@cratefit/pack[reference:73]
• @cratefit/viz API：https://www.npmjs.com/package/@cratefit/viz[reference:74]
八、开发原则（给 Claude Code 的指令）

1. 每写一行代码前，先问自己：有没有现成的开源库/项目可以复用？
2. 优先使用官方示例代码，在此基础上做适配修改，而非从零实现。
3. @cratefit/pack + @cratefit/viz 是核心，所有码垛计算和 3D 展示都基于这两个库。
4. AgentScope 2.0 负责所有 Agent 逻辑，不要自己写多智能体编排框架。
5. 代码模板借鉴 abb-offline-coder，不要自己发明机器人代码语法。
6. 保持前后端分离，前端 React + 后端 Python，通过 SSE + REST API 通信。
7. 所有配置可参数化，方便教师在教学时调整算法、约束、模型等。
版本：v1.0
最后更新：2026-08-02
下一步：请 Claude Code 基于本文档开始 Phase 1 开发