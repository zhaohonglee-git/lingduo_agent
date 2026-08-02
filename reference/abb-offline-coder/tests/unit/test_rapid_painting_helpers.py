"""验证喷涂场景代码生成器。"""
from __future__ import annotations

from abb_agent.rapid.painting_helpers import (
    BrushParams,
    Pose,
    arc_segment,
    brush_data_decl,
    linear_scan,
    robtarget_decl,
    robtarget_inline,
    tcp_calibration_program,
    trigg_io_setup,
    trigg_l_movement,
    zigzag_scan,
)
from abb_agent.rapid.validator import validate


def test_robtarget_decl_contains_position() -> None:
    pose = Pose(100, 200, 300)
    decl = robtarget_decl("pTest", pose)
    assert "pTest" in decl
    assert "[100,200,300]" in decl


def test_robtarget_inline_has_extax_placeholder() -> None:
    pose = Pose(0, 0, 0)
    inline = robtarget_inline(pose)
    assert "9E9" in inline


def test_brush_data_decl_includes_all_params() -> None:
    p = BrushParams(flow_rate=70, fan_width=250, atom_pressure=40)
    decl = brush_data_decl("bdTest", p)
    assert "70" in decl
    assert "250" in decl
    assert "40" in decl


def test_linear_scan_has_on_off_signals() -> None:
    code = linear_scan(Pose(0, 0, 0), Pose(100, 0, 0))
    assert "SetDO doSprayOn, 1" in code
    assert "SetDO doSprayOn, 0" in code
    assert "MoveL" in code


def test_zigzag_scan_alternates_direction() -> None:
    code = zigzag_scan(
        Pose(0, 0, 300),
        width=500,
        height=400,
        row_spacing=100,
    )
    # 至少 4 行（400/100 + 1）
    assert code.count("SetDO doSprayOn, 1") >= 4


def test_zigzag_scan_obeys_row_spacing() -> None:
    code = zigzag_scan(Pose(0, 0, 300), 500, 400, row_spacing=50)
    # 应该产生 9 行（400/50 + 1）
    assert code.count("MoveL") >= 9


def test_trigg_io_setup_includes_signal() -> None:
    code = trigg_io_setup("trgOn", 80, signal="doPaintOn", value=1)
    assert "TriggIO trgOn" in code
    assert "doPaintOn" in code


def test_trigg_l_movement_format() -> None:
    code = trigg_l_movement("pEnd", "trgOn")
    assert "TriggL pEnd" in code
    assert "trgOn" in code


def test_tcp_calibration_program_has_proc() -> None:
    code = tcp_calibration_program()
    assert "PROC CalibrateSprayTCP" in code
    assert "ENDPROC" in code


def test_arc_segment_uses_movec() -> None:
    code = arc_segment(Pose(0, 0, 0), Pose(50, 50, 0), Pose(100, 0, 0))
    assert "MoveC" in code


def test_generated_program_passes_validator() -> None:
    """组合多个 helper 输出 + 模板包装，校验通过。"""
    from abb_agent.rapid.module_template import wrap_in_module

    body = (
        "    PROC main()\n"
        "        ConfL\\Off;\n"
        + linear_scan(Pose(0, 0, 300), Pose(500, 0, 300)) + "\n"
        "    ENDPROC"
    )
    program = wrap_in_module(body, module_name="TestPaint")
    report = validate(program)
    # 至少 MOD001 这种结构错误必须没有
    assert not any(i.code == "MOD001" for i in report.errors)
