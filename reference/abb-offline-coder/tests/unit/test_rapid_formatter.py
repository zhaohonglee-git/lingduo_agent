"""验证 formatter 格式化输出。"""
from __future__ import annotations

from abb_agent.rapid.formatter import format_code


def test_uppercase_block_keywords() -> None:
    code = "module Demo\nproc main()\nendproc\nendmodule\n"
    result = format_code(code)
    assert "MODULE" in result
    assert "PROC" in result
    assert "ENDPROC" in result
    assert "ENDMODULE" in result


def test_indentation_nested_blocks() -> None:
    code = """MODULE M
PROC main()
IF x>0 THEN
MoveJ p, v1, fine, t;
ENDIF
ENDPROC
ENDMODULE
"""
    result = format_code(code)
    lines = result.splitlines()
    # 'MoveJ' 应该至少有 12 个空格缩进 (MODULE -> PROC -> IF)
    movej_line = next(line for line in lines if "MoveJ" in line)
    assert movej_line.startswith("            ")


def test_fullwidth_punctuation_converted() -> None:
    code = "MODULE M\nPROC main（）\nENDPROC\nENDMODULE\n"
    result = format_code(code)
    assert "（" not in result
    assert "()" in result


def test_strings_keep_fullwidth() -> None:
    code = 'MODULE M\nPROC main()\nTPWrite "你好，世界";\nENDPROC\nENDMODULE\n'
    result = format_code(code)
    assert "你好，世界" in result  # 字符串内部不被修改


def test_consecutive_blank_lines_collapsed() -> None:
    code = "MODULE M\n\n\n\nPROC main()\nENDPROC\nENDMODULE\n"
    result = format_code(code)
    # 不应有连续 3 个空行
    assert "\n\n\n" not in result
