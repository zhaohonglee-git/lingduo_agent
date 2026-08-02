#!/usr/bin/env python3
"""下载本地模型（嵌入模型 + LLM）。

在有网环境运行一次：
  1. 通过 ollama pull 拉取 LLM 模型
  2. 触发 sentence-transformers 下载 bge 嵌入模型到本地 models/embeddings
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from loguru import logger  # noqa: E402

from abb_agent.config import get_config  # noqa: E402


def ensure_ollama_installed() -> bool:
    if shutil.which("ollama") is None:
        logger.error(
            "未检测到 ollama，请先安装：\n"
            "  Mac/Linux: curl -fsSL https://ollama.com/install.sh | sh\n"
            "  Windows:  https://ollama.com/download"
        )
        return False
    return True


def pull_ollama_model(model_name: str) -> bool:
    logger.info("拉取 LLM 模型: {} (可能需要几分钟到几十分钟)", model_name)
    try:
        result = subprocess.run(
            ["ollama", "pull", model_name],
            check=True,
            capture_output=False,
        )
        return result.returncode == 0
    except subprocess.CalledProcessError as exc:
        logger.error("拉取失败: {}", exc)
        return False


def download_embedder() -> bool:
    cfg = get_config()
    logger.info("下载嵌入模型: {}", cfg.embed.model_name)
    try:
        from sentence_transformers import SentenceTransformer

        cache_dir = Path(cfg.embed.cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)
        model = SentenceTransformer(
            cfg.embed.model_name,
            cache_folder=str(cache_dir),
            device="cpu",
        )
        # 做一次空跑触发完全下载
        _ = model.encode(["test"], show_progress_bar=False)
        logger.info("嵌入模型下载完成，缓存在 {}", cache_dir)
        return True
    except Exception as exc:
        logger.error("嵌入模型下载失败: {}", exc)
        return False


def main() -> int:
    cfg = get_config()
    logger.info("=== 下载 ABB Agent 所需模型 ===")

    if not ensure_ollama_installed():
        return 1

    success = True
    if not pull_ollama_model(cfg.llm.model_name):
        logger.warning("主模型下载失败，尝试备选模型")
        if not pull_ollama_model(cfg.llm.fallback_model):
            logger.error("备选模型也下载失败")
            success = False

    if not download_embedder():
        success = False

    if success:
        logger.info("=== 全部模型下载完成 ===")
        return 0
    logger.error("=== 部分模型下载失败，请检查网络 ===")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
