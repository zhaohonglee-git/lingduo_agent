# 灵垛 LingDuo — AI + 混合码垛算法开发与仿真平台

🏗️ 面向高校机器人、自动化、AI 专业的 Web 端实训教学平台。

以**码垛**这一典型工业场景为载体，融合 LLM、运筹优化、3D 仿真、机器人离线编程等技术，提供从自然语言需求到完整码垛方案的一站式实验环境。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite |
| 3D 可视化 | @cratefit/viz + Three.js |
| 码垛算法 | @cratefit/pack（浏览器端执行） |
| Agent 框架 | AgentScope 2.0 (Python) |
| LLM | DashScope / Qwen（可切换） |
| 后端 | FastAPI + SSE 流式推送 |

## 项目结构

```
lingduo_agent/
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface/   # 聊天面板
│   │   │   ├── ThreeScene/      # 3D 码垛场景
│   │   │   └── Layout/          # 整体布局
│   │   ├── hooks/               # useSSE, usePalletizing
│   │   ├── services/            # API 调用
│   │   └── types/               # TypeScript 类型
│   └── package.json
├── backend/                 # Python 后端
│   ├── agents/
│   │   └── supervisor.py        # 主控 Agent
│   ├── api/
│   │   └── routes.py            # FastAPI 路由
│   └── main.py                  # 入口
└── docker-compose.yml
```

## 快速开始

### 前置要求

- **Node.js** >= 18
- **Python** >= 3.11
- **DashScope API Key**（[阿里云百炼](https://bailian.console.aliyun.com/)）

### 1. 启动后端

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 配置 API Key
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY

# 启动（默认 :8000）
python main.py
```

验证后端：
```bash
curl http://localhost:8000/api/health
# → {"status": "ok", "service": "lingduo-agent"}
```

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器（默认 :5173）
npm run dev
```

### 3. 使用

1. 打开浏览器访问 `http://localhost:5173`
2. 在左侧聊天框输入码垛需求，例如：

> 用EUR托盘码放400×300×200mm的箱子25个，堆高不超过1800mm

3. 观察 Agent 思考过程实时流式显示
4. 右侧 3D 场景展示码垛结果（拖拽旋转、滚轮缩放）

### Docker 部署

```bash
# 设置 API Key
export DASHSCOPE_API_KEY=your_key_here

# 启动
docker compose up -d
```

## Phase 1 实现范围

- [x] 前端项目骨架（React 19 + TypeScript + Vite）
- [x] 后端 AgentScope 意图解析 Agent
- [x] FastAPI SSE 流式事件推送
- [x] 聊天界面（流式思考过程展示）
- [x] @cratefit/pack 码垛计算（浏览器端）
- [x] @cratefit/viz 3D 场景渲染
- [x] Docker 容器化配置

## 后续阶段

- Phase 2: 多智能体编排（AgentScope Agent Team）
- Phase 3: RAG 知识库 + 多轮对话调整
- Phase 4: Jinja2 机器人代码生成（ABB/KUKA/FANUC）
- Phase 5: UI 打磨（码垛动画、新手引导、算法对比）

## License

待定
