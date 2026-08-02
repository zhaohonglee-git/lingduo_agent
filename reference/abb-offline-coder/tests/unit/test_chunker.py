"""验证 chunker 切片策略。"""
from __future__ import annotations

from abb_agent.knowledge.chunker import chunk_document
from abb_agent.rag.models import ChunkKind, Document, SourceType


def test_code_example_is_single_chunk() -> None:
    doc = Document(
        source_type=SourceType.CODE_EXAMPLE,
        title="paint_program.mod",
        content="MODULE M\nPROC main()\nMoveL p, v1, z1, t;\nENDPROC\nENDMODULE",
    )
    chunks = chunk_document(doc)
    assert len(chunks) == 1
    assert chunks[0].kind == ChunkKind.EXAMPLE_PROGRAM


def test_instruction_page_kept_intact() -> None:
    doc = Document(
        source_type=SourceType.OFFICIAL_MANUAL,
        title="MoveL Description",
        content="MoveL is used for linear motion. " * 50,
    )
    chunks = chunk_document(doc)
    assert chunks[0].kind == ChunkKind.INSTRUCTION_DEF


def test_doc_paragraph_split_when_long() -> None:
    content = "This is a paragraph. " * 200  # 4000 chars
    doc = Document(
        source_type=SourceType.OFFICIAL_MANUAL,
        title="Some long doc",
        content=content,
    )
    chunks = chunk_document(doc, chunk_size=500, chunk_overlap=50)
    assert len(chunks) >= 2
    for c in chunks:
        assert c.kind == ChunkKind.DOC_PARAGRAPH


def test_keywords_extracted_from_text() -> None:
    doc = Document(
        source_type=SourceType.CODE_EXAMPLE,
        title="test",
        content="MoveL P1, v200, fine, tSprayGun;\nSetDO doSpray, 1;",
    )
    chunks = chunk_document(doc)
    kws = set(chunks[0].keywords)
    # 应识别 MoveL 和 SetDO
    assert any("MoveL" in k for k in kws)
    assert any("SetDO" in k for k in kws)


def test_chinese_keywords_extracted() -> None:
    doc = Document(
        source_type=SourceType.PAINTING_RECIPE,
        title="喷涂工艺",
        content="本工艺用于喷涂车门外板，流量 80%，扇幅 300mm。",
    )
    chunks = chunk_document(doc)
    kws = set(chunks[0].keywords)
    assert "喷涂" in kws
    assert "流量" in kws
