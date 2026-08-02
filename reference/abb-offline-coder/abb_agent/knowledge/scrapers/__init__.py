"""知识来源采集层。"""

from abb_agent.knowledge.scrapers.seed_urls import (
    abb_official_seed_jobs,
    github_painting_repos,
    keyword_search_hints,
)
from abb_agent.knowledge.scrapers.web_scraper import (
    ScrapeJob,
    ScrapeReport,
    WebScraper,
    load_documents,
    save_documents,
)

__all__ = [
    "ScrapeJob",
    "ScrapeReport",
    "WebScraper",
    "abb_official_seed_jobs",
    "github_painting_repos",
    "keyword_search_hints",
    "load_documents",
    "save_documents",
]
