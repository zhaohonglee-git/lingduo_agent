# 架构设计

## 设计原则

1. **离线优先**：所有运行时依赖必须能在断网环境工作
2. **资源敏感**：工业 PC 通常无 GPU、内存 8-16GB，模型选型保守
3. **可演进**：知识库可持续扩充，模型可在硬件升级时替换
4. **小文件 > 大文件**：每个模块 200-400 行，单一职责
5. **不可变数据**：核心数据模型 frozen，避免共享状态污染
6. **可测试**：纯函数为主，副作用集中在 Ollama/ChromaDB 边界

## 分层架构

```
┌────────────────────────────────────────────────┐
│  CLI 层 (abb_agent.cli)                         │
│  Typer 入口 + 子命令分发                        │
└──────────────────┬─────────────────────────────┘
                   │
┌──────────────────┴─────────────────────────────┐
│  Orchestrator (abb_agent.agent)                │
│  生成流水线 / 多轮对话                          │
└─────┬────────────────┬───────────┬─────────────┘
      │                │           │
      ▼                ▼           ▼
┌──────────┐  ┌───────────┐  ┌──────────────┐
│ rag/     │  │ llm/      │  │ rapid/       │
│ 检索流水线│  │ Ollama    │  │ 后处理       │
└─────┬────┘  │ 客户端 +  │  │ - validator  │
      │       │ Prompt    │  │ - templates  │
      ▼       └───────────┘  │ - helpers    │
┌──────────────┐             │ - formatter  │
│ knowledge/   │             └──────────────┘
│ 构建知识库   │
│ - parsers    │
│ - chunker    │
│ - scrapers   │
│ - builder    │
└──────────────┘
```

## 数据流

### 单次生成 (Single-shot Generate)

```
user_query : str
    │
    ▼  rewrite()
RewrittenQuery {original, rewritten, category, keywords}
    │
    ▼  retriever.retrieve(rewritten.for_retrieval())
list[RetrievalResult]
    │
    ▼  context_builder.build(results)
BuiltContext {text, sources_used, chars_used}
    │
    ▼  build_full_prompt(rewritten, context)
(system_prompt, user_prompt) : tuple[str, str]
    │
    ▼  ollama.generate(prompt, system)
GenerationResult {text, tokens, duration}
    │
    ▼  _extract_code_block()
(code, explanation)
    │
    ▼  _postprocess() → wrap_in_module() → format_code() → validate()
(final_code, ValidationReport)
    │
    ▼
GenerateResult (落地到 output/*.mod)
```

### 知识库构建 (Build KB)

```
data/raw/{pdf,code,html,jsonl}/
    │
    ▼  parsers.parse_pdf / parse_mod / parse_html / load_documents
list[Document]
    │
    ▼  chunker.chunk_documents()
list[Chunk] (含 keywords, kind, source_type)
    │
    ▼  embedder.encode()
list[list[float]]  (向量)
    │
    ▼  vector_store.add_chunks()
ChromaDB (persistent at data/chroma_db/)
```

## 关键模块职责

| 模块 | 输入 | 输出 | 副作用 |
|------|------|------|--------|
| `config` | 环境变量 | AppConfig 单例 | 创建目录 |
| `knowledge.parsers` | 原始文件 | Document 列表 | 读文件 |
| `knowledge.chunker` | Document | Chunk 列表 | 无 |
| `rag.embedder` | 文本列表 | 向量列表 | 加载模型 |
| `rag.vector_store` | Chunk 列表 | RetrievalResult 列表 | 读写 ChromaDB |
| `rag.retriever` | 查询字符串 | RetrievalResult 列表 | 调用 vector_store + BM25 |
| `rag.query_rewriter` | 用户中文 | RewrittenQuery | 无 |
| `rag.context_builder` | RetrievalResult 列表 | BuiltContext | 无 |
| `llm.ollama_client` | prompt | GenerationResult | HTTP 调用 |
| `rapid.validator` | RAPID 源码 | ValidationReport | 无 |
| `rapid.module_template` | 部分代码 | 完整 .mod 字符串 | 无 |
| `rapid.formatter` | 源码字符串 | 格式化字符串 | 无 |
| `agent.Agent` | user_query | GenerateResult | 串联以上所有 |

## 不可变性约定

以下数据类全部 `@dataclass(frozen=True)`：

- `Document`, `Chunk`, `RetrievalResult`
- `RewrittenQuery`, `BuiltContext`
- `GenerateResult`, `ValidationReport`, `ValidationIssue`
- `ChatMessage`, `GenerationResult`
- `Pose`, `BrushParams`, `ModuleSkeleton`

可变的只有 `ChatSession`（多轮对话状态机），它通过显式 `add()` / `reset()` 接口暴露变更。

## 错误处理边界

| 边界 | 错误类型 | 处理策略 |
|------|---------|---------|
| Ollama 调用 | `OllamaConnectionError` | 重试 2 次（指数退避），失败抛出 |
| 模型缺失 | `OllamaModelMissingError` | 自动降级到 fallback 模型 |
| PDF 解析 | `Exception` | log + 跳过，不阻塞批量构建 |
| 网络抓取 | `httpx.HTTPError` | 重试 3 次，最终失败列入 `ScrapeReport.failures` |
| RAPID 校验 | 校验项 | 返回 `ValidationReport`，由调用方决定 |

## 性能考虑

工业 PC 典型：i5 4 核 + 16GB RAM + 无 GPU。

- **嵌入模型**：bge-small-zh (~100MB, CPU 推理 < 50ms/句)
- **LLM**：Qwen2.5-Coder-7B Q4 (~4.5GB, CPU 推理 ~25 tok/s)
- **ChromaDB**：内嵌持久化，10K chunks 内存 < 200MB

冷启动时间：
- Ollama 加载 LLM 到显存/内存：5-10 秒
- ChromaDB + bge 首次加载：3-5 秒
- 后续生成：纯推理时间，约 15-30 秒

## 扩展点

- 替换 LLM：改 `config.LLMConfig.model_name`，无须改其他代码
- 替换嵌入模型：改 `config.EmbedConfig.model_name`
- 替换向量库：实现新的 `VectorStore` 接口（add_chunks/query/count）
- 添加新任务类别：在 `query_rewriter` 增加 pattern；在 `painting_helpers` 增加 helper 函数；在 `painting_few_shot.md` 加示例
- 替换 LLM 客户端：实现新的 `OllamaClient` 接口（generate/chat），如改用 llama.cpp
