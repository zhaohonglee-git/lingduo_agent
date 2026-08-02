"""Prompt 模板加载与渲染。

system.md / painting_few_shot.md / system_irc5p.md 用 importlib.resources
打包进 wheel，保证发布后仍能加载。
"""
from __future__ import annotations

from functools import lru_cache
from importlib import resources

from abb_agent.config import ControllerKind
from abb_agent.rag.context_builder import BuiltContext
from abb_agent.rag.query_rewriter import RewrittenQuery


@lru_cache(maxsize=1)
def _load_system_prompt() -> str:
    # encoding="utf-8" 显式声明，避免 Windows 默认 cp1252/cp936 解码中文 prompt 报错
    return resources.files("abb_agent.llm.prompts").joinpath("system.md").read_text(
        encoding="utf-8"
    )


@lru_cache(maxsize=1)
def _load_few_shot() -> str:
    return resources.files("abb_agent.llm.prompts").joinpath("painting_few_shot.md").read_text(
        encoding="utf-8"
    )


@lru_cache(maxsize=1)
def _load_irc5p_addendum() -> str:
    return resources.files("abb_agent.llm.prompts").joinpath("system_irc5p.md").read_text(
        encoding="utf-8"
    )


def clear_prompt_cache() -> None:
    """清除 LRU 缓存。仅供测试使用，确保模板修改在测试间生效。"""
    _load_system_prompt.cache_clear()
    _load_few_shot.cache_clear()
    _load_irc5p_addendum.cache_clear()


def _compose_system(controller: ControllerKind) -> str:
    base = _load_system_prompt()
    if controller == "IRC5P":
        return base + "\n\n---\n\n" + _load_irc5p_addendum()
    return base


def build_full_prompt(
    user_query: RewrittenQuery,
    context: BuiltContext,
    *,
    include_few_shot: bool = True,
    controller: ControllerKind = "IRC5",
) -> tuple[str, str]:
    """返回 (system_prompt, user_prompt)。

    controller="IRC5P" 时会在 system prompt 末尾追加 PaintL/brushdata 专项约束，
    并在用户提示里标注当前控制器类型，避免 LLM 输出错误工艺指令。
    """
    sys_p = _compose_system(controller)
    if include_few_shot:
        sys_p = sys_p + "\n\n## 喷涂典型示例 (Few-Shot)\n\n" + _load_few_shot()

    user_prompt_parts: list[str] = []
    user_prompt_parts.append("## 用户需求")
    user_prompt_parts.append(user_query.original)
    user_prompt_parts.append("")
    user_prompt_parts.append(f"## 识别的任务类别\n{user_query.category.value}")
    user_prompt_parts.append(f"\n## 目标控制器\n{controller}")

    if context.text:
        user_prompt_parts.append("\n## 检索到的相关资料")
        user_prompt_parts.append(context.text)

    user_prompt_parts.append("\n## 你的任务")
    user_prompt_parts.append(
        "请生成完整 RAPID 模块代码。先用 ```rapid ... ``` 输出代码块，"
        "再用 2-3 句中文说明设计思路与关键参数。"
    )

    return sys_p, "\n".join(user_prompt_parts)


def system_prompt(controller: ControllerKind = "IRC5") -> str:
    """对外暴露 system prompt（用于多轮对话）。"""
    return _compose_system(controller)


def few_shot_prompt() -> str:
    return _load_few_shot()
