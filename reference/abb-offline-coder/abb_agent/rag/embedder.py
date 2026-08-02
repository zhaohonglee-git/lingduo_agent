"""中文嵌入模型封装 (bge-small-zh-v1.5)。

- 离线运行：模型预先下载到本地 models/ 目录
- CPU 推理：工业 PC 无 GPU 也可用
- 归一化：默认对嵌入向量做 L2 归一化，便于余弦相似度
"""
from __future__ import annotations

from pathlib import Path

from loguru import logger

from abb_agent.config import EmbedConfig, get_config


class Embedder:
    """句子嵌入器，延迟加载模型。

    使用 sentence-transformers。该库内部用 transformers + torch，
    会自动管理 CPU/GPU。我们强制 device=cpu 以适配工业 PC。
    """

    def __init__(self, config: EmbedConfig | None = None) -> None:
        self._config = config or get_config().embed
        self._model = None

    @property
    def dimension(self) -> int:
        """嵌入向量维度。bge-small-zh-v1.5 是 512。"""
        self._lazy_load()
        return self._model.get_sentence_embedding_dimension()

    def _lazy_load(self) -> None:
        if self._model is not None:
            return
        from sentence_transformers import SentenceTransformer

        cache_dir = Path(self._config.cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info("加载嵌入模型: {} (device={})", self._config.model_name, self._config.device)
        self._model = SentenceTransformer(
            self._config.model_name,
            cache_folder=str(cache_dir),
            device=self._config.device,
        )

    def encode(self, texts: list[str]) -> list[list[float]]:
        """批量嵌入。返回 list[list[float]] 便于 ChromaDB 直接消费。"""
        if not texts:
            return []
        self._lazy_load()
        embeddings = self._model.encode(
            texts,
            batch_size=self._config.batch_size,
            normalize_embeddings=self._config.normalize,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return embeddings.tolist()

    def encode_one(self, text: str) -> list[float]:
        """单条嵌入。"""
        return self.encode([text])[0]
