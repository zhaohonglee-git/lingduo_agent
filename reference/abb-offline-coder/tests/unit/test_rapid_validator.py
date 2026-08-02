"""验证 RAPID validator 在常见错误下行为正确。"""
from __future__ import annotations

import pytest

from abb_agent.rapid.validator import Severity, validate


def test_valid_module_passes() -> None:
    code = """
    MODULE Demo
        PROC main()
            MoveJ p1, v1000, fine, tool0;
        ENDPROC
    ENDMODULE
    """
    report = validate(code)
    assert report.is_valid


def test_missing_module_declaration_is_error() -> None:
    code = """
    PROC main()
        MoveJ p1, v1000, fine, tool0;
    ENDPROC
    """
    report = validate(code)
    assert not report.is_valid
    codes = {i.code for i in report.errors}
    assert "MOD001" in codes


def test_unclosed_proc_is_error() -> None:
    code = """
    MODULE Demo
        PROC main()
            MoveJ p1, v1000, fine, tool0;
    ENDMODULE
    """
    report = validate(code)
    assert not report.is_valid
    assert any(i.code in {"BLK002", "BLK003"} for i in report.errors)


def test_mismatched_endif_is_error() -> None:
    code = """
    MODULE Demo
        PROC main()
            IF x > 0 THEN
                MoveJ p1, v100, fine, tool0;
            ENDFOR
        ENDPROC
    ENDMODULE
    """
    report = validate(code)
    assert not report.is_valid


def test_uppercase_keyword_warning() -> None:
    code = """
    module Demo
        proc main()
            MoveJ p1, v1000, fine, tool0;
        endproc
    endmodule
    """
    report = validate(code)
    case_warnings = [i for i in report.issues if i.code == "CASE001"]
    assert len(case_warnings) > 0


def test_missing_semicolon_warning() -> None:
    code = """
    MODULE Demo
        PROC main()
            MoveJ p1, v1000, fine, tool0
        ENDPROC
    ENDMODULE
    """
    report = validate(code)
    sem_warnings = [i for i in report.issues if i.code == "SEM001"]
    assert len(sem_warnings) > 0


def test_unmatched_quotes_is_error() -> None:
    code = """
    MODULE Demo
        PROC main()
            TPWrite "hello;
        ENDPROC
    ENDMODULE
    """
    report = validate(code)
    assert any(i.code == "STR001" and i.severity == Severity.ERROR for i in report.issues)


def test_complete_painting_program_valid() -> None:
    code = """MODULE PaintLine
    PERS tooldata tSprayGun := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];
    CONST speeddata vPaint := [200,500,5000,1000];
    CONST robtarget P1 := [[500,0,300],[0,0,1,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];

    PROC main()
        ConfL\\Off;
        MoveJ P1, v1000, fine, tSprayGun;
        SetDO doSprayOn, 1;
        MoveL P1, vPaint, z1, tSprayGun;
        SetDO doSprayOn, 0;
    ENDPROC
ENDMODULE
"""
    report = validate(code)
    assert report.is_valid, report.format_summary()


@pytest.mark.parametrize(
    "snippet,expected_code",
    [
        # "MODULE" alone：MODULE 已声明，但未闭合 → BLK003
        ("MODULE M", "BLK003"),
        # missing MODULE 包装 → MOD001
        ('PROC test()\nMoveL p, v1, z1, t;\nENDPROC\n', "MOD001"),
    ],
)
def test_parametrized_errors(snippet: str, expected_code: str) -> None:
    report = validate(snippet)
    assert not report.is_valid
    assert any(i.code == expected_code for i in report.errors), (
        f"expected {expected_code}, got: " + ", ".join(i.code for i in report.errors)
    )
