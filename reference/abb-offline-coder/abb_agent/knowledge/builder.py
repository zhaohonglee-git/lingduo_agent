"""知识库构建编排器。

把"原始数据 → 文档 → 切片 → 嵌入 → 向量库"整条流水线串起来。
通常由 `scripts/build_knowledge_base.py` 调用。

支持多种输入源：
- 本地 PDF 目录
- 本地 .mod / .sys / .pgf 代码目录
- 本地 HTML 文件目录
- Web 抓取 URL 列表（需有网）
- 用户预先准备的 documents.jsonl
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from loguru import logger

from abb_agent.config import get_config
from abb_agent.knowledge.chunker import chunk_documents
from abb_agent.knowledge.parsers.html_parser import parse_html_file
from abb_agent.knowledge.parsers.mod_parser import parse_mod_directory
from abb_agent.knowledge.parsers.pdf_parser import parse_pdf_directory
from abb_agent.knowledge.scrapers.web_scraper import (
    ScrapeJob,
    WebScraper,
    load_documents,
    save_documents,
)
from abb_agent.rag.models import Document, SourceType
from abb_agent.rag.vector_store import VectorStore


@dataclass
class BuildSummary:
    documents_total: int = 0
    chunks_total: int = 0
    chunks_written: int = 0
    failures: tuple[str, ...] = field(default_factory=tuple)

    def format(self) -> str:
        return (
            f"知识库构建完成: documents={self.documents_total}, "
            f"chunks={self.chunks_total} (已写入 {self.chunks_written}), "
            f"failures={len(self.failures)}"
        )


class KnowledgeBuilder:
    """编排各类文档源 → 写入向量库。"""

    def __init__(self, vector_store: VectorStore | None = None) -> None:
        self._vs = vector_store or VectorStore()
        self._paths = get_config().paths

    def build_from_pdf(self, directory: Path | None = None) -> int:
        """解析本地 PDF 目录，写入向量库。"""
        target = directory or (self._paths.raw_dir / "pdf")
        if not target.exists():
            logger.info("PDF 目录 {} 不存在，跳过", target)
            return 0
        docs = parse_pdf_directory(target, source_type=SourceType.OFFICIAL_MANUAL)
        return self._ingest_docs(docs)

    def build_from_mod(self, directory: Path | None = None) -> int:
        """解析本地 .mod / .sys / .pgf 代码目录，写入向量库。"""
        target = directory or (self._paths.raw_dir / "code")
        if not target.exists():
            logger.info("代码目录 {} 不存在，跳过", target)
            return 0
        docs = parse_mod_directory(target, source_type=SourceType.CODE_EXAMPLE)
        return self._ingest_docs(docs)

    def build_from_html_files(self, directory: Path | None = None) -> int:
        """解析本地 HTML 文件目录。"""
        target = directory or (self._paths.raw_dir / "html")
        if not target.exists():
            logger.info("HTML 目录 {} 不存在，跳过", target)
            return 0
        docs: list[Document] = []
        for html_file in sorted(target.glob("**/*.html")):
            docs.extend(parse_html_file(html_file, source_type=SourceType.OFFICIAL_MANUAL))
        return self._ingest_docs(docs)

    def build_from_jsonl(self, file_path: Path | None = None) -> int:
        """从用户预备好的 documents.jsonl 导入。"""
        target = file_path or (self._paths.parsed_dir / "documents.jsonl")
        if not target.exists():
            logger.info("JSONL 文件 {} 不存在，跳过", target)
            return 0
        docs = load_documents(target)
        return self._ingest_docs(docs)

    def build_from_web(self, jobs: list[ScrapeJob], *, save_jsonl: bool = True) -> int:
        """有网环境下从 URL 列表抓取。"""
        scraper = WebScraper()
        docs, report = scraper.scrape(jobs)
        if save_jsonl:
            save_documents(docs)
        logger.info("抓取报告: {}", report)
        return self._ingest_docs(docs)

    def build_all_local_sources(self) -> BuildSummary:
        """一次性扫描所有本地输入源（PDF/MOD/HTML/JSONL）。"""
        summary = BuildSummary()
        summary.chunks_written += self.build_from_pdf()
        summary.chunks_written += self.build_from_mod()
        summary.chunks_written += self.build_from_html_files()
        summary.chunks_written += self.build_from_jsonl()
        return summary

    def reset(self) -> None:
        """清空向量库。"""
        logger.warning("正在清空向量库...")
        self._vs.clear()

    def status(self) -> dict[str, int]:
        return {"chunk_count": self._vs.count()}

    def _ingest_docs(self, docs: list[Document]) -> int:
        if not docs:
            return 0
        logger.info("正在切分 {} 份文档...", len(docs))
        chunks = chunk_documents(docs)
        logger.info("生成 {} 个切片，写入向量库...", len(chunks))
        return self._vs.add_chunks(chunks)
