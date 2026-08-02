"""推荐种子 URL 清单。

这些链接是公开可访问的 ABB 文档资源，可作为初始知识库源头。
**版权提醒**：本项目仅作单机离线助手，请勿再分发抓取内容。
使用者需自行确认目标站点 robots.txt 与服务条款。
"""
from __future__ import annotations

from abb_agent.knowledge.scrapers.web_scraper import ScrapeJob
from abb_agent.rag.models import SourceType


def abb_official_seed_jobs() -> list[ScrapeJob]:
    """ABB 官方文档相关页（建议用户自行评估 robots.txt 后再抓取）。"""
    return [
        # 这里只是占位示例 - 实际 URL 应由用户在初始化时填入
        # 因为 ABB 站点结构会变化，建议把可访问的 URL 列在配置文件中
        ScrapeJob(
            url="https://library.abb.com/r?cid=9AAC100211&dk=RAPID",
            source_type=SourceType.OFFICIAL_MANUAL,
            language="en",
            tags=("abb-library",),
        ),
    ]


def github_painting_repos() -> list[str]:
    """GitHub 上含 ABB RAPID 喷涂示例的公共仓库（仅作搜索关键词参考）。

    实际使用时建议手动 clone 这些仓库到 data/raw/github_code/ 目录，
    然后用 parse_mod_directory 解析。
    """
    return [
        # 这些只是 GitHub 搜索关键词参考，仓库由用户验证后下载
        # "https://github.com/search?q=ABB+RAPID+painting",
        # "https://github.com/search?q=BrushData+RAPID",
        # "https://github.com/search?q=TriggIO+spray",
    ]


def keyword_search_hints() -> list[str]:
    """用户在有网环境下手动搜索时的推荐关键词。"""
    return [
        "ABB RAPID Reference Manual PDF",
        "ABB Application Manual Robotware-Paint",
        "ABB IRB 52 Paint Robot Manual",
        "ABB IRB 5500 Product Manual",
        "RAPID Instructions Functions 3HAC050917",
        "RAPID Painting Programming Examples",
        "BrushData TriggIO Paint Process",
    ]
