"""IRC5P 专项 RAPID 校验规则。

新增三类问题码：
  - PNT001: PaintL/PaintC 缺少 brushdata 形参
  - TCP001: tooldata TCP 仍为默认占位值（必须现场标定）
  - IO001 : 引用的 IO 信号不在 EIO.cfg 白名单中
"""
from __future__ import annotations

from abb_agent.rapid.validator import Severity, validate


# ---------------- PNT001: PaintL 必须带 brushdata ----------------

def test_paintl_with_brushdata_passes() -> None:
    code = """MODULE M
    PERS brushdata bdMain := [80,300,50,50,50,0,FALSE,"bdMain",0];
    PROC main()
        PaintL p1, vPaint, bdMain, z10, tSprayGun\\WObj:=wobjPart;
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P")
    assert not any(i.code == "PNT001" for i in report.errors), report.format_summary()


def test_paintl_missing_brushdata_triggers_pnt001() -> None:
    # 5 个参数但其中没有 brushdata 标识
    code = """MODULE M
    PROC main()
        PaintL p1, vPaint, z10, tSprayGun\\WObj:=wobjPart;
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P")
    assert any(i.code == "PNT001" and i.severity == Severity.ERROR for i in report.issues), \
        report.format_summary()


def test_paintc_missing_brushdata_triggers_pnt001() -> None:
    code = """MODULE M
    PROC main()
        PaintC pMid, pEnd, vPaint, z10, tSprayGun\\WObj:=wobjPart;
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P")
    assert any(i.code == "PNT001" for i in report.errors), report.format_summary()


def test_paintl_not_checked_under_irc5_mode() -> None:
    """IRC5 模式下不应触发 PNT001（哪怕代码里写了 PaintL 也只是字符串）。"""
    code = """MODULE M
    PROC main()
        PaintL p1, vPaint, z10, tSprayGun\\WObj:=wobjPart;
    ENDPROC
ENDMODULE
"""
    report = validate(code)  # 默认 IRC5
    assert not any(i.code == "PNT001" for i in report.issues)


# ---------------- TCP001: tooldata 默认值告警 ----------------

def test_default_tcp_triggers_tcp001() -> None:
    """tooldata 中 TCP 偏移 [0,0,200] 是默认占位值，现场必须重新标定。"""
    code = """MODULE M
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PROC main()
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P", strict_tcp=True)
    assert any(i.code == "TCP001" for i in report.issues), report.format_summary()


def test_custom_tcp_no_warning() -> None:
    """非默认 TCP 不告警。"""
    code = """MODULE M
    PERS tooldata tSprayGun := [TRUE,[[12.5,3.4,287.6],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PROC main()
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P", strict_tcp=True)
    assert not any(i.code == "TCP001" for i in report.issues)


def test_default_tcp_silent_when_strict_off() -> None:
    """strict_tcp 关闭时不告警（开发期默认）。"""
    code = """MODULE M
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PROC main()
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P")
    assert not any(i.code == "TCP001" for i in report.issues)


# ---------------- IO001: IO 信号白名单 ----------------

def test_io_signal_in_whitelist_passes() -> None:
    code = """MODULE M
    PROC main()
        SetDO doSprayOn, 1;
    ENDPROC
ENDMODULE
"""
    report = validate(code, io_whitelist=("doSprayOn", "doFanOn"))
    assert not any(i.code == "IO001" for i in report.issues)


def test_io_signal_not_in_whitelist_triggers_io001() -> None:
    code = """MODULE M
    PROC main()
        SetDO doUnknown, 1;
    ENDPROC
ENDMODULE
"""
    report = validate(code, io_whitelist=("doSprayOn",))
    assert any(i.code == "IO001" and i.severity == Severity.ERROR for i in report.issues), \
        report.format_summary()


def test_io_whitelist_none_skips_check() -> None:
    """白名单未提供时不做检查（兼容老调用）。"""
    code = """MODULE M
    PROC main()
        SetDO doAnything, 1;
    ENDPROC
ENDMODULE
"""
    report = validate(code)
    assert not any(i.code == "IO001" for i in report.issues)


def test_pulsedo_also_checked() -> None:
    code = """MODULE M
    PROC main()
        PulseDO doMystery;
    ENDPROC
ENDMODULE
"""
    report = validate(code, io_whitelist=("doSprayOn",))
    assert any(i.code == "IO001" for i in report.issues)


def test_waitdi_also_checked() -> None:
    code = """MODULE M
    PROC main()
        WaitDI diMystery, 1;
    ENDPROC
ENDMODULE
"""
    report = validate(code, io_whitelist=("diBrushOK",))
    assert any(i.code == "IO001" for i in report.issues)


# ---------------- 集成场景：完整 IRC5P 程序 ----------------

def test_complete_irc5p_program_valid() -> None:
    code = """MODULE PaintLine
    PERS tooldata tSprayGun := [TRUE,[[15.2,0.3,287.5],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PERS wobjdata wobjPart := [FALSE,TRUE,"",[[100,0,0],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];
    PERS brushdata bdMain := [80,300,50,50,50,0,FALSE,"bdMain",0];
    CONST speeddata vPaint := [200,500,5000,1000];
    CONST robtarget P1 := [[500,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    CONST robtarget P2 := [[700,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];

    PROC main()
        ConfL\\Off;
        SingArea\\Wrist;
        MoveL P1, v500, fine, tSprayGun\\WObj:=wobjPart;
        PaintL P2, vPaint, bdMain, z10, tSprayGun\\WObj:=wobjPart;
    ENDPROC
ENDMODULE
"""
    report = validate(
        code,
        controller="IRC5P",
        io_whitelist=("doSprayOn", "doFanOn"),
        strict_tcp=True,
    )
    assert report.is_valid, report.format_summary()
