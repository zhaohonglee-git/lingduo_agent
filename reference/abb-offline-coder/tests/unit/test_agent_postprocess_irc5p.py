"""IRC5P 模式下 agent._postprocess 行为。"""
from __future__ import annotations

from abb_agent.agent import _postprocess


def test_postprocess_irc5p_wraps_with_brushdata() -> None:
    raw = "PROC main()\n    PaintL p1, vPaint, bdMain, z10, tSprayGun;\nENDPROC"
    final, _ = _postprocess(raw, controller="IRC5P")
    assert "PERS brushdata bdMain" in final


def test_postprocess_irc5p_validates_with_brushdata_check() -> None:
    """IRC5P 模式下 PaintL 缺 brushdata 会被校验出来。"""
    raw = "PROC main()\n    PaintL p1, vPaint, z10, tSprayGun;\nENDPROC"
    _, report = _postprocess(raw, controller="IRC5P")
    assert any(i.code == "PNT001" for i in report.errors), report.format_summary()


def test_postprocess_irc5_default_no_brushdata_check() -> None:
    """IRC5 模式下不做 PNT001 校验（向后兼容）。"""
    raw = "PROC main()\n    PaintL p1, vPaint, z10, tSprayGun;\nENDPROC"
    _, report = _postprocess(raw)
    assert not any(i.code == "PNT001" for i in report.issues)


def test_postprocess_io_whitelist_passthrough() -> None:
    raw = "PROC main()\n    SetDO doMystery, 1;\nENDPROC"
    _, report = _postprocess(raw, io_whitelist=("doSprayOn",))
    assert any(i.code == "IO001" for i in report.errors)


def test_postprocess_strict_tcp_passthrough() -> None:
    """wrap_in_module 注入默认 tooldata（含 [0,0,200] TCP），strict_tcp 开启时应被发现。"""
    raw = "PROC main()\n    PaintL p1, vPaint, bdMain, z10, tSprayGun;\nENDPROC"
    _, report = _postprocess(raw, controller="IRC5P", strict_tcp=True)
    assert any(i.code == "TCP001" for i in report.issues), report.format_summary()
