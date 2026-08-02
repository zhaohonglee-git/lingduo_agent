#!/usr/bin/env python3
"""一键构建知识库脚本。

扫描 data/raw/{pdf,code,html} 目录，自动检测并入库。
可在有网或无网环境运行 - 不再做爬取，假定原始资料已就位。
"""
from __future__ import annotations

import sys
from pathlib import Path

# 把项目根加入 sys.path（脚本独立运行时需要）
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from loguru import logger  # noqa: E402

from abb_agent.knowledge.builder import KnowledgeBuilder  # noqa: E402
from abb_agent.rag.vector_store import VectorStore  # noqa: E402


def main() -> int:
    logger.info("=== 构建 ABB Agent 知识库 ===")
    builder = KnowledgeBuilder(vector_store=VectorStore())
    summary = builder.build_all_local_sources()
    logger.info(summary.format())
    logger.info("=== 完成 ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
