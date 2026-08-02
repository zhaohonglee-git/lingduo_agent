"""C4 / H4: brushdata 安全化与自动注入。

reviewer 指出：
- 当前硬编码的 9 字段 brushdata 结构可能与任何 RobotWare Paint 版本不完全匹配
- wrap_in_module 只注入 bdMain，但 helpers/LLM 可能引用别的 brush 名 → 控制器报 data unknown

修复策略：
- brushdata 字面量上方注入 [WARNING] 注释，强制现场对照
- wrap_in_module 扫描代码中所有 PaintL/PaintC 引用的 brush 名字，全部注入声明
"""
from __future__ import annotations

from abb_agent.rapid.module_template import wrap_in_module
from abb_agent.rapid.painting_helpers import BrushParams, brush_data_decl


def test_brushdata_decl_irc5p_has_warning_comment() -> None:
    """生成的 brushdata 必须带「现场必须校核」警告注释。"""
    decl = brush_data_decl("bdMain", BrushParams(), controller="IRC5P")
    assert "WARNING" in decl or "警告" in decl or "校核" in decl
    # 字段顺序提示也必须在
    assert "RobotWare" in decl or "Paint" in decl


def test_wrap_in_module_scans_paintl_for_brush_refs() -> None:
    """代码引用 bdCustom，wrap 应该注入 bdCustom 而不是默认 bdMain。"""
    code = "PROC main()\n    PaintL p1, vPaint, bdCustom, z10, tSprayGun;\nENDPROC"
    wrapped = wrap_in_module(code, controller="IRC5P")
    assert "PERS brushdata bdCustom" in wrapped


def test_wrap_in_module_injects_all_referenced_brushes() -> None:
    """同一份代码引用多个不同的 brush，全部注入。"""
    code = (
        "PROC main()\n"
        "    PaintL p1, vPaint, bdLow, z10, tSprayGun;\n"
        "    PaintC p2, p3, vPaint, bdHigh, z10, tSprayGun;\n"
        "ENDPROC"
    )
    wrapped = wrap_in_module(code, controller="IRC5P")
    assert "PERS brushdata bdLow" in wrapped
    assert "PERS brushdata bdHigh" in wrapped


def test_wrap_in_module_skips_already_declared_brushes() -> None:
    """已声明的 brush 不重复注入。"""
    code = (
        "PERS brushdata bdLow := [50,200,30,30,30,0,FALSE,\"bdLow\",0];\n"
        "PROC main()\n"
        "    PaintL p1, vPaint, bdLow, z10, tSprayGun;\n"
        "    PaintC p2, p3, vPaint, bdHigh, z10, tSprayGun;\n"
        "ENDPROC"
    )
    wrapped = wrap_in_module(code, controller="IRC5P")
    assert wrapped.count("PERS brushdata bdLow") == 1
    assert "PERS brushdata bdHigh" in wrapped


def test_wrap_in_module_irc5p_falls_back_to_bdMain_when_no_paintl() -> None:
    """代码没有 PaintL 引用时仍注入默认 bdMain（兜底）。"""
    code = "PROC main()\n    MoveL p1, v500, fine, tSprayGun;\nENDPROC"
    wrapped = wrap_in_module(code, controller="IRC5P")
    assert "PERS brushdata bdMain" in wrapped


def test_wrap_in_module_irc5_no_brush_scan() -> None:
    """IRC5 模式不应触发任何 brushdata 注入或扫描。"""
    code = "PROC main()\n    PaintL p1, vPaint, bdMain, z10, tSprayGun;\nENDPROC"
    wrapped = wrap_in_module(code)
    assert "brushdata" not in wrapped


def test_wrap_in_module_handles_inline_robtarget() -> None:
    """关键回归测试：inline robtarget 含大量逗号，brush 名提取必须感知括号深度。

    helpers.zigzag_scan(controller='IRC5P', brush='bdHigh') 输出会内联 robtarget，
    形如 `PaintL [[x,y,z],[q1,q2,q3,q4],...], vPaint, bdHigh, z10, tool\\WObj:=wobj;`
    如果用 naive split(',')，bdHigh 会落在错误的位置。
    """
    code = (
        "PROC main()\n"
        "    PaintL [[200,0,300],[1,0,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], "
        "vPaint, bdHigh, z10, tSprayGun\\WObj:=wobjPart;\n"
        "ENDPROC"
    )
    wrapped = wrap_in_module(code, controller="IRC5P")
    assert "PERS brushdata bdHigh" in wrapped, wrapped
