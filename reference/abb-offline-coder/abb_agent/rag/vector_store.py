"""ChromaDB 向量库封装。

设计原则：
- 内嵌模式（persist 到本地磁盘），无独立服务进程
- 提供 add/query/delete/count 四个操作
- 屏蔽 ChromaDB API 细节，方便后续替换为其他向量库
"""
from __future__ import annotations

from typing import Any

from loguru import logger

from abb_agent.config import RAGConfig, get_config
from abb_agent.rag.embedder import Embedder
from abb_agent.rag.models import Chunk, RetrievalResult


class VectorStore:
    """ChromaDB 持久化向量库。

    实例本身可重复使用，但内部有 chroma client / collection 句柄。
    """

    def __init__(
        self,
        embedder: Embedder | None = None,
        rag_config: RAGConfig | None = None,
    ) -> None:
        self._config = rag_config or get_config().rag
        self._chroma_dir = get_config().paths.chroma_dir
        self._embedder = embedder or Embedder()
        self._client = None
        self._collection = None

    def _lazy_load(self) -> None:
        if self._collection is not None:
            return
        import chromadb
        from chromadb.config import Settings

        logger.info("打开 ChromaDB: {}", self._chroma_dir)
        self._client = chromadb.PersistentClient(
            path=str(self._chroma_dir),
            settings=Settings(anonymized_telemetry=False, allow_reset=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=self._config.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    # ChromaDB 单批 upsert 上限（实测 5461，留余量）
    _BATCH_SIZE = 4000

    def add_chunks(self, chunks: list[Chunk]) -> int:
        """批量插入或更新（upsert）。返回写入条数。分批以避免 ChromaDB 单批上限。"""
        if not chunks:
            return 0
        self._lazy_load()

        total = len(chunks)
        logger.info("生成 {} 条嵌入...", total)
        written = 0
        for i in range(0, total, self._BATCH_SIZE):
            batch = chunks[i : i + self._BATCH_SIZE]
            ids = [c.chunk_id for c in batch]
            texts = [c.text for c in batch]
            metadatas: list[dict[str, Any]] = [c.to_chroma_metadata() for c in batch]
            embeddings = self._embedder.encode(texts)
            self._collection.upsert(
                ids=ids,
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )
            written += len(batch)
            logger.info("  写入批次 {}/{} 完成 (累计 {}/{})",
                        i // self._BATCH_SIZE + 1,
                        (total + self._BATCH_SIZE - 1) // self._BATCH_SIZE,
                        written, total)
        return written

    def query(
        self,
        query_text: str,
        *,
        top_k: int | None = None,
        where: dict[str, Any] | None = None,
    ) -> list[RetrievalResult]:
        """语义检索。"""
        self._lazy_load()
        k = top_k or self._config.top_k_vector
        query_embedding = self._embedder.encode_one(query_text)

        result = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where=where,
        )

        return self._to_results(result)

    def get_all_chunks(self, limit: int | None = None) -> list[Chunk]:
        """导出所有 chunk（供 BM25 索引使用）。"""
        self._lazy_load()
        # ChromaDB get() 不支持 None limit；分批拉取
        all_ids: list[str] = []
        all_docs: list[str] = []
        all_metas: list[dict[str, Any]] = []
        batch_size = 1000
        offset = 0
        while True:
            data = self._collection.get(limit=batch_size, offset=offset)
            ids = data.get("ids", [])
            if not ids:
                break
            all_ids.extend(ids)
            all_docs.extend(data.get("documents", []) or [])
            all_metas.extend(data.get("metadatas", []) or [])
            offset += len(ids)
            if limit and len(all_ids) >= limit:
                break

        return [
            self._metadata_to_chunk(cid, doc, meta)
            for cid, doc, meta in zip(all_ids, all_docs, all_metas, strict=False)
        ]

    def count(self) -> int:
        self._lazy_load()
        return self._collection.count()

    def clear(self) -> None:
        """清空集合，仅用于重建。"""
        self._lazy_load()
        assert self._client is not None
        self._client.delete_collection(self._config.collection_name)
        self._collection = self._client.get_or_create_collection(
            name=self._config.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def _to_results(self, raw: dict[str, Any]) -> list[RetrievalResult]:
        ids = raw.get("ids", [[]])[0]
        docs = raw.get("documents", [[]])[0]
        metas = raw.get("metadatas", [[]])[0]
        dists = raw.get("distances", [[]])[0]
        out: list[RetrievalResult] = []
        for rank, (cid, text, meta, dist) in enumerate(
            zip(ids, docs, metas, dists, strict=False)
        ):
            chunk = self._metadata_to_chunk(cid, text, meta)
            score = 1.0 - float(dist)
            out.append(RetrievalResult(chunk=chunk, score=score, rank=rank))
        return out

    @staticmethod
    def _metadata_to_chunk(chunk_id: str, text: str, meta: dict[str, Any]) -> Chunk:
        from abb_agent.rag.models import ChunkKind, SourceType

        kw_raw = meta.get("keywords", "") or ""
        return Chunk(
            chunk_id=chunk_id,
            doc_id=meta.get("doc_id", ""),
            text=text,
            kind=ChunkKind(meta.get("kind", ChunkKind.DOC_PARAGRAPH.value)),
            source_type=SourceType(
                meta.get("source_type", SourceType.OFFICIAL_MANUAL.value)
            ),
            title=meta.get("title", ""),
            keywords=tuple(k for k in kw_raw.split(",") if k),
            language=meta.get("language", "en"),
            metadata={
                k: v for k, v in meta.items()
                if k not in {"doc_id", "kind", "source_type", "title", "language", "keywords"}
            },
        )
