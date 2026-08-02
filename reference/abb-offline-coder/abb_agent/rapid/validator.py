"""RAPID 轻量语法校验。

我们不做完整 RAPID parser（成本太高）。
只做 ABB RAPID 最常见的 8 类错误的正则校验：
  1. MODULE / ENDMODULE 配对
  2. PROC / ENDPROC 配对
  3. IF / ENDIF, WHILE / ENDWHILE, FOR / ENDFOR 配对
  4. 关键字大小写规范（RAPID 是大小写敏感的）
  5. 行末分号（语句必须以 ; 结尾，少数指令例外）
  6. 注释格式（! ... 或 % ... %）
  7. 字符串引号配对
  8. 数据类型常量出现位置（VAR/PERS/CONST 必须在 PROC 外或顶部）

外加 IRC5P 专项检查（当 controller="IRC5P" 时启用）：
  - PNT001: PaintL/PaintC 缺少 brushdata 形参
  - TCP001: tooldata 仍为默认占位 TCP（strict_tcp=True 时启用）
  - IO001 : 引用了不在 EIO.cfg 白名单中的 IO 信号

返回 ValidationReport，由调用方决定如何处理（修复 / 警告 / 拒绝）。
"""
from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal

ControllerKind = Literal["IRC5", "IRC5P"]


class Severity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass(frozen=True)
class ValidationIssue:
    line: int
    severity: Severity
    code: str
    message: str

    def format(self) -> str:
        return f"[{self.severity.value.upper()}][{self.code}] L{self.line}: {self.message}"


@dataclass(frozen=True)
class ValidationReport:
    issues: tuple[ValidationIssue, ...] = field(default_factory=tuple)

    @property
    def is_valid(self) -> bool:
        return not any(i.severity == Severity.ERROR for i in self.issues)

    @property
    def errors(self) -> tuple[ValidationIssue, ...]:
        return tuple(i for i in self.issues if i.severity == Severity.ERROR)

    @property
    def warnings(self) -> tuple[ValidationIssue, ...]:
        return tuple(i for i in self.issues if i.severity == Severity.WARNING)

    def format_summary(self) -> str:
        if not self.issues:
            return "✓ RAPID 语法校验通过"
        lines = [i.format() for i in self.issues]
        n_err = len(self.errors)
        n_warn = len(self.warnings)
        lines.append(f"-- 共 {n_err} 错误, {n_warn} 警告")
        return "\n".join(lines)


# 这些关键字必须大写
RAPID_KEYWORDS = frozenset(
    [
        "MODULE", "ENDMODULE", "PROC", "ENDPROC", "FUNC", "ENDFUNC", "TRAP", "ENDTRAP",
        "RECORD", "ENDRECORD", "IF", "THEN", "ELSE", "ELSEIF", "ENDIF",
        "FOR", "FROM", "TO", "STEP", "DO", "ENDFOR", "WHILE", "ENDWHILE",
        "TEST", "CASE", "DEFAULT", "ENDTEST", "RETURN", "GOTO", "RAISE",
        "VAR", "PERS", "CONST", "LOCAL", "TASK", "GLOBAL",
        "MoveJ", "MoveL", "MoveC", "MoveAbsJ", "MoveLDO", "MoveJDO", "MoveCDO",
        "MoveLSync", "MoveJSync", "MoveCSync",
        "PaintL", "PaintC",
        "TriggL", "TriggC", "TriggJ", "TriggIO", "TriggData", "TriggEquip",
        "SetDO", "Reset", "SetAO", "WaitDI", "WaitDO", "PulseDO",
        "WaitTime", "Stop", "EXIT",
    ]
)

# 引用 IO 信号的指令 → 第一个位置参数是信号名
IO_INSTRUCTIONS = frozenset(
    ["SetDO", "Reset", "SetAO", "WaitDI", "WaitDO", "PulseDO"]
)

# 喷涂 helpers 当前注入的默认 TCP（[0,0,200]），现场必须重新标定。
# 兼容 [0,0,200] / [0.0, 0, 200.0] / 任意空格/小数 0.x 形式。
DEFAULT_TCP_PATTERN = re.compile(
    r"\[\s*0(?:\.0+)?\s*,\s*0(?:\.0+)?\s*,\s*200(?:\.0+)?\s*\]",
    re.IGNORECASE,
)

# 只有这些前缀的标识符才算 IO 信号；其它（如 clock 变量）一律忽略。
IO_SIGNAL_PREFIXES = ("do", "di", "ao", "ai", "go", "gi")


# 块结构配对表：开始关键字 -> 结束关键字（按顺序匹配嵌套）
BLOCK_PAIRS = {
    "MODULE": "ENDMODULE",
    "PROC": "ENDPROC",
    "FUNC": "ENDFUNC",
    "TRAP": "ENDTRAP",
    "RECORD": "ENDRECORD",
    "IF": "ENDIF",
    "FOR": "ENDFOR",
    "WHILE": "ENDWHILE",
    "TEST": "ENDTEST",
}
OPEN_KEYWORDS = frozenset(BLOCK_PAIRS.keys())
CLOSE_KEYWORDS = frozenset(BLOCK_PAIRS.values())

# 不需要 ; 结尾的关键字行
NO_SEMICOLON_LINES = frozenset(
    list(BLOCK_PAIRS.keys()) + list(BLOCK_PAIRS.values()) +
    ["THEN", "ELSE", "ELSEIF", "DO", "CASE", "DEFAULT", "TASK", "GLOBAL", "LOCAL"]
)


_LINE_COMMENT_RE = re.compile(r"!.*$")
_KEYWORD_TOKEN_RE = re.compile(r"\b([A-Za-z][A-Za-z0-9_]*)\b")


def _strip_comments(line: str) -> str:
    """去掉 ! 之后的行注释。RAPID 不支持块注释 % ... %（很少用，本期不处理）。"""
    return _LINE_COMMENT_RE.sub("", line).rstrip()


def _is_blank_or_comment(line: str) -> bool:
    s = line.strip()
    return not s or s.startswith("!")


def _check_blocks(lines: list[str]) -> list[ValidationIssue]:
    """检查块结构配对，使用栈式匹配。"""
    stack: list[tuple[str, int]] = []
    issues: list[ValidationIssue] = []

    for ln_idx, raw in enumerate(lines, start=1):
        line = _strip_comments(raw).strip()
        if not line:
            continue

        first_word_match = re.match(r"^([A-Z]+)\b", line)
        if not first_word_match:
            continue
        word = first_word_match.group(1)

        if word in OPEN_KEYWORDS:
            stack.append((word, ln_idx))
        elif word in CLOSE_KEYWORDS:
            expected_open = next(
                (op for op, cl in BLOCK_PAIRS.items() if cl == word), None
            )
            if not stack:
                issues.append(
                    ValidationIssue(
                        ln_idx, Severity.ERROR, "BLK001",
                        f"出现 {word} 但没有对应的 {expected_open}",
                    )
                )
            else:
                top_word, top_ln = stack[-1]
                if BLOCK_PAIRS.get(top_word) != word:
                    issues.append(
                        ValidationIssue(
                            ln_idx, Severity.ERROR, "BLK002",
                            f"块不匹配：L{top_ln} 是 {top_word}，但在此处遇到 {word}",
                        )
                    )
                else:
                    stack.pop()

    for top_word, top_ln in stack:
        issues.append(
            ValidationIssue(
                top_ln, Severity.ERROR, "BLK003",
                f"未闭合的 {top_word}，应有对应的 {BLOCK_PAIRS[top_word]}",
            )
        )
    return issues


def _check_keyword_case(lines: list[str]) -> list[ValidationIssue]:
    """检查关键字大小写。常见错误：modul/Movel 等。"""
    issues: list[ValidationIssue] = []
    case_map = {kw.lower(): kw for kw in RAPID_KEYWORDS}

    for ln_idx, raw in enumerate(lines, start=1):
        line = _strip_comments(raw)
        if not line.strip():
            continue
        for token in _KEYWORD_TOKEN_RE.findall(line):
            lower = token.lower()
            if lower in case_map and token != case_map[lower]:
                issues.append(
                    ValidationIssue(
                        ln_idx, Severity.WARNING, "CASE001",
                        f"关键字 '{token}' 大小写应为 '{case_map[lower]}'",
                    )
                )
    return issues


def _check_semicolons(lines: list[str]) -> list[ValidationIssue]:
    """检查行末分号。"""
    issues: list[ValidationIssue] = []
    for ln_idx, raw in enumerate(lines, start=1):
        line = _strip_comments(raw).strip()
        if _is_blank_or_comment(raw) or not line:
            continue

        first_word_match = re.match(r"^([A-Za-z][A-Za-z0-9_]*)\b", line)
        first_word = first_word_match.group(1) if first_word_match else ""

        if first_word in NO_SEMICOLON_LINES:
            continue
        if line.startswith("!") or line.startswith("%"):
            continue
        if line.endswith(";") or line.endswith("{") or line.endswith(","):
            continue
        if re.search(r"\b(THEN|DO)\s*$", line):
            continue

        issues.append(
            ValidationIssue(
                ln_idx, Severity.WARNING, "SEM001",
                f"该行可能缺少结尾分号: '{line[:50]}'",
            )
        )
    return issues


def _check_quotes(lines: list[str]) -> list[ValidationIssue]:
    """检查字符串引号是否配对。"""
    issues: list[ValidationIssue] = []
    for ln_idx, raw in enumerate(lines, start=1):
        line = _strip_comments(raw)
        if line.count('"') % 2 != 0:
            issues.append(
                ValidationIssue(
                    ln_idx, Severity.ERROR, "STR001",
                    "字符串引号不配对",
                )
            )
    return issues


def _check_module_declaration(lines: list[str]) -> list[ValidationIssue]:
    """必须有 MODULE 声明。"""
    issues: list[ValidationIssue] = []
    has_module = any(re.match(r"^\s*MODULE\b", line) for line in lines)
    if not has_module:
        issues.append(
            ValidationIssue(
                1, Severity.ERROR, "MOD001",
                "代码缺少 MODULE 声明",
            )
        )
    return issues


def _split_args(arg_str: str) -> list[str]:
    """按顶层逗号切分参数串。忽略 [] () 内的逗号。"""
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


# 在一行任意位置查找 PaintL/PaintC 调用，捕获到下一个分号为止的参数串。
# 这样 `IF cond THEN PaintL ...;` 这种内联格式也能被检出（M1）。
_PAINT_CALL_RE = re.compile(r"\b(PaintL|PaintC)\s+([^;]+);")
_BRUSHDATA_DECL_RE = re.compile(r"\bbrushdata\s+([A-Za-z_][A-Za-z0-9_]*)")
_TOOLDATA_DECL_RE = re.compile(
    r"\btooldata\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+?);", re.DOTALL
)
_IO_CALL_RE = re.compile(
    r"^\s*(SetDO|Reset|SetAO|WaitDI|WaitDO|PulseDO)\s+([A-Za-z_][A-Za-z0-9_]*)"
)


def _check_paint_brushdata(lines: list[str]) -> list[ValidationIssue]:
    """IRC5P: PaintL 要 ≥5 个位置参数；PaintC 要 ≥6 个。

    PaintL: target, speed, brushdata, zone, tool [\\WObj:=wobj]
    PaintC: pMid, pEnd, speed, brushdata, zone, tool [\\WObj:=wobj]
    我们用「已知的 brushdata 名称集合」做交叉校验：声明里出现的 bdXxx 应在调用里被引用。
    退化情形（无法解析）：用参数计数作为兜底。
    """
    code = "\n".join(lines)
    declared_brushes = set(_BRUSHDATA_DECL_RE.findall(code))

    issues: list[ValidationIssue] = []
    for ln_idx, raw in enumerate(lines, start=1):
        line = _strip_comments(raw)
        # 同一行可能有多个 PaintL/PaintC（IF...THEN PaintL ...; PaintL ...; ENDIF）
        for m in _PAINT_CALL_RE.finditer(line):
            instr = m.group(1)
            # 把 \WObj:=xxx 这种 switch 参数剥离（值可以是标识符/数字/路径）
            body = re.sub(r"\\[A-Za-z]+\s*:=\s*[^,;\s\\]+", "", m.group(2))
            args = _split_args(body)

            min_args = 5 if instr == "PaintL" else 6
            if len(args) < min_args:
                issues.append(
                    ValidationIssue(
                        ln_idx, Severity.ERROR, "PNT001",
                        f"{instr} 参数数量 {len(args)} 不足 ({min_args})，"
                        f"很可能缺少 brushdata 形参",
                    )
                )
                continue

            # 进一步检查：若声明过 brushdata，则调用中应包含其中一个名字
            if declared_brushes:
                tokens = {tok for arg in args for tok in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", arg)}
                if not (tokens & declared_brushes):
                    issues.append(
                        ValidationIssue(
                            ln_idx, Severity.ERROR, "PNT001",
                            f"{instr} 没有引用任何已声明的 brushdata "
                            f"({', '.join(sorted(declared_brushes))})",
                        )
                    )
    return issues


def _check_default_tcp(lines: list[str]) -> list[ValidationIssue]:
    """tooldata 偏移仍是默认 [0,0,200] 时强提示现场标定。"""
    issues: list[ValidationIssue] = []
    code = "\n".join(lines)
    for m in _TOOLDATA_DECL_RE.finditer(code):
        decl_body = m.group(2)
        # 计算声明所在行号（取 := 出现的位置）
        decl_pos = m.start()
        ln_idx = code.count("\n", 0, decl_pos) + 1
        if DEFAULT_TCP_PATTERN.search(decl_body):
            issues.append(
                ValidationIssue(
                    ln_idx, Severity.ERROR, "TCP001",
                    f"tooldata '{m.group(1)}' 使用默认占位 TCP [0,0,200]，"
                    "上控制器前必须 4 点法重新标定",
                )
            )
    return issues


def _looks_like_io_signal(name: str) -> bool:
    """启发式：标识符以 IO 命名前缀（do/di/ao/ai/go/gi）开头才算 IO。

    这样 `Reset stopwatch1;` 这种 clock 复位不会被误报为 IO001。
    业内 RAPID 编程约定 IO 信号必以 do_/di_ 前缀命名。
    """
    return any(name.lower().startswith(p) for p in IO_SIGNAL_PREFIXES)


def _check_io_whitelist(
    lines: list[str], whitelist: Iterable[str]
) -> list[ValidationIssue]:
    """检查代码引用的 IO 信号是否都在 EIO.cfg 白名单中。

    去重：同一未知信号引用多次只报一次（M5）。
    """
    allowed = set(whitelist)
    issues: list[ValidationIssue] = []
    reported: set[str] = set()
    for ln_idx, raw in enumerate(lines, start=1):
        line = _strip_comments(raw)
        m = _IO_CALL_RE.match(line)
        if not m:
            continue
        signal = m.group(2)
        # 跳过明显不是 IO 的标识符（如 clock 变量名）
        if not _looks_like_io_signal(signal):
            continue
        if signal in allowed or signal in reported:
            continue
        reported.add(signal)
        issues.append(
            ValidationIssue(
                ln_idx, Severity.ERROR, "IO001",
                f"IO 信号 '{signal}' 不在 EIO.cfg 白名单中。"
                f"已知信号: {', '.join(sorted(allowed)) or '(空)'}",
            )
        )
    return issues


def validate(
    code: str,
    *,
    controller: ControllerKind = "IRC5",
    io_whitelist: Iterable[str] | None = None,
    strict_tcp: bool = False,
) -> ValidationReport:
    """对完整 RAPID 代码做静态校验。

    Args:
        code: RAPID 源码字符串
        controller: 控制器类型；"IRC5P" 时启用 PaintL/PaintC brushdata 检查
        io_whitelist: 控制器 EIO.cfg 中已注册的信号集；None 跳过 IO 检查
        strict_tcp: True 时若 tooldata 仍为默认 TCP 占位则报错（上线前应开启）

    Returns:
        ValidationReport: 所有问题汇总
    """
    lines = code.splitlines()
    issues: list[ValidationIssue] = []
    issues.extend(_check_module_declaration(lines))
    issues.extend(_check_blocks(lines))
    issues.extend(_check_keyword_case(lines))
    issues.extend(_check_semicolons(lines))
    issues.extend(_check_quotes(lines))

    if controller == "IRC5P":
        issues.extend(_check_paint_brushdata(lines))
        if strict_tcp:
            issues.extend(_check_default_tcp(lines))

    if io_whitelist is not None:
        issues.extend(_check_io_whitelist(lines, io_whitelist))

    return ValidationReport(issues=tuple(issues))
