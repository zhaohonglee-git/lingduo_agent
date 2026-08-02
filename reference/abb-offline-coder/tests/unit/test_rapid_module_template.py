"""验证 module_template 自动包模块逻辑。"""
from __future__ import annotations

from abb_agent.rapid.module_template import (
    DEFAULT_SPEED_PAINT,
    DEFAULT_TOOL_DATA,
    DEFAULT_WOBJ_DATA,
    empty_painting_skeleton,
    ensure_main_proc,
    wrap_in_module,
)


def test_wrap_in_module_adds_wrapper_when_missing() -> None:
    raw = "PROC main()\n    MoveJ p1, v1000, fine, tool0;\nENDPROC"
    result = wrap_in_module(raw, module_name="TestMod")
    assert "MODULE TestMod" in result
    assert "ENDMODULE" in result


def test_wrap_in_module_skips_when_already_wrapped() -> None:
    raw = "MODULE Existing\n    PROC main() ENDPROC\nENDMODULE"
    result = wrap_in_module(raw)
    assert result == raw


def test_wrap_injects_tool_when_missing() -> None:
    raw = "PROC main()\n    MoveL p, v100, z1, tSprayGun;\nENDPROC"
    result = wrap_in_module(raw, inject_defaults=True)
    assert "tooldata" in result
    assert "wobjdata" in result
    assert "speeddata" in result


def test_wrap_skips_defaults_when_present() -> None:
    raw = (
        "PERS tooldata tSpray := [TRUE,[[0,0,200],[1,0,0,0]],[2.5,[0,0,80],[1,0,0,0],0,0,0]];\n"
        "PROC main()\n"
        "    MoveL p, v100, z1, tSpray;\n"
        "ENDPROC\n"
    )
    result = wrap_in_module(raw, inject_defaults=True)
    assert result.count("tooldata") == 1  # 仅原有一处


def test_ensure_main_proc_adds_when_missing() -> None:
    code = "MODULE M\nENDMODULE\n"
    result = ensure_main_proc(code, ["MoveJ p1, v100, fine, tool0;"])
    assert "PROC main()" in result


def test_empty_painting_skeleton_is_valid_rapid_structure() -> None:
    sk = empty_painting_skeleton()
    rendered = sk.render()
    assert "MODULE PaintProgram" in rendered
    assert "ENDMODULE" in rendered
    assert DEFAULT_TOOL_DATA in rendered
    assert DEFAULT_WOBJ_DATA in rendered
    assert DEFAULT_SPEED_PAINT in rendered
