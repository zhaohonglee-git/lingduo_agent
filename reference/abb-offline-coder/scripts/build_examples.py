"""生成 examples/ 目录下的样例 bundle，便于演示 IRC5/IRC5P 对比。

不依赖 LLM，直接调用库 API（painting_helpers + module_template + system_bundle）
拼出参数化的代码块。重跑会覆盖（用 force=True）。

用法:
    .venv/bin/python scripts/build_examples.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Literal

from abb_agent.rapid.formatter import format_code
from abb_agent.rapid.module_template import wrap_in_module
from abb_agent.rapid.painting_helpers import Pose, zigzag_scan
from abb_agent.rapid.system_bundle import bundle_for_controller
from abb_agent.rapid.validator import validate

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = PROJECT_ROOT / "examples"


def build_zigzag_program(
    *, controller: Literal["IRC5", "IRC5P"], module_name: str
) -> str:
    """600x400mm 平板 Z 字扫描喷涂，行距 50mm。"""
    body = (
        "    PROC main()\n"
        "        ! 安全设置\n"
        "        ConfL\\Off;\n"
        "        SingArea\\Wrist;\n"
        "\n"
        "        ! 600x400 平板 Z 字扫描\n"
        + zigzag_scan(
            Pose(0, 0, 300),
            width=600,
            height=400,
            row_spacing=50,
            controller=controller,
            brush="bdMain",
        ) + "\n"
        "    ENDPROC"
    )
    wrapped = wrap_in_module(
        body,
        module_name=module_name,
        description=f"600x400 平板 Z 字扫描喷涂 ({controller} 模式样例)",
        controller=controller,
    )
    return format_code(wrapped)


def build_one(out_dir: Path, controller: Literal["IRC5", "IRC5P"]) -> dict[str, Path]:
    module_name = f"DoorPaint_{controller}"
    code = build_zigzag_program(controller=controller, module_name=module_name)

    # 校验（IRC5P 启用 PaintL/IO/strict-TCP；IRC5 只做基础校验）
    if controller == "IRC5P":
        report = validate(
            code,
            controller="IRC5P",
            io_whitelist=("doSprayOn", "doFanOn", "doAtomOn"),
            strict_tcp=False,  # 示例用占位 TCP，不强制
        )
    else:
        report = validate(code, io_whitelist=("doSprayOn",))

    if not report.is_valid:
        print(f"  [FAIL] {controller} 校验未通过:")
        print(report.format_summary())
        sys.exit(1)

    # 清空目录（force=True 会保留 .gitkeep 之类，简单粗暴：直接删）
    if out_dir.exists():
        shutil.rmtree(out_dir)

    return bundle_for_controller(out_dir, code, controller=controller, force=True)


def main() -> None:
    EXAMPLES_DIR.mkdir(parents=True, exist_ok=True)

    for controller in ("IRC5", "IRC5P"):
        out_dir = EXAMPLES_DIR / f"door_zigzag_{controller.lower()}"
        print(f"==> {controller}: {out_dir.relative_to(PROJECT_ROOT)}")
        files = build_one(out_dir, controller)
        for role, path in files.items():
            rel = path.relative_to(PROJECT_ROOT)
            print(f"    {role:8s} {str(rel):60s} {path.stat().st_size:5d} bytes")

    print("\n样例生成完毕。")


if __name__ == "__main__":
    main()
