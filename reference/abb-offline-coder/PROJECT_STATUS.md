# 项目状态总览

> 项目：**ABB 喷涂机器人离线 AI 编程助手**
> 路径：`/Users/kingcode/Documents/ABB-编程本地化`
> 状态：✅ **可用** — 端到端跑通，已用真实 ABB 官方手册建库并验证

---

## 1. 目录结构

```
ABB-编程本地化/
├── abb_agent/                          # 主代码包 (3664 行, 37 文件)
│   ├── __init__.py
│   ├── config.py                       # 全局配置 (100% 覆盖)
│   ├── agent.py                        # Agent 编排器
│   ├── cli/                            # Typer CLI
│   │   ├── main.py                     # 入口
│   │   └── commands/
│   │       ├── gen.py                  # 单次生成
│   │       ├── chat.py                 # 多轮对话
│   │       ├── kb.py                   # 知识库管理
│   │       ├── init.py                 # 首次引导
│   │       └── doctor.py               # 健康检查
│   ├── knowledge/                      # 知识库构建
│   │   ├── builder.py                  # 编排
│   │   ├── chunker.py                  # 切片
│   │   ├── parsers/
│   │   │   ├── pdf_parser.py
│   │   │   ├── mod_parser.py
│   │   │   └── html_parser.py
│   │   └── scrapers/
│   │       ├── web_scraper.py
│   │       └── seed_urls.py
│   ├── rag/                            # 检索流水线
│   │   ├── models.py                   # Document/Chunk/Result
│   │   ├── embedder.py                 # bge-small-zh
│   │   ├── vector_store.py             # ChromaDB
│   │   ├── retriever.py                # 混合 BM25+向量
│   │   ├── query_rewriter.py           # 中文→检索查询
│   │   └── context_builder.py          # Prompt 装配
│   ├── llm/                            # 本地 LLM
│   │   ├── ollama_client.py            # HTTP 客户端
│   │   └── prompts/
│   │       ├── system.md               # 系统提示词
│   │       ├── painting_few_shot.md    # 5 个喷涂示例
│   │       └── templates.py
│   └── rapid/                          # RAPID 后处理
│       ├── validator.py                # 8 类语法校验
│       ├── module_template.py          # 模块包装
│       ├── painting_helpers.py         # 喷涂代码生成
│       └── formatter.py                # 格式化
├── tests/
│   ├── conftest.py                     # 隔离 fixture
│   └── unit/                           # 67 个单元测试，全部通过
├── scripts/
│   ├── install.sh                      # Mac/Linux 安装
│   ├── install.bat                     # Windows 安装
│   ├── build_knowledge_base.py         # 构建知识库
│   ├── download_models.py              # 拉取本地模型
│   └── package_offline.sh              # 打包离线版
├── data/
│   ├── raw/pdf/                        # 5 本真实 ABB 手册 (48 MB)
│   ├── parsed/                         # 解析后的 JSONL
│   └── chroma_db/                      # 向量库 (52 MB)
├── models/embeddings/                  # bge-small-zh 模型 (92 MB)
├── output/                             # 3 个生成的 .mod 文件
├── docs/ARCHITECTURE.md                # 架构文档
├── README.md                           # 使用说明
├── PROJECT_STATUS.md                   # 本文件
├── pyproject.toml                      # 包配置
├── requirements.txt                    # 运行时依赖
├── requirements-dev.txt                # 开发依赖
└── .gitignore
```

---

## 2. 已实现功能

| 层 | 模块 | 状态 | 测试覆盖 |
|----|------|------|---------|
| **CLI** | gen / chat / kb / init / doctor | ✅ 可用 | 端到端验证 |
| **Agent 编排** | 单次生成 + 多轮对话 + 后处理 | ✅ 跑通 | 4 个单元测试 |
| **RAG 检索** | 向量+BM25 混合检索 + 中文改写 | ✅ 跑通 | 16 个测试 |
| **本地 LLM** | Ollama 客户端 + Prompt 模板 + Few-shot | ✅ 跑通 | 接口稳定 |
| **知识库构建** | PDF/MOD/HTML 解析 + 切片 + 嵌入 | ✅ 跑通 | 10 个测试 |
| **RAPID 后处理** | 校验 + 模板 + 喷涂助手 + 格式化 | ✅ 跑通 | 32 个测试 |

---

## 3. 已下载的真实 ABB 官方手册

| 文件 | 大小 | 文档号 | 用途 |
|------|------|--------|------|
| RAPID_Instructions_Functions_Datatypes.pdf | 7.9 MB | 3HAC16581 | RAPID 完整参考手册（MoveL/TriggIO/SetDO 等） |
| Painting_PowerPac_Operating_Manual.pdf | 3.3 MB | 3HNA019758 | RobotStudio 喷涂 PowerPac 操作 |
| Paint_Application_Equipment.pdf | 1.8 MB | - | ABB 喷涂设备技术规格 |
| IRB52_Compact_Painting_Specialist.pdf | 747 KB | 9AKK104295D8227 | IRB 52 喷涂机型 |
| IRB5710_Product_Manual.pdf | 34 MB | 3HAC075184 | IRB 5710 完整产品手册 |
| **合计** | **48 MB** | | 5 本核心手册 |

---

## 4. 知识库与模型

| 项 | 值 |
|----|----|
| ChromaDB 切片总数 | **6475** |
| 向量库磁盘占用 | 52 MB |
| 嵌入模型 | BAAI/bge-small-zh-v1.5 (92 MB) |
| 嵌入维度 | 512 |
| 已通过 LLM | gemma4:e4b (9.6 GB) — 本机已有 |
| 计划主 LLM | qwen2.5-coder:7b-instruct-q4_K_M (4.5 GB) |

---

## 5. 端到端验证记录

### 测试 1：直线扫描喷涂
- **输入**：`"用 RAPID 写一个简单的直线移动程序：从 p1 高速到 p2 低速喷涂，结束关喷"`
- **输出**：`output/PaintProgram_20260516_101110.mod` (1.4 KB)
- **结果**：✅ 校验通过，含完整 MODULE / tooldata / wobjdata / speeddata / robtarget / PROC main()
- **耗时**：78 秒

### 测试 2：TCP 4 点校准
- **输入**：`"写一段喷枪 TCP 4 点法校准程序，用中文注释清楚每步操作"`
- **输出**：`output/PaintProgram_20260516_101301.mod` (1.9 KB)
- **结果**：✅ 校验通过，含 TPWrite 操作引导
- **耗时**：102 秒

### 测试 3：TriggIO 精确同步
- **输入**：`"用 TriggIO 实现精确同步：从 p1 到 p2 直线运动中，距 p1 80mm 时打开喷枪，距 p1 500mm 时关闭喷枪"`
- **输出**：`output/PaintProgram_20260516_105217.mod` (2.1 KB)
- **结果**：✅ 校验通过（仅 2 警告：triggdata 大小写）
- **使用的官方资料**：从 6475 个切片中检索到 `TriggIO gunon, 0.2\Time\DOp:=gun,...` 等真实示例
- **耗时**：194 秒

---

## 6. 单元测试

```
67 passed in 0.51s
```

按模块分布：

| 测试文件 | 测试数 |
|---------|--------|
| test_agent_postprocess.py | 4 |
| test_chunker.py | 5 |
| test_context_builder.py | 5 |
| test_mod_parser.py | 5 |
| test_query_rewriter.py | 11 |
| test_rag_models.py | 5 |
| test_rapid_formatter.py | 5 |
| test_rapid_module_template.py | 6 |
| test_rapid_painting_helpers.py | 11 |
| test_rapid_validator.py | 10 |
| **合计** | **67** |

核心模块覆盖率（pure logic）：
- `config.py` 100%
- `rag/query_rewriter.py` 100%
- `rag/context_builder.py` 100%
- `rapid/painting_helpers.py` 100%
- `rapid/formatter.py` 99%
- `rag/models.py` 97%
- `knowledge/parsers/mod_parser.py` 93%
- `rapid/module_template.py` 92%
- `rapid/validator.py` 90%
- `knowledge/chunker.py` 84%

---

## 7. CLI 速查

```bash
abb-agent version                       # 显示版本
abb-agent doctor                        # 健康检查
abb-agent init                          # 首次引导

# 知识库
abb-agent kb build                      # 从 data/raw/ 构建向量库
abb-agent kb status                     # 看切片数
abb-agent kb inspect "查询" --top-k 5   # 测试检索
abb-agent kb clear                      # 清空

# 生成代码
abb-agent gen "中文需求描述"             # 单次生成
abb-agent chat                          # 多轮对话
```

环境变量覆盖：
```bash
ABB_AGENT_LLM_MODEL_NAME="gemma4:e4b"          # 改用其他模型
ABB_AGENT_LLM_TEMPERATURE=0.4                  # 调整温度
ABB_AGENT_EMBED_DEVICE="cuda"                  # 用 GPU 嵌入
```

---

## 8. 关键修复记录

| 时间 | 问题 | 修复 |
|------|------|------|
| 2026-05-15 | Query Rewriter 不识别"Z 字"(带空格) | 归一化时移除空格 |
| 2026-05-15 | Chunker text[:200] 撞 ID | 改全文哈希 + metadata 签名 |
| 2026-05-16 | ChromaDB 单批 5461 上限超限 | 4000 批分批写入 |

---

## 9. 下一步建议

### 短期（可立刻执行）
1. **拉取 Qwen2.5-Coder 主模型**（当前用 gemma4:e4b 替代）：
   ```bash
   ollama pull qwen2.5-coder:7b-instruct-q4_K_M
   ```
   预计速度提升 3-5 倍

2. **追加内部 RAPID 示例**到 `data/raw/code/`，重新跑 `kb build`

3. **批量验证**：用 5 个典型喷涂需求跑一遍，检查生成质量

### 中期
- 收集更多 ABB 喷涂机型手册（IRB 5400、5500-25、5510）
- 录制 5-10 段真实喷涂场景到 painting_few_shot.md
- 离线打包到工业 PC 实测

### 长期（路线图）
- v0.2：扩充更多喷涂机型 few-shot
- v0.3：可选 Web UI
- v0.4：完整 RAPID parser 提升校验
- v0.5：RobotStudio Add-In

---

## 10. 文件清单（关键文件）

| 文件 | 用途 |
|------|------|
| [README.md](README.md) | 使用说明 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构设计 |
| [pyproject.toml](pyproject.toml) | 包配置 |
| [abb_agent/agent.py](abb_agent/agent.py) | 主编排器 |
| [abb_agent/config.py](abb_agent/config.py) | 全局配置 |
| [abb_agent/llm/prompts/system.md](abb_agent/llm/prompts/system.md) | 系统提示词 |
| [abb_agent/llm/prompts/painting_few_shot.md](abb_agent/llm/prompts/painting_few_shot.md) | 喷涂示例 |
| [scripts/install.sh](scripts/install.sh) | 安装脚本 |
| [scripts/build_knowledge_base.py](scripts/build_knowledge_base.py) | 知识库构建 |
| [scripts/package_offline.sh](scripts/package_offline.sh) | 离线打包 |

---

**总结**：项目完整、可用、已用真实 ABB 官方手册验证端到端流程。
67 个单元测试通过，3 个真实端到端生成成功，所有核心模块到位。
