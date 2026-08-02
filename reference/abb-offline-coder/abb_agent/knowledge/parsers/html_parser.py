"""HTML 文档解析器。

ABB 在线文档站点（new.abb.com）的内容是 HTML。我们用 BeautifulSoup
把正文内容提取出来，按标题层级切分章节。
"""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from loguru import logger

from abb_agent.rag.models import Document, SourceType

# 通常的内容容器选择器
_CONTENT_SELECTORS = (
    "main",
    "article",
    'div[role="main"]',
    "div.content",
    "div.main-content",
)


def parse_html(html: str, *, url: str = "", source_type: SourceType = SourceType.OFFICIAL_MANUAL,
               language: str = "en") -> list[Document]:
    """解析 HTML 字符串，按 h1/h2 切章节。"""
    soup = BeautifulSoup(html, "lxml")
    container = _find_content_container(soup)
    title = _extract_page_title(soup, url)
    sections = _split_by_headings(container)

    docs: list[Document] = []
    for sec_title, sec_body in sections:
        if len(sec_body) < 80:
            continue
        full_title = f"{title}: {sec_title}" if sec_title else title
        docs.append(
            Document(
                source_type=source_type,
                title=full_title,
                content=sec_body,
                url=url,
                language=language,
                extra={"section_title": sec_title},
            )
        )
    return docs


def parse_html_file(file_path: Path, *, url: str = "",
                    source_type: SourceType = SourceType.OFFICIAL_MANUAL) -> list[Document]:
    """解析本地 HTML 文件。"""
    html = file_path.read_text(encoding="utf-8", errors="replace")
    try:
        return parse_html(html, url=url, source_type=source_type)
    except Exception as exc:
        logger.error("解析 HTML {} 失败: {}", file_path, exc)
        return []


def _find_content_container(soup: BeautifulSoup):
    for selector in _CONTENT_SELECTORS:
        node = soup.select_one(selector)
        if node:
            return node
    return soup.body or soup


def _extract_page_title(soup: BeautifulSoup, url: str) -> str:
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    if url:
        path = urlparse(url).path
        return Path(path).name or "Untitled"
    return "Untitled"


def _split_by_headings(container) -> list[tuple[str, str]]:
    """按 h1/h2/h3 切分。每段标题 + 该标题下到下一个标题之间的文本。"""
    sections: list[tuple[str, str]] = []
    current_title = ""
    current_body: list[str] = []

    for el in container.find_all(["h1", "h2", "h3", "p", "li", "pre", "code"]):
        tag = el.name
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        if tag in {"h1", "h2", "h3"}:
            if current_body:
                sections.append(
                    (current_title, _normalize_whitespace("\n".join(current_body)))
                )
                current_body = []
            current_title = text
        else:
            current_body.append(text)

    if current_body:
        sections.append((current_title, _normalize_whitespace("\n".join(current_body))))
    return sections


def _normalize_whitespace(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
