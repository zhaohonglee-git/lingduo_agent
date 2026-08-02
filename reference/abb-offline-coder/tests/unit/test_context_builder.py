"""验证 ContextBuilder 装配上下文。"""
from __future__ import annotations

from abb_agent.config import get_config
from abb_agent.rag.context_builder import ContextBuilder
from abb_agent.rag.models import (
    Chunk,
    ChunkKind,
    Document,
    RetrievalResult,
    SourceType,
)


def _make_chunk(text: str, kind: ChunkKind = ChunkKind.DOC_PARAGRAPH,
                source: SourceType = SourceType.OFFICIAL_MANUAL) -> Chunk:
    doc = Document(source_type=source, title="t", content=text)
    return Chunk.from_text(doc, text, kind=kind)


def test_empty_results_returns_empty_text() -> None:
    builder = ContextBuilder()
    result = builder.build([])
    assert result.text == ""
    assert result.chars_used == 0


def test_single_chunk_formatted_with_label() -> None:
    chunk = _make_chunk("MoveL moves the TCP linearly.")
    results = [RetrievalResult(chunk=chunk, score=0.9, rank=0)]
    out = ContextBuilder().build(results)
    assert "ABB 官方手册" in out.text
    assert "MoveL" in out.text


def test_code_chunks_wrapped_in_rapid_block() -> None:
    chunk = _make_chunk(
        "MoveL P1, v100, fine, tool0;",
        kind=ChunkKind.CODE_BLOCK,
        source=SourceType.CODE_EXAMPLE,
    )
    out = ContextBuilder().build([RetrievalResult(chunk=chunk, score=0.9, rank=0)])
    assert "```rapid" in out.text


def test_budget_truncation() -> None:
    cfg = get_config().rag
    cfg.max_context_tokens = 200  # 设小预算
    big_text = "段落 " * 1000
    chunks = [
        RetrievalResult(chunk=_make_chunk(big_text), score=0.9 - i * 0.1, rank=i)
        for i in range(5)
    ]
    out = ContextBuilder(config=cfg).build(chunks)
    # 不应包含全部 5 块（被预算限制）
    assert out.text.count("---") < 4


def test_sources_used_tracked() -> None:
    chunks = [
        RetrievalResult(chunk=_make_chunk("a", source=SourceType.OFFICIAL_MANUAL), score=0.9, rank=0),
        RetrievalResult(chunk=_make_chunk("b", source=SourceType.CODE_EXAMPLE), score=0.8, rank=1),
    ]
    out = ContextBuilder().build(chunks)
    assert "official_manual" in out.sources_used
    assert "code_example" in out.sources_used
