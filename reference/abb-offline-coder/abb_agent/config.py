"""全局配置 - 单一可信源。

所有路径基于项目根目录推导。所有可调参数集中在此，便于工业 PC 上调优。
环境变量可覆盖默认值，前缀 ABB_AGENT_。
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ControllerKind = Literal["IRC5", "IRC5P"]

# IO 白名单条目数硬上限，防 env var 注入超长字符串
_MAX_IO_WHITELIST_ENTRIES = 1000

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class PathConfig(BaseSettings):
    """所有重要路径集中管理。"""

    project_root: Path = PROJECT_ROOT
    data_dir: Path = PROJECT_ROOT / "data"
    raw_dir: Path = PROJECT_ROOT / "data" / "raw"
    parsed_dir: Path = PROJECT_ROOT / "data" / "parsed"
    chroma_dir: Path = PROJECT_ROOT / "data" / "chroma_db"
    models_dir: Path = PROJECT_ROOT / "models"
    output_dir: Path = PROJECT_ROOT / "output"
    logs_dir: Path = PROJECT_ROOT / "logs"
    examples_dir: Path = PROJECT_ROOT / "examples"

    def ensure_dirs(self) -> None:
        """启动时确保所有运行时目录存在。"""
        for attr in ("raw_dir", "parsed_dir", "chroma_dir", "output_dir", "logs_dir"):
            getattr(self, attr).mkdir(parents=True, exist_ok=True)


class LLMConfig(BaseSettings):
    """本地大模型相关配置。"""

    model_config = SettingsConfigDict(env_prefix="ABB_AGENT_LLM_", extra="ignore")

    ollama_host: str = "http://localhost:11434"
    model_name: str = "qwen2.5-coder:7b-instruct-q4_K_M"
    fallback_model: str = "qwen2.5-coder:3b-instruct-q4_K_M"
    temperature: float = 0.2
    top_p: float = 0.9
    max_tokens: int = 4096
    timeout_seconds: int = 120
    num_ctx: int = 8192
    seed: int | None = None


class EmbedConfig(BaseSettings):
    """嵌入模型配置。"""

    model_config = SettingsConfigDict(env_prefix="ABB_AGENT_EMBED_", extra="ignore")

    model_name: str = "BAAI/bge-small-zh-v1.5"
    cache_dir: Path = PROJECT_ROOT / "models" / "embeddings"
    batch_size: int = 32
    device: str = "cpu"
    normalize: bool = True


class RAGConfig(BaseSettings):
    """检索相关参数。"""

    model_config = SettingsConfigDict(env_prefix="ABB_AGENT_RAG_", extra="ignore")

    top_k_vector: int = 8
    top_k_bm25: int = 8
    top_k_final: int = 5
    rerank_alpha: float = 0.5
    max_context_tokens: int = 3500
    chunk_size: int = 512
    chunk_overlap: int = 64
    collection_name: str = "abb_rapid_knowledge"


class RapidConfig(BaseSettings):
    """RAPID 代码生成相关配置。

    controller 决定输出风格：
      - "IRC5": 通用控制器，使用 MoveL + SetDO 实现喷涂（无 Paint 选项时可用）。
      - "IRC5P": IRC5 Paint 控制器，使用 PaintL/PaintC + brushdata，配套 RobotWare Paint 选项。
    io_whitelist 是控制器 EIO.cfg 中已注册的 IO 信号集合。
    校验器会拒绝引用白名单外的信号（避免到现场报 40212 信号未定义）。

    env var 设置 io_whitelist 支持两种语法（CSV 优先，回退 JSON 数组）：
      ABB_AGENT_RAPID_IO_WHITELIST='doA,doB,doC'
      ABB_AGENT_RAPID_IO_WHITELIST='["doA","doB","doC"]'
    """

    model_config = SettingsConfigDict(env_prefix="ABB_AGENT_RAPID_", extra="ignore")

    controller: ControllerKind = "IRC5"
    # 注：声明为 str | tuple[str, ...] 是为了让 pydantic-settings 跳过自动 JSON 解析；
    #     field_validator 会在赋值后统一规范化为 tuple[str, ...]。
    io_whitelist: str | tuple[str, ...] = (
        "doSprayOn",
        "doFanOn",
        "doAtomOn",
        "doPaintOn",
        "diBrushOK",
    )
    default_brush_name: str = "bdMain"

    @field_validator("io_whitelist", mode="after")
    @classmethod
    def _parse_whitelist(cls, v: object) -> tuple[str, ...]:
        """允许三种输入：tuple/list、CSV 字符串、JSON 数组字符串。"""
        if isinstance(v, str):
            stripped = v.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                import json
                items = json.loads(stripped)
                parts = tuple(str(x).strip() for x in items if str(x).strip())
            else:
                parts = tuple(s.strip() for s in stripped.split(",") if s.strip())
            return parts[:_MAX_IO_WHITELIST_ENTRIES]
        if isinstance(v, (list, tuple)):
            return tuple(str(x) for x in v)[:_MAX_IO_WHITELIST_ENTRIES]
        return tuple()


class AppConfig(BaseSettings):
    """应用顶层配置，组合所有子配置。"""

    model_config = SettingsConfigDict(env_prefix="ABB_AGENT_", extra="ignore")

    paths: PathConfig = Field(default_factory=PathConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    embed: EmbedConfig = Field(default_factory=EmbedConfig)
    rag: RAGConfig = Field(default_factory=RAGConfig)
    rapid: RapidConfig = Field(default_factory=RapidConfig)

    log_level: str = "INFO"
    locale: str = "zh"
    offline_mode: bool = True


_config: AppConfig | None = None


def get_config() -> AppConfig:
    """单例配置入口。延迟加载，方便测试时 reset。"""
    global _config
    if _config is None:
        _config = AppConfig()
        _config.paths.ensure_dirs()
    return _config


def reset_config() -> None:
    """仅供测试使用。"""
    global _config
    _config = None
