"""混合检索：BM25 关键词 + 向量语义。

为什么需要混合？
- 用户输入"如何写 MoveL"是精确关键词查询 → BM25 强
- 用户输入"我想让喷枪沿着直线扫过去"是意图查询 → 向量强

最终分数 = α * vector_score + (1-α) * bm25_score （归一化后线性融合）

BM25 索引采用 rank_bm25 内存版，启动时一次性从向量库导出。
小知识库（< 50K chunks）足够快；大知识库可改 SQLite-FTS。
"""
from __future__ import annotations

import re

from loguru import logger
from rank_bm25 import BM25Okapi

from abb_agent.config import RAGConfig, get_config
from abb_agent.rag.models import Chunk, RetrievalResult
from abb_agent.rag.vector_store import VectorStore


def _tokenize(text: str) -> list[str]:
    """简单分词：英文按空格/标点，中文按字符 + 关键词整体匹配。

    BM25 对粒度敏感。RAPID 关键词（MoveL）必须整体保留，不可拆开。
    中文按字符切（bge 嵌入器内部会处理语义）。
    """
    text = text.lower()
    # 英文词 + 数字 + 下划线
    tokens = re.findall(r"[a-z][a-z0-9_]+", text)
    # 中文字符
    tokens.extend(re.findall(r"[一-鿿]", text))
    return tokens


def _normalize(scores: list[float]) -> list[float]:
    if not scores:
        return scores
    lo, hi = min(scores), max(scores)
    if hi - lo < 1e-9:
        return [0.5] * len(scores)
    return [(s - lo) / (hi - lo) for s in scores]


class HybridRetriever:
    """组合 BM25 + 向量的检索器。"""

    def __init__(
        self,
        vector_store: VectorStore | None = None,
        config: RAGConfig | None = None,
    ) -> None:
        self._config = config or get_config().rag
        self._vs = vector_store or VectorStore()
        self._bm25: BM25Okapi | None = None
        self._bm25_chunks: list[Chunk] = []

    def _ensure_bm25(self) -> None:
        if self._bm25 is not None:
            return
        chunks = self._vs.get_all_chunks()
        if not chunks:
            logger.warning("向量库为空，BM25 索引跳过")
            self._bm25 = None
            self._bm25_chunks = []
            return
        corpus = [_tokenize(c.text + " " + " ".join(c.keywords)) for c in chunks]
        self._bm25 = BM25Okapi(corpus)
        self._bm25_chunks = chunks
        logger.info("BM25 索引构建完成，{} 条", len(chunks))

    def retrieve(
        self,
        query: str,
        *,
        top_k: int | None = None,
        keyword_filter: list[str] | None = None,
    ) -> list[RetrievalResult]:
        """混合检索主入口。"""
        k_final = top_k or self._config.top_k_final
        k_vec = self._config.top_k_vector
        k_bm25 = self._config.top_k_bm25

        vec_results = self._vs.query(query, top_k=k_vec)
        bm25_results = self._bm25_search(query, top_k=k_bm25)

        merged = self._merge_and_rerank(
            vec_results, bm25_results, alpha=self._config.rerank_alpha
        )

        if keyword_filter:
            merged = self._filter_by_keywords(merged, keyword_filter)

        return merged[:k_final]

    def _bm25_search(self, query: str, top_k: int) -> list[RetrievalResult]:
        self._ensure_bm25()
        if self._bm25 is None:
            return []
        tokens = _tokenize(query)
        if not tokens:
            return []
        scores = self._bm25.get_scores(tokens)
        # Top-K
        scored = sorted(
            enumerate(scores), key=lambda x: x[1], reverse=True
        )[:top_k]
        return [
            RetrievalResult(
                chunk=self._bm25_chunks[idx],
                score=float(s),
                rank=rank,
            )
            for rank, (idx, s) in enumerate(scored)
            if s > 0
        ]

    def _merge_and_rerank(
        self,
        vec: list[RetrievalResult],
        bm25: list[RetrievalResult],
        alpha: float,
    ) -> list[RetrievalResult]:
        """把两路结果按 chunk_id 合并，分数加权融合。"""
        # 归一化
        vec_norm = _normalize([r.score for r in vec])
        bm25_norm = _normalize([r.score for r in bm25])

        score_map: dict[str, tuple[Chunk, float]] = {}
        kw_map: dict[str, set[str]] = {}

        for r, ns in zip(vec, vec_norm, strict=False):
            score_map[r.chunk.chunk_id] = (r.chunk, alpha * ns)
            kw_map[r.chunk.chunk_id] = set(r.matched_keywords)
        for r, ns in zip(bm25, bm25_norm, strict=False):
            existing = score_map.get(r.chunk.chunk_id)
            existing_score = existing[1] if existing else 0.0
            score_map[r.chunk.chunk_id] = (r.chunk, existing_score + (1 - alpha) * ns)
            kw_map.setdefault(r.chunk.chunk_id, set()).update(r.matched_keywords)

        merged = sorted(
            score_map.items(), key=lambda kv: kv[1][1], reverse=True
        )
        return [
            RetrievalResult(
                chunk=chunk,
                score=score,
                rank=rank,
                matched_keywords=tuple(sorted(kw_map.get(cid, set()))),
            )
            for rank, (cid, (chunk, score)) in enumerate(merged)
        ]

    @staticmethod
    def _filter_by_keywords(
        results: list[RetrievalResult], keywords: list[str]
    ) -> list[RetrievalResult]:
        kw_set = {k.lower() for k in keywords}
        out: list[RetrievalResult] = []
        for r in results:
            chunk_kws = {k.lower() for k in r.chunk.keywords}
            if kw_set & chunk_kws:
                out.append(r)
        return out
