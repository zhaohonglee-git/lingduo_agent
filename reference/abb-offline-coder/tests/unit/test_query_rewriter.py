"""验证查询改写器。"""
from __future__ import annotations

import pytest

from abb_agent.rag.query_rewriter import TaskCategory, rewrite


@pytest.mark.parametrize(
    "query,expected_category",
    [
        ("在车门外板做 Z 字扫描喷涂，行距 50mm", TaskCategory.ZIGZAG_SCAN),
        ("直线扫描喷涂", TaskCategory.LINEAR_SCAN),
        ("沿曲面做圆弧喷涂", TaskCategory.ARC_SCAN),
        ("写一个喷枪 TCP 校准程序", TaskCategory.TCP_CALIBRATION),
        ("配置喷涂的笔刷表和流量", TaskCategory.BRUSH_CONFIG),
        ("控制喷枪开关信号", TaskCategory.IO_CONTROL),
        ("生成一个机器人程序", TaskCategory.GENERAL),
    ],
)
def test_category_classification(query: str, expected_category: TaskCategory) -> None:
    rew = rewrite(query)
    assert rew.category == expected_category


def test_rewritten_contains_english_terms() -> None:
    rew = rewrite("在矩形面上做 Z 字扫描喷涂")
    assert "zigzag" in rew.rewritten.lower() or "raster" in rew.rewritten.lower()


def test_keywords_extracted() -> None:
    rew = rewrite("喷枪 TCP 校准")
    assert len(rew.extracted_keywords) > 0
    # 应包含 calibration 或 TCP 相关词
    assert any("calibrat" in k.lower() or "tcp" in k.lower() for k in rew.extracted_keywords)


def test_for_retrieval_includes_keywords() -> None:
    rew = rewrite("流量和扇幅工艺设置")
    text = rew.for_retrieval()
    assert "关键词" in text


def test_unknown_query_falls_back_to_general() -> None:
    rew = rewrite("完全无关的查询")
    assert rew.category == TaskCategory.GENERAL
    assert rew.original == "完全无关的查询"
