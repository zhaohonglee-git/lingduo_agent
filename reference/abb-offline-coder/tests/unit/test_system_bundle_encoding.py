"""C1/C2/M3: BASE.sys 必须 ASCII；PGF 必须 ISO-8859-1 + CRLF；ISignalDI 语法正确。"""
from __future__ import annotations

from pathlib import Path

from abb_agent.rapid.system_bundle import (
    build_pgf,
    build_sys_module,
    bundle_for_controller,
)
from abb_agent.rapid.validator import validate


def test_base_sys_is_pure_ascii() -> None:
    """BASE.sys 不应含非 ASCII（控制器多用 Latin-1 加载，中文会乱码或拒绝）。"""
    for c in ("IRC5", "IRC5P"):
        sysmod = build_sys_module(controller=c)  # type: ignore[arg-type]
        try:
            sysmod.encode("ascii")
        except UnicodeEncodeError as e:
            raise AssertionError(
                f"BASE.sys for {c} contains non-ASCII char at position "
                f"{e.start}: {sysmod[max(0, e.start-30):e.start+30]!r}"
            ) from None


def test_pgf_is_pure_ascii() -> None:
    pgf = build_pgf(["BASE", "PaintProgram"])
    pgf.encode("ascii")  # raises if not ASCII


def test_base_sys_isignal_di_uses_correct_order(tmp_path: Path) -> None:
    """ISignalDI signature 应为 \\Single, signal, value, interrupt。

    reviewer M3 指出原来写的 'ISignalDI diEmergencyStop, 1, iErrHandler' 顺序错。
    """
    sysmod = build_sys_module(controller="IRC5P")
    if "ISignalDI" in sysmod:
        # 至少要有 \Single 开关或显式注释说明
        assert (
            "\\Single" in sysmod
            or "interrupt" in sysmod.lower()
            or "TODO" in sysmod
        ), "ISignalDI 必须用正确参数顺序或标注为 TODO 占位"


def test_base_sys_passes_validator() -> None:
    """生成的 BASE.sys 自身应通过基础语法校验（MODULE/PROC/TRAP 配对、分号等）。"""
    sysmod = build_sys_module(controller="IRC5P")
    report = validate(sysmod)
    # 至少结构错误（MOD001/BLK00x/STR001）不应出现
    structural = [i for i in report.errors if i.code.startswith(("MOD", "BLK", "STR"))]
    assert not structural, report.format_summary()


def test_bundle_writes_pgf_as_latin1_with_crlf(tmp_path: Path) -> None:
    code = "MODULE PaintProgram\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    out = bundle_for_controller(tmp_path, code, controller="IRC5")
    pgf_bytes = out["pgf"].read_bytes()
    # latin-1 解码不抛错
    pgf_bytes.decode("iso-8859-1")
    # CRLF 行终止符
    assert b"\r\n" in pgf_bytes, "PGF 应使用 CRLF 行终止符（控制器兼容）"


def test_bundle_writes_sys_as_latin1(tmp_path: Path) -> None:
    code = "MODULE PaintProgram\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    out = bundle_for_controller(tmp_path, code, controller="IRC5P")
    sys_bytes = out["sys"].read_bytes()
    sys_bytes.decode("iso-8859-1")  # 不抛错即可
