"""验证 Agent 模块的代码块提取与后处理（无需 Ollama）。"""
from __future__ import annotations

from abb_agent.agent import _extract_code_block, _postprocess


def test_extract_code_block_from_response() -> None:
    raw = """这是一段说明。

```rapid
MODULE Demo
    PROC main()
        MoveJ p1, v1000, fine, tool0;
    ENDPROC
ENDMODULE
```

更多说明在后面。
"""
    code, expl = _extract_code_block(raw)
    assert "MODULE Demo" in code
    assert "这是一段说明" in expl


def test_extract_code_block_no_fence_returns_raw() -> None:
    raw = "MODULE M\nPROC main() ENDPROC\nENDMODULE"
    code, expl = _extract_code_block(raw)
    assert code == ""
    assert "MODULE M" in expl


def test_postprocess_wraps_loose_code() -> None:
    raw = "PROC main()\n    MoveJ p1, v1000, fine, tool0;\nENDPROC"
    final, report = _postprocess(raw)
    assert "MODULE" in final
    assert "ENDMODULE" in final


def test_postprocess_returns_report() -> None:
    raw = "PROC main()\n    MoveJ p1, v1000, fine, tool0;\nENDPROC"
    _, report = _postprocess(raw)
    # 至少结构应是合法的（MOD001 不应再出现，因 wrap 已注入）
    assert not any(i.code == "MOD001" for i in report.errors)
