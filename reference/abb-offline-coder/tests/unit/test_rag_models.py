"""验证 RAG 数据模型行为正确。"""
from __future__ import annotations

import pytest

from abb_agent.rag.models import (
    Chunk,
    ChunkKind,
    Document,
    RetrievalResult,
    SourceType,
)


def _make_doc() -> Document:
    return Document(
        source_type=SourceType.OFFICIAL_MANUAL,
        title="MoveL Instruction",
        content="MoveL moves the TCP linearly...",
        url="http://example.com/movel",
        language="en",
    )


def test_document_id_is_stable() -> None:
    doc1 = _make_doc()
    doc2 = _make_doc()
    assert doc1.doc_id == doc2.doc_id


def test_document_is_immutable() -> None:
    doc = _make_doc()
    with pytest.raises((AttributeError, TypeError)):
        doc.title = "Changed"  # type: ignore


def test_chunk_from_text_generates_id() -> None:
    doc = _make_doc()
    chunk = Chunk.from_text(
        doc,
        "MoveL P1, v200, fine, tool0;",
        kind=ChunkKind.CODE_BLOCK,
        keywords=("MoveL", "tool0"),
    )
    assert chunk.chunk_id
    assert chunk.doc_id == doc.doc_id
    assert chunk.kind == ChunkKind.CODE_BLOCK


def test_chunk_to_chroma_metadata_is_flat() -> None:
    doc = _make_doc()
    chunk = Chunk.from_text(
        doc, "text", kind=ChunkKind.DOC_PARAGRAPH, keywords=("a", "b")
    )
    meta = chunk.to_chroma_metadata()
    assert meta["title"] == doc.title
    assert meta["keywords"] == "a,b"
    # 所有值必须是 str/int/float/bool
    for v in meta.values():
        assert isinstance(v, str | int | float | bool)


def test_retrieval_result_carries_score() -> None:
    doc = _make_doc()
    chunk = Chunk.from_text(doc, "text", kind=ChunkKind.DOC_PARAGRAPH)
    r = RetrievalResult(chunk=chunk, score=0.85, rank=0)
    assert r.score == 0.85
    assert r.rank == 0
