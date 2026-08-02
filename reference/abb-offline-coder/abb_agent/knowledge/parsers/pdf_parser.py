"""ABB 官方 PDF 手册解析器（PyMuPDF / fitz）。

ABB RAPID Reference Manual - Instructions/Functions 是关键资料，但 PDF
有大量页眉/页脚/索引/目录页。本解析器：
- 跳过封面 / 目录 / 索引
- 按"H1/H2 标题"切分逻辑章节
- 识别指令定义页（如 "MoveL - Move along a line"）
- 提取代码示例（PDF 中通常是等宽字体或独立段落）
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

from abb_agent.rag.models import Document, SourceType

# 跳过的常见非内容关键词
_SKIP_PAGE_PATTERNS = (
    re.compile(r"^Index$", re.IGNORECASE),
    re.compile(r"^Table of contents$", re.IGNORECASE),
    re.compile(r"^Copyright", re.IGNORECASE),
)


@dataclass(frozen=True)
class PdfSection:
    """PDF 中的一个逻辑章节。"""

    title: str
    body: str
    page_start: int
    page_end: int


def parse_pdf(file_path: Path, *, source_type: SourceType = SourceType.OFFICIAL_MANUAL,
              language: str = "en") -> list[Document]:
    """解析单个 PDF，返回多个 Document（每个章节一个）。

    依赖 pymupdf：`import fitz`
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError(
            "需要安装 pymupdf 才能解析 PDF: pip install pymupdf"
        ) from exc

    logger.info("解析 PDF: {}", file_path)
    doc = fitz.open(str(file_path))
    sections = _split_into_sections(doc)
    doc.close()

    docs: list[Document] = []
    for sec in sections:
        if _should_skip(sec.title):
            continue
        if len(sec.body) < 100:
            continue
        docs.append(
            Document(
                source_type=source_type,
                title=sec.title,
                content=sec.body,
                file_path=str(file_path),
                language=language,
                extra={
                    "page_start": sec.page_start,
                    "page_end": sec.page_end,
                    "source_file": file_path.name,
                },
            )
        )

    logger.info("PDF {} 解析出 {} 个章节", file_path.name, len(docs))
    return docs


def _should_skip(title: str) -> bool:
    return any(p.match(title.strip()) for p in _SKIP_PAGE_PATTERNS)


def _split_into_sections(doc: "fitz.Document") -> list[PdfSection]:
    """按字体大小启发式切分章节。

    PyMuPDF 的 page.get_text('dict') 给出每个 span 的字体大小。
    我们认为字号 >= 14 的为章节标题。
    """
    sections: list[PdfSection] = []
    current_title = "Untitled"
    current_body: list[str] = []
    current_start_page = 0

    for page_idx, page in enumerate(doc):
        blocks = page.get_text("dict").get("blocks", [])
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = (span.get("text") or "").strip()
                    if not text:
                        continue
                    size = float(span.get("size", 0))
                    if size >= 14 and len(text) < 100 and not text.endswith("."):
                        if current_body:
                            sections.append(
                                PdfSection(
                                    title=current_title,
                                    body="\n".join(current_body).strip(),
                                    page_start=current_start_page,
                                    page_end=page_idx,
                                )
                            )
                            current_body = []
                        current_title = text
                        current_start_page = page_idx
                    else:
                        current_body.append(text)

    if current_body:
        sections.append(
            PdfSection(
                title=current_title,
                body="\n".join(current_body).strip(),
                page_start=current_start_page,
                page_end=len(doc),
            )
        )

    return sections


def parse_pdf_directory(directory: Path, **kwargs) -> list[Document]:
    """批量解析目录下所有 PDF。"""
    docs: list[Document] = []
    for pdf in sorted(directory.glob("*.pdf")):
        try:
            docs.extend(parse_pdf(pdf, **kwargs))
        except Exception as exc:
            logger.error("解析 PDF {} 失败: {}", pdf, exc)
    return docs
