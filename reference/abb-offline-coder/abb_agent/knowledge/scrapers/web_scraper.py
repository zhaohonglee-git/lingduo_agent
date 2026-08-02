"""通用 HTTP 爬虫 - 用于离线知识库的种子文档抓取。

只在"有网准备环境"使用（如工厂办公室电脑），不会在工业 PC 上运行。
设计原则：
- 礼貌：默认 1 秒间隔，遵守 robots.txt（用户自行确认）
- 健壮：超时/重试/UA 标识
- 透明：保存原始 HTML + 解析后的 Document JSON
"""
from __future__ import annotations

import json
import time
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import httpx
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from abb_agent.config import get_config
from abb_agent.knowledge.parsers.html_parser import parse_html
from abb_agent.rag.models import Document, SourceType

DEFAULT_USER_AGENT = (
    "ABB-Agent/0.1 (offline-knowledge-builder; "
    "+contact: local-only, single-machine use)"
)


@dataclass
class ScrapeJob:
    """单条爬取任务。"""

    url: str
    source_type: SourceType = SourceType.OFFICIAL_MANUAL
    language: str = "en"
    tags: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ScrapeReport:
    total: int
    success: int
    failures: tuple[str, ...]


class WebScraper:
    """同步 HTTP 抓取器，输出 Document 列表。"""

    def __init__(
        self,
        *,
        user_agent: str = DEFAULT_USER_AGENT,
        request_interval_sec: float = 1.0,
        timeout_sec: float = 30.0,
        cache_html: bool = True,
    ) -> None:
        self._headers = {"User-Agent": user_agent, "Accept": "text/html,*/*"}
        self._interval = request_interval_sec
        self._timeout = timeout_sec
        self._cache_html = cache_html
        self._cache_dir = get_config().paths.raw_dir / "html_cache"
        if cache_html:
            self._cache_dir.mkdir(parents=True, exist_ok=True)

    def scrape(self, jobs: Iterable[ScrapeJob]) -> tuple[list[Document], ScrapeReport]:
        """批量爬取。返回所有成功解析的 Document 与统计报告。"""
        all_docs: list[Document] = []
        failures: list[str] = []
        with httpx.Client(headers=self._headers, timeout=self._timeout, follow_redirects=True) as client:
            jobs_list = list(jobs)
            for idx, job in enumerate(jobs_list):
                try:
                    docs = self._scrape_one(client, job)
                    all_docs.extend(docs)
                    logger.info(
                        "[{}/{}] {} -> {} docs", idx + 1, len(jobs_list), job.url, len(docs)
                    )
                except Exception as exc:
                    logger.error("抓取 {} 失败: {}", job.url, exc)
                    failures.append(job.url)
                # 礼貌等待
                if idx < len(jobs_list) - 1:
                    time.sleep(self._interval)

        report = ScrapeReport(
            total=len(jobs_list),
            success=len(jobs_list) - len(failures),
            failures=tuple(failures),
        )
        return all_docs, report

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    def _scrape_one(self, client: httpx.Client, job: ScrapeJob) -> list[Document]:
        resp = client.get(job.url)
        resp.raise_for_status()
        html = resp.text

        if self._cache_html:
            self._save_cache(job.url, html)

        docs = parse_html(html, url=job.url, source_type=job.source_type, language=job.language)
        for d in docs:
            if job.tags:
                d.extra.setdefault("tags", list(job.tags))
        return docs

    def _save_cache(self, url: str, html: str) -> None:
        parsed = urlparse(url)
        safe_name = (parsed.netloc + parsed.path).replace("/", "_").replace(":", "_")[:200]
        path = self._cache_dir / (safe_name + ".html")
        path.write_text(html, encoding="utf-8")


def save_documents(docs: list[Document], output_dir: Path | None = None) -> Path:
    """把解析出的 Document 保存为 JSON Lines。"""
    out = output_dir or get_config().paths.parsed_dir
    out.mkdir(parents=True, exist_ok=True)
    file_path = out / "documents.jsonl"
    with file_path.open("a", encoding="utf-8") as f:
        for d in docs:
            record = {
                "source_type": d.source_type.value,
                "title": d.title,
                "content": d.content,
                "url": d.url,
                "file_path": d.file_path,
                "language": d.language,
                "extra": d.extra,
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    logger.info("已写入 {} 条 Document 到 {}", len(docs), file_path)
    return file_path


def load_documents(file_path: Path) -> list[Document]:
    """从 JSON Lines 恢复 Document。"""
    docs: list[Document] = []
    with file_path.open("r", encoding="utf-8") as f:
        for line in f:
            data = json.loads(line)
            docs.append(
                Document(
                    source_type=SourceType(data["source_type"]),
                    title=data["title"],
                    content=data["content"],
                    url=data.get("url", ""),
                    file_path=data.get("file_path", ""),
                    language=data.get("language", "en"),
                    extra=data.get("extra", {}),
                )
            )
    return docs
