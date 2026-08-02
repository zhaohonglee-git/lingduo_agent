"""pytest fixtures - 共享测试夹具。"""
from __future__ import annotations

import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest

from abb_agent.config import get_config, reset_config


@pytest.fixture(autouse=True)
def isolated_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """每个测试用临时目录做数据根。"""
    monkeypatch.setenv("ABB_AGENT_PATHS__DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("ABB_AGENT_PATHS__CHROMA_DIR", str(tmp_path / "data" / "chroma_db"))
    monkeypatch.setenv("ABB_AGENT_PATHS__OUTPUT_DIR", str(tmp_path / "output"))
    reset_config()
    cfg = get_config()
    cfg.paths.data_dir = tmp_path / "data"
    cfg.paths.raw_dir = tmp_path / "data" / "raw"
    cfg.paths.parsed_dir = tmp_path / "data" / "parsed"
    cfg.paths.chroma_dir = tmp_path / "data" / "chroma_db"
    cfg.paths.output_dir = tmp_path / "output"
    cfg.paths.logs_dir = tmp_path / "logs"
    cfg.paths.ensure_dirs()
    yield tmp_path
    reset_config()
    # 清理
    if tmp_path.exists():
        shutil.rmtree(tmp_path, ignore_errors=True)
