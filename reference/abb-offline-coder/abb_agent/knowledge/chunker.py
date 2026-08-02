"""智能文档切片器。

策略：
- 对 .mod 代码：按 PROC/FUNC 边界切，已经在 mod_parser 完成，本模块只做长度兜底
- 对 PDF/HTML 段落：先识别"指令定义页"（标题含 MoveL/TriggIO 等关键词），整体作为一片
- 否则按段落滑窗切分（chunk_size 字符，overlap chunk_overlap）
- 自动抽取关键词（指令名、数据类型名）写入 chunk.keywords

关键词抽取很重要 —— 让混合检索的 BM25 部分能精确命中"MoveL"、"BrushData" 等专业词汇。
"""
from __future__ import annotations

import re

from abb_agent.config import get_config
from abb_agent.rag.models import Chunk, ChunkKind, Document, SourceType

# ABB RAPID 关键指令 / 数据类型 - 用于关键词识别
_RAPID_INSTRUCTIONS = frozenset(
    [
        "MoveJ", "MoveL", "MoveC", "MoveAbsJ", "MoveLDO", "MoveJDO",
        "MoveLSync", "MoveJSync", "MoveCSync",
        "TriggL", "TriggC", "TriggJ", "TriggIO", "TriggData", "TriggEquip",
        "SetDO", "Reset", "SetAO", "PulseDO", "WaitDI", "WaitDO",
        "WaitTime", "Stop", "ConfL", "ConfJ", "SingArea",
    ]
)
_RAPID_DATATYPES = frozenset(
    [
        "robtarget", "jointtarget", "speeddata", "zonedata", "tooldata",
        "wobjdata", "loaddata", "brushdata", "triggdata", "signaldo", "signaldi",
        "signalai", "signalao", "num", "bool", "string", "pos", "orient",
        "confdata", "extjoint",
    ]
)
_PAINTING_TERMS = frozenset(
    [
        "spray", "paint", "brush", "flow", "fan", "atom", "atomization",
        "trigger", "TCP", "calibration", "zigzag", "scan", "trajectory",
        "喷涂", "喷枪", "笔刷", "流量", "扇幅", "雾化", "扫描", "校准", "工艺",
    ]
)


def _extract_keywords(text: str) -> tuple[str, ...]:
    """识别文本中出现的 RAPID 指令/数据类型/喷涂术语。"""
    found: set[str] = set()
    for inst in _RAPID_INSTRUCTIONS:
        if re.search(rf"\b{re.escape(inst)}\b", text):
            found.add(inst)
    for dtype in _RAPID_DATATYPES:
        if re.search(rf"\b{re.escape(dtype)}\b", text, re.IGNORECASE):
            found.add(dtype.lower())
    for term in _PAINTING_TERMS:
        if term in text:
            found.add(term)
    return tuple(sorted(found))


def _is_instruction_page(doc: Document) -> bool:
    """判断是否为单条指令的定义页（如 MoveL 章节）。"""
    title = doc.title.strip()
    # 标题以指令名开头通常是定义页
    for inst in _RAPID_INSTRUCTIONS:
        if title.startswith(inst):
            return True
    return False


def _is_code_example(doc: Document) -> bool:
    return doc.source_type in {SourceType.CODE_EXAMPLE, SourceType.PAINTING_RECIPE}


def _split_by_sliding_window(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[str]:
    """按段落优先 + 字符滑窗切分。

    Args:
        text: 原文
        chunk_size: 单 chunk 目标字符数
        chunk_overlap: 相邻 chunk 重叠字符数
    """
    if len(text) <= chunk_size:
        return [text]

    # 先按段落分
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[str] = []
    buffer = ""
    for para in paragraphs:
        if len(buffer) + len(para) + 2 <= chunk_size:
            buffer = buffer + "\n\n" + para if buffer else para
        else:
            if buffer:
                chunks.append(buffer)
            # 段落本身就超长，硬切
            if len(para) > chunk_size:
                for i in range(0, len(para), chunk_size - chunk_overlap):
                    chunks.append(para[i : i + chunk_size])
                buffer = ""
            else:
                buffer = para
    if buffer:
        chunks.append(buffer)
    return chunks


def chunk_document(doc: Document, *, chunk_size: int | None = None,
                   chunk_overlap: int | None = None) -> list[Chunk]:
    """把一个 Document 切成一组 Chunk。"""
    cfg = get_config().rag
    size = chunk_size or cfg.chunk_size
    overlap = chunk_overlap or cfg.chunk_overlap

    # 代码示例：原样作为一个 chunk
    if _is_code_example(doc):
        return [
            Chunk.from_text(
                doc,
                doc.content,
                kind=ChunkKind.EXAMPLE_PROGRAM,
                keywords=_extract_keywords(doc.content),
                extra_metadata=doc.extra,
            )
        ]

    # 指令定义页：单 chunk
    if _is_instruction_page(doc):
        return [
            Chunk.from_text(
                doc,
                doc.content[: size * 4],  # 限制最长 4 倍 size
                kind=ChunkKind.INSTRUCTION_DEF,
                keywords=_extract_keywords(doc.title + " " + doc.content),
                extra_metadata=doc.extra,
            )
        ]

    # 普通文档：滑窗切
    parts = _split_by_sliding_window(doc.content, size, overlap)
    return [
        Chunk.from_text(
            doc,
            part,
            kind=ChunkKind.DOC_PARAGRAPH,
            keywords=_extract_keywords(part),
            extra_metadata={**doc.extra, "chunk_index": idx, "chunk_total": len(parts)},
        )
        for idx, part in enumerate(parts)
    ]


def chunk_documents(docs: list[Document], **kwargs) -> list[Chunk]:
    """批量切分。"""
    out: list[Chunk] = []
    for d in docs:
        out.extend(chunk_document(d, **kwargs))
    return out
