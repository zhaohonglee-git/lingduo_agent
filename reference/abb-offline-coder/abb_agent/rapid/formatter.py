"""RAPID 代码格式化。

LLM 输出常见问题：
- 缩进混乱（混合 tab 与空格）
- 关键字大小写不一
- 多余空行 / 缺少空行
- 中英文标点混用

此格式化器规则简单、可逆：
- MODULE/PROC 体内 4 空格缩进，嵌套块每层加 4 空格
- RAPID 关键字强制大写
- 移除连续空行（保留最多 1 个）
- 全角符号转半角（仅在字符串外）
"""
from __future__ import annotations

import re

from abb_agent.rapid.validator import BLOCK_PAIRS, OPEN_KEYWORDS

# 关键字大写映射表（不区分大小写匹配，替换为标准形式）
_KEYWORD_REPLACEMENTS = {
    "module": "MODULE", "endmodule": "ENDMODULE",
    "proc": "PROC", "endproc": "ENDPROC",
    "func": "FUNC", "endfunc": "ENDFUNC",
    "if": "IF", "then": "THEN", "else": "ELSE", "elseif": "ELSEIF", "endif": "ENDIF",
    "for": "FOR", "from": "FROM", "to": "TO", "step": "STEP", "do": "DO", "endfor": "ENDFOR",
    "while": "WHILE", "endwhile": "ENDWHILE",
    "test": "TEST", "case": "CASE", "default": "DEFAULT", "endtest": "ENDTEST",
    "var": "VAR", "pers": "PERS", "const": "CONST", "local": "LOCAL", "task": "TASK",
    "return": "RETURN", "raise": "RAISE", "goto": "GOTO",
}

# 全角到半角符号映射（不动中文字符）
_FULLWIDTH_PUNCT = {
    "，": ",", "。": ".", "；": ";", "：": ":",
    "（": "(", "）": ")", "【": "[", "】": "]",
    "！": "!", "？": "?",
}


def _normalize_punctuation_outside_strings(line: str) -> str:
    """只在字符串外做全角→半角转换。"""
    result: list[str] = []
    in_string = False
    for ch in line:
        if ch == '"':
            in_string = not in_string
            result.append(ch)
            continue
        if not in_string and ch in _FULLWIDTH_PUNCT:
            result.append(_FULLWIDTH_PUNCT[ch])
        else:
            result.append(ch)
    return "".join(result)


def _uppercase_keywords(line: str) -> str:
    """把 RAPID 关键字统一大写，但不动注释和字符串。"""
    # 拆出注释部分
    code_part, sep, comment = line.partition("!")

    # 简单方案：用正则按词替换，跳过被引号包围的部分
    parts: list[str] = []
    last_end = 0
    for m in re.finditer(r'"[^"]*"', code_part):
        # 处理引号前的非字符串部分
        before = code_part[last_end:m.start()]
        parts.append(_replace_keywords(before))
        # 引号内原样保留
        parts.append(m.group(0))
        last_end = m.end()
    # 尾部
    parts.append(_replace_keywords(code_part[last_end:]))
    return "".join(parts) + sep + comment


def _replace_keywords(text: str) -> str:
    """对非字符串文本做关键字大小写规范化。"""
    def _repl(match: re.Match[str]) -> str:
        word = match.group(0)
        return _KEYWORD_REPLACEMENTS.get(word.lower(), word)

    return re.sub(r"\b[A-Za-z]+\b", _repl, text)


def _calculate_indent(stack_depth: int) -> str:
    return "    " * max(stack_depth, 0)


def format_code(code: str, *, indent_size: int = 4) -> str:
    """格式化 RAPID 代码。

    Args:
        code: 原始 RAPID 源码
        indent_size: 每层缩进空格数（默认 4，符合 ABB 默认风格）

    Returns:
        格式化后的源码
    """
    raw_lines = code.replace("\t", " " * indent_size).splitlines()

    # 1) 关键字大小写 + 标点规范化
    normalized = [
        _normalize_punctuation_outside_strings(_uppercase_keywords(line))
        for line in raw_lines
    ]

    # 2) 重新缩进（按块栈深度）
    stack: list[str] = []
    formatted: list[str] = []
    indent = " " * indent_size

    for raw in normalized:
        stripped = raw.strip()
        if not stripped:
            formatted.append("")
            continue

        first_word_match = re.match(r"^([A-Z]+)\b", stripped)
        first_word = first_word_match.group(1) if first_word_match else ""

        # 关闭关键字 —— 先减栈再缩进
        is_close = first_word in BLOCK_PAIRS.values() or first_word in (
            "ELSE", "ELSEIF", "CASE", "DEFAULT",
        )
        if is_close:
            depth = max(len(stack) - 1, 0)
        else:
            depth = len(stack)
        prefix = indent * depth

        formatted.append(prefix + stripped)

        # 维护块栈
        if first_word in OPEN_KEYWORDS:
            stack.append(first_word)
        elif first_word in BLOCK_PAIRS.values():
            if stack:
                stack.pop()

    # 3) 去重连续空行
    cleaned: list[str] = []
    prev_blank = False
    for line in formatted:
        is_blank = not line.strip()
        if is_blank and prev_blank:
            continue
        cleaned.append(line)
        prev_blank = is_blank

    result = "\n".join(cleaned)
    if not result.endswith("\n"):
        result += "\n"
    return result
