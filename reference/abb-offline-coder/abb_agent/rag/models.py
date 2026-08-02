"""RAG 层的核心数据模型。

设计原则：
- 数据类全部 frozen，强制不可变
- 元数据扁平化（dict[str, str|int|float]），便于 ChromaDB 存储
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SourceType(str, Enum):
    """知识来源类型 - 影响检索权重和后处理。"""

    OFFICIAL_MANUAL = "official_manual"
    INSTRUCTION_DOC = "instruction_doc"
    CODE_EXAMPLE = "code_example"
    PAINTING_RECIPE = "painting_recipe"
    COMMUNITY_POST = "community_post"
    USER_NOTE = "user_note"


class ChunkKind(str, Enum):
    """切片类型 - 区分文档段、代码段、指令说明等。"""

    DOC_PARAGRAPH = "doc_paragraph"
    INSTRUCTION_DEF = "instruction_def"
    CODE_BLOCK = "code_block"
    EXAMPLE_PROGRAM = "example_program"
    PARAMETER_TABLE = "parameter_table"


@dataclass(frozen=True)
class Document:
    """爬取/解析得到的原始文档。"""

    source_type: SourceType
    title: str
    content: str
    url: str = ""
    file_path: str = ""
    language: str = "en"
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def doc_id(self) -> str:
        """基于内容的稳定 ID。"""
        key = f"{self.source_type.value}|{self.title}|{self.url}|{self.file_path}"
        return hashlib.md5(key.encode("utf-8")).hexdigest()[:16]


@dataclass(frozen=True)
class Chunk:
    """切分后的知识块 - RAG 检索的最小单位。"""

    chunk_id: str
    doc_id: str
    text: str
    kind: ChunkKind
    source_type: SourceType
    title: str = ""
    keywords: tuple[str, ...] = field(default_factory=tuple)
    language: str = "en"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_chroma_metadata(self) -> dict[str, str | int | float | bool]:
        """转成 ChromaDB 支持的扁平元数据。"""
        meta: dict[str, str | int | float | bool] = {
            "doc_id": self.doc_id,
            "kind": self.kind.value,
            "source_type": self.source_type.value,
            "title": self.title,
            "language": self.language,
            "keywords": ",".join(self.keywords),
        }
        for k, v in self.metadata.items():
            if isinstance(v, str | int | float | bool):
                meta[k] = v
        return meta

    @classmethod
    def from_text(
        cls,
        doc: Document,
        text: str,
        *,
        kind: ChunkKind,
        keywords: tuple[str, ...] = (),
        extra_metadata: dict[str, Any] | None = None,
    ) -> "Chunk":
        """从原文档生成 Chunk，自动生成 chunk_id。

        chunk_id 用 doc_id + 完整 text + kind + extra_metadata 哈希，
        保证同一文档内即使前缀相似的段落也不会撞 ID。
        """
        meta_signature = ""
        if extra_metadata:
            meta_signature = "|".join(
                f"{k}={v}" for k, v in sorted(extra_metadata.items())
                if isinstance(v, str | int | float | bool)
            )
        chunk_id = hashlib.md5(
            f"{doc.doc_id}|{kind.value}|{meta_signature}|{text}".encode("utf-8")
        ).hexdigest()[:16]
        return cls(
            chunk_id=chunk_id,
            doc_id=doc.doc_id,
            text=text,
            kind=kind,
            source_type=doc.source_type,
            title=doc.title,
            keywords=keywords,
            language=doc.language,
            metadata=extra_metadata or {},
        )


@dataclass(frozen=True)
class RetrievalResult:
    """单次检索返回的一条结果。"""

    chunk: Chunk
    score: float
    rank: int = 0
    matched_keywords: tuple[str, ...] = field(default_factory=tuple)
