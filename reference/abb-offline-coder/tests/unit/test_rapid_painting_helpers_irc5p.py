"""IRC5P (Paint 选项) 模式下 painting_helpers 的代码生成行为。

IRC5P 与通用 IRC5 的关键差别：
  - 用 brushdata 类型代替自定义 PERS num
  - 用 PaintL/PaintC 代替 MoveL+SetDO 模式
  - PaintL 必须带 brushdata 形参
"""
from __future__ import annotations

from abb_agent.rapid.painting_helpers import (
    BrushParams,
    Pose,
    arc_segment,
    brush_data_decl,
    linear_scan,
    zigzag_scan,
)


def test_brush_data_decl_irc5p_uses_brushdata_type() -> None:
    """IRC5P 必须用 ABB 原生 brushdata 类型，而非 PERS num 替代。"""
    decl = brush_data_decl("bdMain", BrushParams(flow_rate=70, fan_width=250), controller="IRC5P")
    assert "PERS brushdata bdMain" in decl, decl
    assert "PERS num bdMain_flow" not in decl


def test_brush_data_decl_irc5p_carries_params() -> None:
    decl = brush_data_decl(
        "bdHigh",
        BrushParams(flow_rate=90, fan_width=400, atom_pressure=70),
        controller="IRC5P",
    )
    assert "90" in decl
    assert "400" in decl
    assert "70" in decl


def test_brush_data_decl_irc5_default_unchanged() -> None:
    """不显式指定 controller 时保持 IRC5 行为（向后兼容）。"""
    decl = brush_data_decl("bdMain", BrushParams())
    assert "PERS num bdMain_flow" in decl
    assert "brushdata" not in decl


def test_linear_scan_irc5p_uses_paintl_not_setdo() -> None:
    code = linear_scan(Pose(0, 0, 0), Pose(100, 0, 0), controller="IRC5P")
    assert "PaintL" in code
    assert "SetDO" not in code, "IRC5P 应通过 brushdata 控制工艺，不需要 SetDO 切换"
    # MoveL 仅允许出现在 PaintL 之前（用于高速定位到起点），不能在喷涂段之后
    code_lines = [ln for ln in code.splitlines() if not ln.lstrip().startswith("!")]
    paintl_idx = next(i for i, ln in enumerate(code_lines) if "PaintL" in ln)
    after = code_lines[paintl_idx + 1:]
    assert not any("MoveL" in ln for ln in after), "PaintL 之后不应再用 MoveL"


def test_linear_scan_irc5p_paintl_carries_brushdata() -> None:
    code = linear_scan(
        Pose(0, 0, 0), Pose(100, 0, 0),
        controller="IRC5P",
        brush="bdHigh",
    )
    # PaintL target, speed, brush, zone, tool\WObj:=wobj;
    assert "bdHigh" in code
    assert "PaintL" in code


def test_linear_scan_irc5_default_unchanged() -> None:
    """IRC5 模式（默认）保留原有 SetDO 行为。"""
    code = linear_scan(Pose(0, 0, 0), Pose(100, 0, 0))
    assert "SetDO doSprayOn, 1" in code
    assert "SetDO doSprayOn, 0" in code
    assert "MoveL" in code
    assert "PaintL" not in code


def test_zigzag_scan_irc5p_uses_paintl_for_paint_rows() -> None:
    code = zigzag_scan(
        Pose(0, 0, 300), width=200, height=100, row_spacing=50, controller="IRC5P"
    )
    # 100/50+1 = 3 行喷涂段
    assert code.count("PaintL") >= 3
    assert "SetDO doSprayOn" not in code


def test_zigzag_scan_irc5p_inter_row_uses_movel() -> None:
    """行间快速定位不喷涂，仍用 MoveL（不带 brush）以避免触发工艺。"""
    code = zigzag_scan(
        Pose(0, 0, 300), width=200, height=100, row_spacing=50, controller="IRC5P"
    )
    # 行间定位用 MoveL（v500）+ fine
    assert "MoveL" in code
    assert "v500" in code


def test_arc_segment_irc5p_uses_paintc() -> None:
    code = arc_segment(
        Pose(0, 0, 0), Pose(50, 50, 0), Pose(100, 0, 0),
        controller="IRC5P",
        brush="bdMain",
    )
    assert "PaintC" in code
    assert "bdMain" in code
    assert "MoveC" not in code


def test_arc_segment_irc5_default_unchanged() -> None:
    code = arc_segment(Pose(0, 0, 0), Pose(50, 50, 0), Pose(100, 0, 0))
    assert "MoveC" in code
    assert "PaintC" not in code
