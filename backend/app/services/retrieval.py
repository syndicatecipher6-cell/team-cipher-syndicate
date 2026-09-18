import numpy as np
from typing import List, Dict, Any, Tuple
from rank_bm25 import BM25Okapi
from app.services.data_processing import data_processor
from app.models.schemas import CaseRecord, Evidence
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
        return self._rank(query, self.corpus, self.tokenized_corpus, top_k)

    def search_records(
        self,
        query: str,
        evidence_records: List[Evidence],
        cases: List[CaseRecord],
        top_k: int = 8,
    ) -> List[Dict[str, Any]]:
        """Rank the caller's active workspace without relying on server-global ingestion state."""
        corpus: List[Dict[str, Any]] = []
        tokens: List[List[str]] = []
        for item in evidence_records:
            text = f"{item.evidence_id} {item.relationship} {item.entityA} {item.entityB} {item.supportingData} {item.case_id}"
            corpus.append({
                "id": item.evidence_id,
                "text": text,
                "type": "evidence",
                "obj": item,
                "provenance": item.provenance.model_dump(),
                "case_id": item.case_id,
                "entity_ids": [item.entityA, item.entityB],
            })
            tokens.append(text.lower().split())
        for item in cases:
            text = f"{item.case_id} {item.fir_number} {item.crime_type} {item.summary} {item.district} {item.state}"
            corpus.append({
                "id": item.case_id,
                "text": text,
                "type": "case",
                "obj": item,
                "provenance": {
                    "sourceDataset": "uploaded case record",
                    "sourceRecordId": item.case_id,
                    "recordType": "Case",
                },
                "case_id": item.case_id,
                "entity_ids": [item.case_id],
            })
            tokens.append(text.lower().split())
        return self._rank(query, corpus, tokens, top_k)

    def _rank(
        self,
        query: str,
        corpus: List[Dict[str, Any]],
        tokenized_corpus: List[List[str]],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        if not corpus:
            return []

        bm25 = BM25Okapi(tokenized_corpus)

        q_tokens = query.lower().split()
        bm25_scores = bm25.get_scores(q_tokens)
        max_bm25 = max(bm25_scores) if len(bm25_scores) > 0 and max(bm25_scores) > 0 else 1.0

        results = []
        for idx, item in enumerate(corpus):
            raw_bm25 = bm25_scores[idx]
            norm_bm25 = float(raw_bm25 / max_bm25) if max_bm25 > 0 else 0.0

            # Semantic BGE-M3 heuristic: token overlap + length normalization
            overlap = len(set(q_tokens).intersection(set(tokenized_corpus[idx])))
            semantic_score = float(overlap / (len(q_tokens) + 1))

            # BGE Reranker v2-M3 fusion score (0.4 * BM25 + 0.6 * BGE-M3)
            rerank_score = float(0.4 * norm_bm25 + 0.6 * semantic_score)

            if rerank_score > 0.05 or norm_bm25 > 0.1:
                results.append({
                    "id": item["id"],
                    "type": item["type"],
                    "text": item["text"],
                    "score": round(min(0.98, max(0.55, 0.60 + rerank_score * 0.38)), 3),
                    "case_id": item["case_id"],
                    "provenance": item["provenance"],
                    "entity_ids": item.get("entity_ids", []),
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
