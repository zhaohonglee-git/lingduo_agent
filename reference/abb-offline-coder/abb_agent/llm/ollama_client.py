"""Ollama HTTP 客户端。

只暴露 generate / chat / health_check / list_models 四个动作。
所有方法都不可变 - 输入消息列表不会被修改，新对象返回。
对网络错误使用指数退避重试（tenacity），避免临时抖动失败。
"""
from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

import httpx
from loguru import logger
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from abb_agent.config import LLMConfig, get_config


@dataclass(frozen=True)
class ChatMessage:
    """对话消息。frozen=True 强制不可变。"""

    role: str
    content: str

    def to_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


@dataclass(frozen=True)
class GenerationResult:
    """一次生成的结果包装。"""

    text: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_duration_ms: int = 0
    raw: dict[str, Any] = field(default_factory=dict)


class OllamaConnectionError(RuntimeError):
    """Ollama 服务连接失败。"""


class OllamaModelMissingError(RuntimeError):
    """目标模型未下载。"""


class OllamaClient:
    """对 Ollama HTTP API 的薄包装。

    实例本身不可变（配置只读），所有方法不修改自身状态。
    """

    def __init__(self, config: LLMConfig | None = None) -> None:
        self._config = config or get_config().llm
        self._client = httpx.Client(
            base_url=self._config.ollama_host,
            timeout=self._config.timeout_seconds,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "OllamaClient":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=2),
        retry=retry_if_exception_type(httpx.TransportError),
        reraise=True,
    )
    def health_check(self) -> bool:
        """检查 Ollama 是否在线。"""
        try:
            resp = self._client.get("/api/tags", timeout=5)
            resp.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.warning("Ollama 健康检查失败: {}", exc)
            return False

    def list_models(self) -> list[str]:
        """列出已下载的本地模型名称。"""
        try:
            resp = self._client.get("/api/tags")
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaConnectionError(f"无法连接 Ollama: {exc}") from exc
        data = resp.json()
        return [m["name"] for m in data.get("models", [])]

    def ensure_model(self, model: str | None = None) -> str:
        """确保模型存在；若主模型缺失，自动降级到备选。

        返回最终选用的模型名。
        """
        target = model or self._config.model_name
        available = self.list_models()
        if target in available:
            return target

        fallback = self._config.fallback_model
        if fallback in available:
            logger.warning("主模型 {} 不可用，降级到 {}", target, fallback)
            return fallback

        raise OllamaModelMissingError(
            f"未找到模型 '{target}' 或备选 '{fallback}'。请先运行 'abb-agent kb pull-model'。"
        )

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=2),
        retry=retry_if_exception_type(httpx.TransportError),
        reraise=True,
    )
    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        stream: bool = False,
    ) -> GenerationResult | Iterator[str]:
        """单轮文本生成。stream=True 时返回 token 迭代器。"""
        chosen_model = self.ensure_model(model)
        payload: dict[str, Any] = {
            "model": chosen_model,
            "prompt": prompt,
            "stream": stream,
            "options": self._options(),
        }
        if system:
            payload["system"] = system

        if stream:
            return self._stream_generate(payload)
        return self._sync_generate(payload, chosen_model)

    def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        stream: bool = False,
    ) -> GenerationResult | Iterator[str]:
        """多轮对话。messages 不会被修改。"""
        chosen_model = self.ensure_model(model)
        payload: dict[str, Any] = {
            "model": chosen_model,
            "messages": [m.to_dict() for m in messages],
            "stream": stream,
            "options": self._options(),
        }
        if stream:
            return self._stream_chat(payload)
        return self._sync_chat(payload, chosen_model)

    def _options(self) -> dict[str, Any]:
        opts: dict[str, Any] = {
            "temperature": self._config.temperature,
            "top_p": self._config.top_p,
            "num_predict": self._config.max_tokens,
            "num_ctx": self._config.num_ctx,
        }
        if self._config.seed is not None:
            opts["seed"] = self._config.seed
        return opts

    def _sync_generate(self, payload: dict[str, Any], model: str) -> GenerationResult:
        try:
            resp = self._client.post("/api/generate", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaConnectionError(f"生成请求失败: {exc}") from exc
        data = resp.json()
        return GenerationResult(
            text=data.get("response", ""),
            model=model,
            prompt_tokens=data.get("prompt_eval_count", 0),
            completion_tokens=data.get("eval_count", 0),
            total_duration_ms=data.get("total_duration", 0) // 1_000_000,
            raw=data,
        )

    def _sync_chat(self, payload: dict[str, Any], model: str) -> GenerationResult:
        try:
            resp = self._client.post("/api/chat", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaConnectionError(f"对话请求失败: {exc}") from exc
        data = resp.json()
        return GenerationResult(
            text=data.get("message", {}).get("content", ""),
            model=model,
            prompt_tokens=data.get("prompt_eval_count", 0),
            completion_tokens=data.get("eval_count", 0),
            total_duration_ms=data.get("total_duration", 0) // 1_000_000,
            raw=data,
        )

    def _stream_generate(self, payload: dict[str, Any]) -> Iterator[str]:
        with self._client.stream("POST", "/api/generate", json=payload) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                token = chunk.get("response", "")
                if token:
                    yield token
                if chunk.get("done"):
                    break

    def _stream_chat(self, payload: dict[str, Any]) -> Iterator[str]:
        with self._client.stream("POST", "/api/chat", json=payload) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token
                if chunk.get("done"):
                    break
