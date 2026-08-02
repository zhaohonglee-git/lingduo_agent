"""把检索结果装配成 Prompt 上下文片段。

任务：
- 控制总长度不超过 max_context_tokens（按 ~3.5 char/token 估算）
- 高分片段优先，跨源去重
- 给每段加上来源标记（让 LLM 区分官方手册 vs 用户示例）
- 代码片段单独标注 ```rapid 让 LLM 识别
"""
from __future__ import annotations

from dataclasses import dataclass

from abb_agent.config import RAGConfig, get_config
from abb_agent.rag.models import ChunkKind, RetrievalResult, SourceType

# 不同来源在 prompt 中的显示标签
_SOURCE_LABELS = {
    SourceType.OFFICIAL_MANUAL: "[ABB 官方手册]",
    SourceType.INSTRUCTION_DOC: "[RAPID 指令文档]",
    SourceType.CODE_EXAMPLE: "[示例代码]",
    SourceType.PAINTING_RECIPE: "[喷涂工艺]",
    SourceType.COMMUNITY_POST: "[社区资料]",
    SourceType.USER_NOTE: "[用户备注]",
}


@dataclass(frozen=True)
class BuiltContext:
    """装配完成的上下文 + 来源摘要。"""

    text: str
    sources_used: tuple[str, ...]
    chars_used: int


def _estimate_tokens(text: str) -> int:
    """粗略估算 token 数。汉字 1 字 ≈ 1.5 token，英文按 4 char/token。"""
    cn_chars = sum(1 for ch in text if "一" <= ch <= "鿿")
    other = len(text) - cn_chars
    return int(cn_chars * 1.5 + other / 4)


def _format_chunk(result: RetrievalResult) -> str:
    label = _SOURCE_LABELS.get(result.chunk.source_type, "[资料]")
    title = result.chunk.title or "(无标题)"
    is_code = result.chunk.kind in {
        ChunkKind.CODE_BLOCK,
        ChunkKind.EXAMPLE_PROGRAM,
    }
    body = result.chunk.text.strip()
    if is_code:
        body = f"```rapid\n{body}\n```"
    return f"{label} «{title}» (相关度 {result.score:.2f})\n{body}"


class ContextBuilder:
    """装配 retriever 输出为 prompt 用的字符串。"""

    def __init__(self, config: RAGConfig | None = None) -> None:
        self._config = config or get_config().rag

    def build(self, results: list[RetrievalResult]) -> BuiltContext:
        budget_tokens = self._config.max_context_tokens
        used_tokens = 0
        used_sources: set[str] = set()
        parts: list[str] = []

        for result in results:
            formatted = _format_chunk(result)
            tokens = _estimate_tokens(formatted)
            if used_tokens + tokens > budget_tokens and parts:
                break
            parts.append(formatted)
            used_tokens += tokens
            used_sources.add(result.chunk.source_type.value)

        joined = "\n\n---\n\n".join(parts)
        return BuiltContext(
            text=joined,
            sources_used=tuple(sorted(used_sources)),
            chars_used=len(joined),
        )
