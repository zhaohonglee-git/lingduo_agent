"""Agent Orchestrator - 串联 RAG + LLM + RAPID 后处理。

公开 API:
- generate_code(user_query): 单次生成 RAPID 代码
- chat(messages): 多轮对话（保留上下文）

设计：函数式风格 - 输入到输出的纯流水线，便于测试和复用。
对外暴露的 dataclass 全部 frozen，确保不可变。
"""
from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from loguru import logger

from abb_agent.config import ControllerKind, get_config
from abb_agent.llm.ollama_client import ChatMessage, OllamaClient
from abb_agent.llm.prompts.templates import build_full_prompt, system_prompt
from abb_agent.rag.context_builder import BuiltContext, ContextBuilder
from abb_agent.rag.query_rewriter import RewrittenQuery, rewrite
from abb_agent.rag.retriever import HybridRetriever
from abb_agent.rag.vector_store import VectorStore
from abb_agent.rapid.formatter import format_code
from abb_agent.rapid.module_template import wrap_in_module
from abb_agent.rapid.validator import ValidationReport, validate

_CODE_BLOCK_RE = re.compile(r"```(?:rapid|RAPID)?\s*\n(.*?)```", re.DOTALL)


@dataclass(frozen=True)
class GenerateResult:
    """一次代码生成的结果。"""

    code: str
    explanation: str
    rewritten_query: RewrittenQuery
    context: BuiltContext
    validation: ValidationReport
    model_used: str
    duration_ms: int = 0
    raw_response: str = ""

    def is_valid(self) -> bool:
        return self.validation.is_valid


@dataclass
class ChatSession:
    """多轮对话的会话状态。"""

    messages: list[ChatMessage] = field(default_factory=list)
    last_code: str = ""

    def add(self, role: str, content: str) -> None:
        self.messages.append(ChatMessage(role=role, content=content))

    def reset(self) -> None:
        self.messages.clear()
        self.last_code = ""


def _extract_code_block(text: str) -> tuple[str, str]:
    """从 LLM 输出中拆出 (code, remaining_explanation)。"""
    matches = list(_CODE_BLOCK_RE.finditer(text))
    if not matches:
        return "", text.strip()
    first = matches[0]
    code = first.group(1).strip()
    explanation = (text[: first.start()] + text[first.end():]).strip()
    return code, explanation


def _postprocess(
    raw_code: str,
    *,
    controller: ControllerKind = "IRC5",
    io_whitelist: Iterable[str] | None = None,
    strict_tcp: bool = False,
) -> tuple[str, ValidationReport]:
    """对 LLM 输出做：包模块 → 格式化 → 校验。

    controller / io_whitelist / strict_tcp 透传给 wrap_in_module 与 validate，
    决定 IRC5P 专项检查是否启用。
    """
    code = raw_code
    if not re.search(r"^\s*MODULE\b", code, re.MULTILINE):
        code = wrap_in_module(code, module_name="PaintProgram", controller=controller)
    code = format_code(code)
    report = validate(
        code,
        controller=controller,
        io_whitelist=io_whitelist,
        strict_tcp=strict_tcp,
    )
    return code, report


class Agent:
    """整体编排器。"""

    def __init__(
        self,
        *,
        llm_client: OllamaClient | None = None,
        retriever: HybridRetriever | None = None,
        context_builder: ContextBuilder | None = None,
    ) -> None:
        self._llm = llm_client or OllamaClient()
        self._retriever = retriever or HybridRetriever()
        self._context_builder = context_builder or ContextBuilder()
        self._config = get_config()

    def generate_code(
        self,
        user_query: str,
        *,
        save_to: Path | None = None,
        include_few_shot: bool = True,
        controller: ControllerKind | None = None,
        strict_tcp: bool | None = None,
    ) -> GenerateResult:
        """主入口：从中文需求生成 RAPID 代码。

        controller / strict_tcp 不传时从 self._config.rapid 取默认值。
        io_whitelist 永远从 config.rapid.io_whitelist 取（避免 CLI 处暴露过多）。
        """
        start = datetime.now()

        rapid_cfg = self._config.rapid
        eff_controller = controller or rapid_cfg.controller
        eff_strict_tcp = rapid_cfg.controller == "IRC5P" if strict_tcp is None else strict_tcp

        rewritten = rewrite(user_query)
        logger.debug("查询改写: 类别={}, 关键词={}", rewritten.category, rewritten.extracted_keywords)

        retrieval_results = self._retriever.retrieve(rewritten.for_retrieval())
        context = self._context_builder.build(retrieval_results)
        logger.debug("检索到 {} 条，使用上下文 {} 字符", len(retrieval_results), context.chars_used)

        sys_p, user_p = build_full_prompt(
            rewritten, context,
            include_few_shot=include_few_shot,
            controller=eff_controller,
        )
        gen_result = self._llm.generate(user_p, system=sys_p)
        # 确认是同步返回（不是流式 Iterator）
        from abb_agent.llm.ollama_client import GenerationResult as GR
        assert isinstance(gen_result, GR)

        raw = gen_result.text
        code, explanation = _extract_code_block(raw)
        if not code:
            code = raw
            explanation = ""

        final_code, report = _postprocess(
            code,
            controller=eff_controller,
            io_whitelist=rapid_cfg.io_whitelist,
            strict_tcp=eff_strict_tcp,
        )
        duration = int((datetime.now() - start).total_seconds() * 1000)

        if save_to:
            save_to.parent.mkdir(parents=True, exist_ok=True)
            save_to.write_text(final_code, encoding="utf-8")
            logger.info("代码已写入 {}", save_to)

        return GenerateResult(
            code=final_code,
            explanation=explanation,
            rewritten_query=rewritten,
            context=context,
            validation=report,
            model_used=gen_result.model,
            duration_ms=duration,
            raw_response=raw,
        )

    def chat_turn(self, session: ChatSession, user_message: str) -> GenerateResult:
        """多轮对话中的一轮。会追加用户消息和助手回复到 session。"""
        rapid_cfg = self._config.rapid
        if not session.messages:
            session.add("system", system_prompt(controller=rapid_cfg.controller))

        # 把当前用户消息走一次检索 + 装配
        rewritten = rewrite(user_message)
        retrieval_results = self._retriever.retrieve(rewritten.for_retrieval())
        context = self._context_builder.build(retrieval_results)

        # 把检索上下文嵌入用户消息
        enriched_user_message = user_message
        if context.text:
            enriched_user_message += (
                "\n\n[参考资料]\n" + context.text +
                "\n\n请基于上述资料生成或修改 RAPID 代码。"
            )

        session.add("user", enriched_user_message)
        gen_result = self._llm.chat(session.messages)
        from abb_agent.llm.ollama_client import GenerationResult as GR
        assert isinstance(gen_result, GR)

        raw = gen_result.text
        session.add("assistant", raw)

        code, explanation = _extract_code_block(raw)
        if code:
            final_code, report = _postprocess(
                code,
                controller=rapid_cfg.controller,
                io_whitelist=rapid_cfg.io_whitelist,
                strict_tcp=rapid_cfg.controller == "IRC5P",
            )
            session.last_code = final_code
        else:
            final_code, report = session.last_code, ValidationReport()

        return GenerateResult(
            code=final_code,
            explanation=explanation if explanation else raw,
            rewritten_query=rewritten,
            context=context,
            validation=report,
            model_used=gen_result.model,
            duration_ms=0,
            raw_response=raw,
        )

    def close(self) -> None:
        self._llm.close()

    def __enter__(self) -> "Agent":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
