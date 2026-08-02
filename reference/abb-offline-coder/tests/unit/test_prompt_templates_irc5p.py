"""Prompt 模板的 controller 感知行为。

system_prompt 应当在 IRC5P 模式下追加专门段落，引导 LLM 使用
PaintL/PaintC + brushdata，而不是 MoveL + SetDO。
"""
from __future__ import annotations

from abb_agent.llm.prompts.templates import (
    build_full_prompt,
    clear_prompt_cache,
    system_prompt,
)
from abb_agent.rag.context_builder import BuiltContext
from abb_agent.rag.query_rewriter import rewrite


def setup_function() -> None:
    """避免不同测试间 lru_cache 串味。"""
    clear_prompt_cache()


# ---------------- system_prompt(controller=...) ----------------

def test_system_prompt_default_no_irc5p_section() -> None:
    text = system_prompt()
    assert "PaintL" not in text or "IRC5P" not in text


def test_system_prompt_irc5p_mentions_paintl_and_brushdata() -> None:
    text = system_prompt(controller="IRC5P")
    assert "PaintL" in text
    assert "brushdata" in text
    assert "IRC5P" in text


def test_system_prompt_irc5p_warns_against_setdo() -> None:
    """IRC5P 模式应明确告诉模型不要用 SetDO 切喷涂。"""
    text = system_prompt(controller="IRC5P")
    # 包含某种 "不要 SetDO" 的语义提示
    assert any(kw in text for kw in ["SetDO", "禁止"]), text


# ---------------- build_full_prompt(controller=...) ----------------

def _dummy_context() -> BuiltContext:
    return BuiltContext(text="", chars_used=0, sources_used=())


def test_build_full_prompt_default_no_irc5p_addendum() -> None:
    rewritten = rewrite("画一个直线喷涂")
    sys_p, _ = build_full_prompt(rewritten, _dummy_context())
    assert "PaintL" not in sys_p or "IRC5P" not in sys_p


def test_build_full_prompt_irc5p_includes_addendum() -> None:
    rewritten = rewrite("画一个直线喷涂")
    sys_p, _ = build_full_prompt(rewritten, _dummy_context(), controller="IRC5P")
    assert "PaintL" in sys_p
    assert "IRC5P" in sys_p


def test_build_full_prompt_irc5p_few_shot_still_works() -> None:
    """include_few_shot + controller 互不影响。"""
    rewritten = rewrite("画一个直线喷涂")
    sys_p, _ = build_full_prompt(
        rewritten, _dummy_context(), controller="IRC5P", include_few_shot=True
    )
    assert "Few-Shot" in sys_p or "示例" in sys_p
    assert "PaintL" in sys_p
