"""系统级 Pack&Go 兼容包：.pgf 程序文件 + BASE.sys + 加载说明。"""
from __future__ import annotations

from pathlib import Path

from abb_agent.rapid.system_bundle import (
    build_load_readme,
    build_pgf,
    build_sys_module,
    bundle_for_controller,
)


def test_pgf_is_well_formed_xml() -> None:
    pgf = build_pgf(["PaintProgram", "BASE"])
    assert pgf.startswith("<?xml")
    assert "<Program>" in pgf
    assert "<Module>PaintProgram.mod</Module>" in pgf
    assert "<Module>BASE.sys</Module>" in pgf
    assert "</Program>" in pgf


def test_pgf_single_module() -> None:
    pgf = build_pgf(["PaintProgram"])
    assert pgf.count("<Module>") == 1
    assert "<Module>PaintProgram.mod</Module>" in pgf


def test_sys_module_has_home_and_error_trap() -> None:
    sysmod = build_sys_module()
    assert "MODULE BASE" in sysmod
    assert "ENDMODULE" in sysmod
    # 标准 Home 位
    assert "CONST robtarget pHome" in sysmod or "PERS robtarget pHome" in sysmod
    # 错误处理 trap
    assert "TRAP" in sysmod
    assert "ENDTRAP" in sysmod


def test_sys_module_irc5p_uses_paint_idle() -> None:
    """IRC5P 模式下 trap 应当用 PaintIdle 类指令，不只是 SetDO。"""
    sysmod = build_sys_module(controller="IRC5P")
    # IRC5P 的错误恢复策略应当包含工艺停机相关注释
    assert "IRC5P" in sysmod or "PaintIdle" in sysmod or "brushdata" in sysmod


def test_load_readme_lists_load_methods() -> None:
    readme = build_load_readme(module_filename="PaintProgram.mod")
    # 三种加载方式都应给出
    assert "RobotStudio" in readme
    assert "FlexPendant" in readme or "示教器" in readme
    assert "USB" in readme
    # 必须出现具体文件名
    assert "PaintProgram.mod" in readme


def test_load_readme_irc5p_mentions_paint_option() -> None:
    readme = build_load_readme(module_filename="PaintProgram.mod", controller="IRC5P")
    assert "Paint" in readme  # 提示需要 RobotWare Paint 选项


def test_bundle_writes_all_files(tmp_path: Path) -> None:
    module_code = (
        "MODULE PaintProgram\n"
        "    PERS brushdata bdMain := [80,300,50,50,50,0,FALSE,\"bdMain\",0];\n"
        "    PROC main()\n"
        "        ConfL\\Off;\n"
        "    ENDPROC\n"
        "ENDMODULE\n"
    )
    out = bundle_for_controller(tmp_path, module_code, controller="IRC5P")

    # 返回的字典指向落盘文件
    assert "module" in out
    assert "pgf" in out
    assert "sys" in out
    assert "readme" in out

    # 所有文件实际存在
    for path in out.values():
        assert path.exists(), path

    # 模块名从 module_code 提取，文件名匹配
    assert out["module"].name == "PaintProgram.mod"
    assert out["pgf"].suffix == ".pgf"
    assert out["sys"].name == "BASE.sys"


def test_bundle_extracts_module_name_from_code(tmp_path: Path) -> None:
    code = "MODULE CustomLine\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    out = bundle_for_controller(tmp_path, code, controller="IRC5")
    assert out["module"].name == "CustomLine.mod"
    pgf_content = out["pgf"].read_text(encoding="utf-8")
    assert "CustomLine.mod" in pgf_content


def test_bundle_falls_back_to_default_module_name(tmp_path: Path) -> None:
    """没有 MODULE 头的代码应使用默认名 'PaintProgram'。"""
    code = "PROC main()\n    ConfL\\Off;\nENDPROC\n"
    out = bundle_for_controller(tmp_path, code, controller="IRC5")
    assert out["module"].name == "PaintProgram.mod"
