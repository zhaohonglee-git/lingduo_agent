"""验证 .mod 文件解析。"""
from __future__ import annotations

from pathlib import Path

import pytest

from abb_agent.knowledge.parsers.mod_parser import parse_mod, parse_mod_directory


@pytest.fixture
def sample_mod(tmp_path: Path) -> Path:
    content = """MODULE PaintDemo
    PERS tooldata tSpray := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];

    PROC mainPaint()
        MoveJ p1, v1000, fine, tSpray;
        SetDO doSpray, 1;
        MoveL p2, v200, z1, tSpray;
        SetDO doSpray, 0;
    ENDPROC

    PROC calibrate()
        TPWrite "校准开始";
    ENDPROC

    FUNC num GetFlow()
        RETURN 80;
    ENDFUNC
ENDMODULE
"""
    file_path = tmp_path / "PaintDemo.mod"
    file_path.write_text(content, encoding="utf-8")
    return file_path


def test_parse_mod_extracts_procedures(sample_mod: Path) -> None:
    docs = parse_mod(sample_mod)
    titles = {d.title for d in docs}
    assert "PaintDemo.mainPaint" in titles
    assert "PaintDemo.calibrate" in titles


def test_parse_mod_extracts_functions(sample_mod: Path) -> None:
    docs = parse_mod(sample_mod)
    titles = {d.title for d in docs}
    assert "PaintDemo.GetFlow" in titles


def test_parse_mod_metadata_includes_module(sample_mod: Path) -> None:
    docs = parse_mod(sample_mod)
    for d in docs:
        assert d.extra.get("module") == "PaintDemo"


def test_parse_mod_directory_handles_empty(tmp_path: Path) -> None:
    docs = parse_mod_directory(tmp_path)
    assert docs == []


def test_parse_mod_directory_processes_all(sample_mod: Path) -> None:
    docs = parse_mod_directory(sample_mod.parent)
    assert len(docs) >= 3  # mainPaint + calibrate + GetFlow
