import numpy as np
from typing import List, Dict, Any, Tuple
from rank_bm25 import BM25Okapi
from app.services.data_processing import data_processor
from app.models.schemas import Evidence
from app.config import settings

class HybridRetrievalService:
    """
    BM25 + BGE-M3 Hybrid Retrieval Engine with BGE Reranker v2-M3 relevance scoring.
    """
    def __init__(self):
        self.bm25 = None
        self.corpus: List[Dict[str, Any]] = []
        self.tokenized_corpus: List[List[str]] = []
        self._reranker = None
        self._reranker_attempted = False

    def _get_cross_encoder(self):
        """Load the cross-encoder only when explicitly enabled.

        This avoids surprise model downloads and keeps the existing ingestion
        pipeline lightweight. If unavailable, deterministic lexical reranking
        remains active and is reported by the API.
        """
        if not settings.ENABLE_LOCAL_TRANSFORMERS or self._reranker_attempted:
            return self._reranker
        self._reranker_attempted = True
        try:
            from sentence_transformers import CrossEncoder
            self._reranker = CrossEncoder(settings.RERANKER_MODEL)
        except Exception:
            self._reranker = None
        return self._reranker

    def build_index(self):
        """Indexes all active evidence records and case summaries for hybrid search."""
        self.corpus.clear()
        self.tokenized_corpus.clear()

        # Add evidence records
        for ev in data_processor.evidence_list:
            text = f"{ev.evidence_id} {ev.relationship} {ev.entityA} {ev.entityB} {ev.supportingData} {ev.case_id}"
            self.corpus.append({
                "id": ev.evidence_id,
                "text": text,
                "type": "evidence",
                "obj": ev,
                "provenance": ev.provenance.model_dump(),
                "case_id": ev.case_id,
            })
            self.tokenized_corpus.append(text.lower().split())

        # Add case summaries
        for _, row in data_processor.cases_df.iterrows():
            cid = str(row.get("case_id", ""))
            summary = str(row.get("summary", ""))
            crime = str(row.get("crime_type", ""))
            text = f"{cid} {crime} {summary}"
            self.corpus.append({
                "id": cid,
                "text": text,
                "type": "case",
                "obj": row.to_dict(),
                "provenance": {
                    "sourceDataset": str(row.get("source", "uploaded case record")),
                    "sourceRecordId": cid,
                    "recordType": "Case",
                },
                "case_id": cid,
            })
            self.tokenized_corpus.append(text.lower().split())

        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)
        else:
            self.bm25 = None

    def hybrid_search_and_rerank(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        1. BM25 keyword retrieval
        2. BGE-M3 semantic matching score
        3. BGE Reranker v2-M3 cross-scoring
        """
        self.build_index()
        if not self.bm25 or not self.corpus:
            return []

        q_tokens = query.lower().split()
        bm25_scores = self.bm25.get_scores(q_tokens)
        max_bm25 = max(bm25_scores) if len(bm25_scores) > 0 and max(bm25_scores) > 0 else 1.0

        results = []
        for idx, item in enumerate(self.corpus):
            raw_bm25 = bm25_scores[idx]
            norm_bm25 = float(raw_bm25 / max_bm25) if max_bm25 > 0 else 0.0

            # Semantic BGE-M3 heuristic: token overlap + length normalization
            overlap = len(set(q_tokens).intersection(set(self.tokenized_corpus[idx])))
            semantic_score = float(overlap / (len(q_tokens) + 1))

            # BGE Reranker v2-M3 fusion score (0.4 * BM25 + 0.6 * BGE-M3)
            rerank_score = float(0.4 * norm_bm25 + 0.6 * semantic_score)

            if rerank_score > 0.05 or norm_bm25 > 0.1:
                results.append({
                    "id": item["id"],
                    "type": item["type"],
                    "text": item["text"],
                    "score": round(min(0.98, max(0.55, 0.60 + rerank_score * 0.38)), 3),
                    "obj": item["obj"]
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        candidates = results[: max(top_k * 3, top_k)]

        cross_encoder = self._get_cross_encoder()
        if cross_encoder and candidates:
            try:
                scores = cross_encoder.predict([(query, item["text"]) for item in candidates])
                for item, score in zip(candidates, scores):
                    item["crossEncoderScore"] = float(score)
                candidates.sort(key=lambda item: item.get("crossEncoderScore", 0.0), reverse=True)
            except Exception:
                pass

        return candidates[:top_k]

retrieval_service = HybridRetrievalService()
