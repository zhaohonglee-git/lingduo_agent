"""RAPID 模块模板生成器。

LLM 生成的代码经常缺少：
- MODULE/ENDMODULE 包裹
- 标准变量声明（tooldata、wobjdata、speeddata 等）
- 主入口过程 main()

本模块提供"骨架填充"能力：如果 LLM 输出缺失这些结构，自动补全。
所有函数都是纯函数（接受文本/数据，返回新文本），不修改输入。

controller 参数控制注入的默认变量风格：
  - "IRC5"  (默认)：用 num 表示工艺参数，兼容无 Paint 选项的控制器
  - "IRC5P"：注入 brushdata 原生类型，配合 PaintL/PaintC 走 ABB Paint 工艺
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from abb_agent.config import ControllerKind

DEFAULT_TOOL_DATA = (
    "PERS tooldata tSprayGun := [TRUE, "
    "[[0,0,200],[1,0,0,0]], "  # TCP 平移 200mm（喷枪长度），姿态默认
    "[2.5,[0,0,80],[1,0,0,0],0,0,0]];"  # 质量 2.5kg
)
DEFAULT_WOBJ_DATA = (
    "PERS wobjdata wobjPart := [FALSE, TRUE, \"\", "
    "[[0,0,0],[1,0,0,0]], "
    "[[0,0,0],[1,0,0,0]]];"
)
DEFAULT_SPEED_PAINT = "CONST speeddata vPaint := [200, 500, 5000, 1000];"
DEFAULT_BRUSH_DATA = (
    "PERS num nFlowRate := 80;          ! 流量百分比 0-100\n"
    "    PERS num nFanWidth := 300;       ! 扇幅宽度 mm\n"
    "    PERS num nAtomPressure := 50;    ! 雾化压力 kPa"
)
def _brushdata_decl_irc5p(name: str = "bdMain") -> str:
    """注入到模块顶部的 brushdata 默认声明，附 [WARNING] 字段顺序提醒。"""
    return (
        "! [WARNING] brushdata 字段顺序随 RobotWare Paint 版本不同 — \n"
        "    ! 上控制器前必须用 RobotStudio Brush Table 对照校核字段顺序！\n"
        "    ! 字段顺序: flow, fan, atom, preOpen, postClose, "
        "brushOnTime, accept_brush, name, brush_table_idx\n"
        f"    PERS brushdata {name} := [80, 300, 50, 50, 50, 0, FALSE, \"{name}\", 0];"
    )


DEFAULT_BRUSH_DATA_IRC5P = _brushdata_decl_irc5p("bdMain")

_PAINT_BRUSH_REF_RE = re.compile(
    # PaintL target, speed, brush, zone, tool[\WObj:=wobj];
    # PaintC pMid, pEnd, speed, brush, zone, tool[\WObj:=wobj];
    # brush 总是位于 PaintL 第 3 参数、PaintC 第 4 参数
    r"\bPaint(L|C)\s+([^;]+);",
    re.IGNORECASE,
)
_BRUSHDATA_DECL_RE = re.compile(r"\bbrushdata\s+([A-Za-z_][A-Za-z0-9_]*)")


def _split_top_level_args(arg_str: str) -> list[str]:
    """按顶层逗号切分。忽略 [] () 内部的逗号。

    用于解析 PaintL/PaintC 参数列表 — inline robtarget [[x,y,z],[q1,q2,q3,q4],...]
    含大量内部逗号，必须感知括号深度。
    """
    parts: list[str] = []
    depth = 0
    buf: list[str] = []
    for ch in arg_str:
        if ch in "[(":
            depth += 1
            buf.append(ch)
        elif ch in "])":
            depth -= 1
            buf.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def _find_referenced_brushes(code: str) -> list[str]:
    """扫描代码中 PaintL/PaintC 引用的所有 brush 名（按 RAPID 调用位置约定）。"""
    refs: list[str] = []
    for m in _PAINT_BRUSH_REF_RE.finditer(code):
        instr = m.group(1).upper()
        body = m.group(2)
        # 剥离 \WObj:=... 这种 switch 参数（不参与位置计数）
        body = re.sub(r"\\[A-Za-z]+\s*:=\s*[^,;\s]+", "", body)
        args = _split_top_level_args(body)
        brush_idx = 2 if instr == "L" else 3  # PaintL 第 3 参数；PaintC 第 4
        if len(args) > brush_idx:
            tok = args[brush_idx]
            if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", tok):
                refs.append(tok)
    # 去重保序
    seen: set[str] = set()
    return [r for r in refs if not (r in seen or seen.add(r))]
DEFAULT_IO_SIGNALS = (
    "! 喷枪 IO 信号（需在 RobotStudio I/O 配置中映射）\n"
    "    ! VAR signaldo doSprayOn;\n"
    "    ! VAR signaldo doFanOn;\n"
    "    ! VAR signaldo doAtomOn;"
)


@dataclass(frozen=True)
class ModuleSkeleton:
    """RAPID 模块骨架配置。"""

    name: str = "MainModule"
    procedures: tuple[str, ...] = ()
    variables: tuple[str, ...] = ()
    routines: tuple[str, ...] = ()
    description: str = ""

    def render(self) -> str:
        """渲染为完整 .mod 字符串。"""
        header = f"MODULE {self.name}"
        if self.description:
            header += f"\n    ! {self.description}"

        var_section = "\n    ".join(self.variables) if self.variables else ""
        proc_section = "\n\n    ".join(self.procedures) if self.procedures else ""
        routines_section = "\n\n    ".join(self.routines) if self.routines else ""

        parts = [header]
        if var_section:
            parts.append("\n    " + var_section)
        if proc_section:
            parts.append("\n    " + proc_section)
        if routines_section:
            parts.append("\n    " + routines_section)
        parts.append("\nENDMODULE\n")
        return "\n".join(parts)


def _has_module_wrapper(code: str) -> bool:
    return bool(re.search(r"^\s*MODULE\b", code, re.MULTILINE))


def _has_main_proc(code: str) -> bool:
    return bool(re.search(r"\bPROC\s+main\s*\(", code, re.IGNORECASE))


# 共享的 MODULE 名提取正则，供 system_bundle.py 等模块复用。
# 注：RAPID 标识符必须以字母或下划线开头，[A-Za-z_] 前缀涵盖两种合法情形。
MODULE_NAME_RE = re.compile(
    r"^\s*MODULE\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE
)


def _extract_module_name(code: str) -> str | None:
    m = MODULE_NAME_RE.search(code)
    return m.group(1) if m else None


def extract_module_name(code: str, default: str = "PaintProgram") -> str:
    """从 RAPID 代码提取 MODULE 名；未找到时返回 default。

    供外部模块复用（system_bundle、agent 后处理等），避免各处复制正则。
    """
    name = _extract_module_name(code)
    return name if name else default


def wrap_in_module(
    code: str,
    *,
    module_name: str = "PaintProgram",
    description: str = "由 abb-agent 自动生成的喷涂程序",
    inject_defaults: bool = True,
    controller: ControllerKind = "IRC5",
) -> str:
    """若 LLM 输出缺少 MODULE，自动包裹。

    Args:
        code: 原始 LLM 输出
        module_name: 包裹模块名
        description: 模块顶部注释
        inject_defaults: 若主体没有声明 tool/wobj/speed/brush，是否注入默认值
        controller: 控制器类型；IRC5P 会注入 brushdata 而非 num
    """
    if _has_module_wrapper(code):
        return code

    has_tool = bool(re.search(r"\btooldata\b", code, re.IGNORECASE))
    has_wobj = bool(re.search(r"\bwobjdata\b", code, re.IGNORECASE))
    has_speed = bool(re.search(r"\bspeeddata\b", code, re.IGNORECASE))
    existing_brushes = set(_BRUSHDATA_DECL_RE.findall(code))

    declarations: list[str] = []
    if inject_defaults:
        if not has_tool:
            declarations.append(DEFAULT_TOOL_DATA)
        if not has_wobj:
            declarations.append(DEFAULT_WOBJ_DATA)
        if not has_speed:
            declarations.append(DEFAULT_SPEED_PAINT)
        if controller == "IRC5P":
            # 扫描代码引用的所有 brush 名字，未声明的全部注入
            referenced = _find_referenced_brushes(code)
            to_inject = [b for b in referenced if b not in existing_brushes]
            if not to_inject and not existing_brushes:
                # 没引用也没声明 → 兜底注入默认 bdMain
                to_inject = ["bdMain"]
            for brush_name in to_inject:
                declarations.append(_brushdata_decl_irc5p(brush_name))

    # 缩进 LLM 主体代码
    indented_body = "\n".join("    " + ln if ln else "" for ln in code.splitlines())

    decl_block = ("\n    " + "\n    ".join(declarations) + "\n") if declarations else ""
    return (
        f"MODULE {module_name}\n"
        f"    ! {description}\n"
        f"{decl_block}\n"
        f"{indented_body}\n"
        f"ENDMODULE\n"
    )


def ensure_main_proc(code: str, inner_calls: list[str] | None = None) -> str:
    """若没有 PROC main()，把所有未包裹在 PROC 内的指令收拢到 main 里。"""
    if _has_main_proc(code):
        return code
    if not inner_calls:
        return code

    main_proc = "PROC main()\n        " + "\n        ".join(inner_calls) + "\n    ENDPROC"
    # 插在 ENDMODULE 之前
    return re.sub(
        r"^\s*ENDMODULE",
        f"    {main_proc}\nENDMODULE",
        code,
        count=1,
        flags=re.MULTILINE,
    ) if _has_module_wrapper(code) else code + "\n" + main_proc + "\n"


def empty_painting_skeleton(*, controller: ControllerKind = "IRC5") -> ModuleSkeleton:
    """返回一个标准喷涂程序骨架。

    controller="IRC5P" 时，工艺参数声明使用 brushdata 类型，
    并在 main() 中以 PaintL TODO 替换 SetDO 注释，引导用户用 ABB Paint 工艺。
    """
    if controller == "IRC5P":
        brush_decl = DEFAULT_BRUSH_DATA_IRC5P
        todo = (
            "        ! TODO: 调用 PaintL/PaintC 走 ABB Paint 工艺，引用 bdMain"
        )
    else:
        brush_decl = DEFAULT_BRUSH_DATA
        todo = "        ! TODO: 调用扫描程序"

    return ModuleSkeleton(
        name="PaintProgram",
        description=f"ABB 喷涂机器人 RAPID 程序模板 ({controller})",
        variables=(
            DEFAULT_TOOL_DATA,
            DEFAULT_WOBJ_DATA,
            DEFAULT_SPEED_PAINT,
            brush_decl,
            DEFAULT_IO_SIGNALS,
        ),
        procedures=(
            "PROC main()\n"
            "        ! 主入口 - 调用具体喷涂路径\n"
            "        ConfL\\Off;\n"
            "        SingArea\\Wrist;\n"
            f"{todo}\n"
            "    ENDPROC",
        ),
    )
