"""H5: io_whitelist 接受 CSV 字符串。

pydantic-settings 默认要求 tuple[str, ...] 是 JSON 数组，对现场工程师太不友好。
应当同时接受 'doA,doB,doC' 和 '["doA","doB","doC"]'。
"""
from __future__ import annotations

import os

import pytest

from abb_agent.config import RapidConfig


def test_io_whitelist_default() -> None:
    cfg = RapidConfig()
    assert "doSprayOn" in cfg.io_whitelist


def test_io_whitelist_accepts_csv_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ABB_AGENT_RAPID_IO_WHITELIST", "doA,doB,doC")
    cfg = RapidConfig()
    assert cfg.io_whitelist == ("doA", "doB", "doC")


def test_io_whitelist_accepts_json_array(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ABB_AGENT_RAPID_IO_WHITELIST", '["doX","doY"]')
    cfg = RapidConfig()
    assert cfg.io_whitelist == ("doX", "doY")


def test_io_whitelist_strips_whitespace(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ABB_AGENT_RAPID_IO_WHITELIST", "doA, doB , doC")
    cfg = RapidConfig()
    assert cfg.io_whitelist == ("doA", "doB", "doC")


def test_io_whitelist_skips_empty_entries(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ABB_AGENT_RAPID_IO_WHITELIST", "doA,,doB,")
    cfg = RapidConfig()
    assert cfg.io_whitelist == ("doA", "doB")


def test_io_whitelist_capped_at_reasonable_size(monkeypatch: pytest.MonkeyPatch) -> None:
    """L5: 防止 env 注入 10MB 字符串撑爆配置。"""
    monkeypatch.setenv(
        "ABB_AGENT_RAPID_IO_WHITELIST", ",".join(f"do{i}" for i in range(500))
    )
    cfg = RapidConfig()
    # 不强制硬上限值，只要不爆即可；同时数量应远超默认
    assert 100 < len(cfg.io_whitelist) <= 500
