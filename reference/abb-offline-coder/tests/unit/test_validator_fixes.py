"""Validator 修复：C3 (Reset 误报) / H1 (TCP 模式) / H6 (switch 剥离)。"""
from __future__ import annotations

from abb_agent.rapid.validator import Severity, validate


# ---------------- C3: Reset 只对 IO 信号检查 ----------------

def test_reset_non_io_identifier_not_flagged() -> None:
    """`Reset stopwatch1` 是 clock 复位，不是 IO；不应触发 IO001。"""
    code = """MODULE M
    VAR clock stopwatch1;
    PROC main()
        Reset stopwatch1;
    ENDPROC
ENDMODULE
"""
    report = validate(code, io_whitelist=("doSprayOn",))
    assert not any(i.code == "IO001" for i in report.errors), report.format_summary()


def test_reset_do_prefixed_signal_still_checked() -> None:
    """`Reset doMystery` 命名像 IO，仍应触发 IO001。"""
    code = """MODULE M
    PROC main()
        Reset doMystery;
    ENDPROC
ENDMODULE
"""
    report = validate(code, io_whitelist=("doSprayOn",))
    assert any(i.code == "IO001" for i in report.errors)


def test_reset_known_signal_passes() -> None:
    code = """MODULE M
    PROC main()
        Reset doSprayOn;
    ENDPROC
ENDMODULE
"""
    report = validate(code, io_whitelist=("doSprayOn",))
    assert not any(i.code == "IO001" for i in report.errors)


def test_io001_dedups_by_signal_name() -> None:
    """同一未声明信号引用 50 次，只报 1 次（M5）。"""
    body = "\n        ".join([f"SetDO doMystery, 1;" for _ in range(50)])
    code = f"MODULE M\n    PROC main()\n        {body}\n    ENDPROC\nENDMODULE\n"
    report = validate(code, io_whitelist=("doSprayOn",))
    io_errors = [i for i in report.errors if i.code == "IO001"]
    assert len(io_errors) == 1, f"应去重，实际 {len(io_errors)}"


# ---------------- H1: TCP001 兼容浮点与多余空格 ----------------

def test_tcp001_matches_float_format() -> None:
    """tooldata 中 TCP 为 [0.0, 0, 200.0] 仍应触发。"""
    code = """MODULE M
    PERS tooldata tSprayGun := [TRUE,[[0.0,0,200.0],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PROC main()
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P", strict_tcp=True)
    assert any(i.code == "TCP001" for i in report.issues)


def test_tcp001_matches_spaced_format() -> None:
    code = """MODULE M
    PERS tooldata tSprayGun := [TRUE,[[ 0 , 0 , 200 ],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    PROC main()
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P", strict_tcp=True)
    assert any(i.code == "TCP001" for i in report.issues)


# ---------------- H6: PaintL switch 含数字也能剥离 ----------------

def test_paintl_with_numeric_switch_not_flagged() -> None:
    """PaintL 带 \\T:=2 这种数字开关，不应误报 PNT001。"""
    code = """MODULE M
    PERS brushdata bdMain := [80,300,50,50,50,0,FALSE,"bdMain",0];
    PROC main()
        PaintL p1, vPaint, bdMain, z10, tSprayGun\\T:=2\\WObj:=wobjPart;
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P")
    assert not any(i.code == "PNT001" for i in report.errors), report.format_summary()


# ---------------- M1: PaintL 出现在 IF/THEN 后也要检 ----------------

def test_paintl_after_if_then_is_validated() -> None:
    """IF cond THEN PaintL ... 这种单行写法的 PaintL 仍应被 PNT001 检查到。"""
    code = """MODULE M
    PROC main()
        IF nFlow > 50 THEN PaintL p1, vPaint, z10, tSprayGun; ENDIF
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P")
    assert any(i.code == "PNT001" for i in report.errors), report.format_summary()


def test_multiple_paintl_on_same_line_all_checked() -> None:
    """同一行多个 PaintL（极少见但合法）也应该都被遍历。"""
    code = """MODULE M
    PERS brushdata bdMain := [80,300,50,50,50,0,FALSE,"bdMain",0];
    PROC main()
        IF x THEN PaintL p1, v100, bdMain, z, t; PaintL p2, v100, z, t; ENDIF
    ENDPROC
ENDMODULE
"""
    report = validate(code, controller="IRC5P")
    # 第二个 PaintL 缺 brushdata，应被检出
    pnt = [i for i in report.errors if i.code == "PNT001"]
    assert len(pnt) >= 1, report.format_summary()
