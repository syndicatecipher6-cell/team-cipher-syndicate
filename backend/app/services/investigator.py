from collections import Counter
from typing import Any, Dict, Iterable, List, Optional, Set

from app.config import settings
from app.models.schemas import (
    AssistantResponse,
    CaseIntelligenceBrief,
    Evidence,
    EvidenceCitation,
    GraphData,
    InvestigationFinding,
)
from app.services.audit import audit_service
from app.services.data_processing import data_processor
from app.services.knowledge_graph import kg_service
from app.services.llm_provider import llm_provider
from app.services.retrieval import retrieval_service


class InvestigationReasoningService:
    """Grounded planner, retriever, graph analyst, and explanation orchestrator."""

    @staticmethod
    def _extract_entities(question: str) -> List[str]:
        lowered = question.casefold()
        matches = []
        for node in data_processor.graph_nodes.values():
            if node.id.casefold() in lowered or (node.label and node.label.casefold() in lowered):
                matches.append(node.id)
        return matches[:12]

    @staticmethod
    def _extract_cases(question: str, case_id: Optional[str]) -> List[str]:
        cases: List[str] = []
        if case_id:
            cases.append(case_id)
        lowered = question.casefold()
        for node in data_processor.graph_nodes.values():
            if node.type == "case" and (node.id.casefold() in lowered or node.label.casefold() in lowered):
                if node.id not in cases:
                    cases.append(node.id)
        return cases[:8]

    @staticmethod
    def _plan(question: str, entities: List[str], cases: List[str]) -> List[str]:
        lowered = question.casefold()
        plan = ["Authorize investigator and establish requested case scope"]
        if entities:
            plan.append("Resolve mentioned entities against canonical graph identifiers")
        plan.append("Run hybrid FIR/evidence retrieval and provenance filtering")
        if any(word in lowered for word in ("connect", "relationship", "link", "path", "network", "common")):
            plan.append("Traverse the scoped graph for direct and multi-hop relationships")
        if any(word in lowered for word in ("timeline", "when", "before", "after", "chronolog")):
            plan.append("Order supporting events chronologically and identify temporal gaps")
        if any(word in lowered for word in ("contradiction", "conflict", "dispute", "inconsistent")):
            plan.append("Compare retrieved assertions for contradictions")
        if cases:
            plan.append("Check scoped cases for shared entities and linked evidence")
        plan.append("Classify each conclusion and attach source citations")
        return plan

    @staticmethod
    def _citation(evidence: Evidence) -> EvidenceCitation:
        return EvidenceCitation(
            evidence_id=evidence.evidence_id,
            source_dataset=evidence.provenance.sourceDataset,
            source_record_id=evidence.provenance.sourceRecordId,
            record_type=evidence.provenance.recordType,
            excerpt=evidence.supportingData[:500],
        )

    @staticmethod
    def _evidence_lookup(ids: Iterable[str]) -> Dict[str, Evidence]:
        wanted = set(ids)
        return {item.evidence_id: item for item in data_processor.evidence_list if item.evidence_id in wanted}

    @staticmethod
    def _graph_context(
        entities: List[str],
        cases: List[str],
        graph_override: Optional[GraphData] = None,
    ) -> Dict[str, Any]:
        source_nodes = (
            {node.id: node for node in graph_override.nodes}
            if graph_override is not None
            else data_processor.graph_nodes
        )
        source_edges = graph_override.edges if graph_override is not None else data_processor.graph_edges
        scoped_ids: Set[str] = set(entities + cases)
        selected_edges = []
        if scoped_ids:
            for edge in source_edges:
                if edge.source in scoped_ids or edge.target in scoped_ids:
                    selected_edges.append(edge)
                    scoped_ids.update((edge.source, edge.target))
        else:
            selected_edges = source_edges[:30]
            for edge in selected_edges:
                scoped_ids.update((edge.source, edge.target))

        nodes = [
            {"id": node.id, "type": node.type, "label": node.label}
            for node_id, node in source_nodes.items()
            if node_id in scoped_ids
        ][:50]
        edges = [
            {
                "id": edge.id,
                "source": edge.source,
                "target": edge.target,
                "relationship": edge.relationship,
                "evidence_ids": edge.evidenceIds,
            }
            for edge in selected_edges[:80]
        ]
        return {"nodes": nodes, "edges": edges}

    @staticmethod
    def _find_contradictions(evidence: List[Evidence]) -> List[str]:
        contradictions: List[str] = []
        by_pair: Dict[tuple[str, str], Set[str]] = {}
        for item in evidence:
            pair = tuple(sorted((item.entityA, item.entityB)))
            by_pair.setdefault(pair, set()).add(item.relationship.casefold())
        for pair, relationships in by_pair.items():
            has_positive = any(term in rel for rel in relationships for term in ("owns", "same", "confirmed", "present"))
            has_negative = any(term in rel for rel in relationships for term in ("not", "denied", "disputed", "absent"))
            if has_positive and has_negative:
                contradictions.append(
                    f"Conflicting source assertions exist for {pair[0]} and {pair[1]}; investigator review is required."
                )
        return contradictions

    def _deterministic_findings(
        self,
        graph_context: Dict[str, Any],
        retrieved: List[Dict[str, Any]],
        evidence_lookup: Dict[str, Evidence],
    ) -> List[InvestigationFinding]:
        findings: List[InvestigationFinding] = []
        for item in retrieved[:5]:
            evidence = evidence_lookup.get(item["id"])
            if evidence:
                findings.append(
                    InvestigationFinding(
                        status="Verified Fact" if evidence.sourceReliability.lower().endswith("verified") else "Corroborated",
                        statement=evidence.supportingData,
                        confidence=min(0.98, max(0.55, float(item.get("score", 0.6)))),
                        citations=[self._citation(evidence)],
                    )
                )
        if not findings and graph_context["edges"]:
            edge = graph_context["edges"][0]
            findings.append(
                InvestigationFinding(
                    status="Inferred",
                    statement=(
                        f"The graph records a {edge['relationship']} link between "
                        f"{edge['source']} and {edge['target']}; its meaning requires source verification."
                    ),
                    confidence=0.5,
                    citations=[],
                )
            )
        if not findings:
            findings.append(
                InvestigationFinding(
                    status="Unresolved",
                    statement="No supporting record matching the question was retrieved from the active investigation scope.",
                    confidence=0.0,
                    citations=[],
                )
            )
        return findings

    def answer(
        self,
        question: str,
        actor: str,
        case_id: Optional[str] = None,
        sandbox_id: Optional[str] = None,
    ) -> AssistantResponse:
        entities = self._extract_entities(question)
        cases = self._extract_cases(question, case_id)
        plan = self._plan(question, entities, cases)
        retrieved = retrieval_service.hybrid_search_and_rerank(question, top_k=8)
        retrieved_ids = [item["id"] for item in retrieved]
        evidence_lookup = self._evidence_lookup(retrieved_ids)
        sandbox_graph = None
        if sandbox_id:
            from app.services.sandbox import sandbox_service
            sandbox_graph = sandbox_service.graph(sandbox_id)
        graph_context = self._graph_context(entities, cases, sandbox_graph)
        scoped_evidence = list(evidence_lookup.values())
        contradictions = self._find_contradictions(scoped_evidence)
        fallback_findings = self._deterministic_findings(graph_context, retrieved, evidence_lookup)

        safe_context = [
            {
                "id": item["id"],
                "type": item["type"],
                "text": item["text"][:1200],
                "score": item["score"],
                "provenance": item.get("provenance", {}),
            }
            for item in retrieved
        ]
        llm_result = llm_provider.generate_json(question, safe_context, graph_context, plan)
        findings = fallback_findings
        answer = "\n".join(f"[{finding.status}] {finding.statement}" for finding in findings)
        unresolved = [finding.statement for finding in findings if finding.status == "Unresolved"]
        suggestions = [
            "Show the evidence records supporting these findings.",
            "Which linked entities still require identity verification?",
            "What contradictions or timeline gaps remain unresolved?",
        ]

        if llm_result.available:
            payload = llm_result.payload
            allowed_evidence = set(evidence_lookup)
            parsed_findings: List[InvestigationFinding] = []
            for raw in payload.get("findings", [])[:10]:
                status = raw.get("status", "Unresolved")
                if status not in {"Verified Fact", "Corroborated", "Inferred", "Unresolved"}:
                    status = "Unresolved"
                citations = [
                    self._citation(evidence_lookup[evidence_id])
                    for evidence_id in raw.get("evidence_ids", [])
                    if evidence_id in allowed_evidence
                ]
                if status in {"Verified Fact", "Corroborated"} and not citations:
                    status = "Unresolved"
                parsed_findings.append(
                    InvestigationFinding(
                        status=status,
                        statement=str(raw.get("statement", "")).strip()[:2000],
                        confidence=max(0.0, min(1.0, float(raw.get("confidence", 0.0)))),
                        citations=citations,
                    )
                )
            if parsed_findings:
                findings = parsed_findings
            answer = str(payload.get("answer", answer)).strip()[:8000] or answer
            contradictions = [str(item)[:1000] for item in payload.get("contradictions", contradictions)[:10]]
            unresolved = [str(item)[:1000] for item in payload.get("unresolved", unresolved)[:10]]
            suggestions = [str(item)[:500] for item in payload.get("suggested_questions", suggestions)[:5]]

        evidence_ids = list(dict.fromkeys(
            citation.evidence_id for finding in findings for citation in finding.citations
        ))
        related_cases = list(dict.fromkeys(
            cases + [item.case_id for item in scoped_evidence if item.case_id]
        ))
        warnings = [
            "AI output is investigative support, not a determination of guilt.",
            "Every inferred lead requires investigator verification against the cited source.",
        ]
        if sandbox_id:
            warnings.insert(0, "HYPOTHETICAL / SANDBOX: this answer evaluates a temporary what-if graph only.")
        if llm_result.warning:
            warnings.append(llm_result.warning)
        if not settings.ENABLE_LOCAL_TRANSFORMERS:
            warnings.append("Optional local cross-encoder is disabled; lexical hybrid reranking is active.")

        audit_service.record(
            actor,
            "AI_INVESTIGATOR_QUERY",
            sandbox_id or case_id or "workspace",
            {
                "entities": entities,
                "cases": related_cases,
                "evidence_ids": evidence_ids,
                "sandbox_id": sandbox_id,
            },
        )
        return AssistantResponse(
            answer=answer,
            recordCount=len(retrieved),
            entities=entities or [node["id"] for node in graph_context["nodes"][:6]],
            cases=related_cases,
            evidenceIds=evidence_ids,
            suggestedQuestions=suggestions,
            findings=findings,
            contradictions=contradictions,
            unresolved=unresolved,
            queryPlan=plan,
            provider=llm_result.provider if llm_result.available else "deterministic-grounded",
            model=llm_result.model if llm_result.available else "none",
            warnings=warnings,
        )

    def brief(self, case_id: str, actor: str) -> CaseIntelligenceBrief:
        graph = kg_service.get_graph([case_id])
        case_node = next((node for node in graph.nodes if node.id == case_id), None)
        case_evidence = [item for item in data_processor.evidence_list if item.case_id == case_id]
        entity_ids = [node.id for node in graph.nodes if node.type != "case"]
        linked_cases = [node.id for node in graph.nodes if node.type == "case" and node.id != case_id]
        relationship_counts = Counter(edge.relationship for edge in graph.edges)
        timeline = [
            f"{row.get('timestamp', '')}: {row.get('event_type', '')} — {row.get('notes', '')}"
            for _, row in data_processor.timeline_df.iterrows()
            if str(row.get("case_id", "")) == case_id
        ]
        contradictions = self._find_contradictions(case_evidence)
        gaps = []
        if not timeline:
            gaps.append("No structured timeline events are available for this case.")
        if not case_evidence:
            gaps.append("No evidence records are currently linked to this case.")
        priorities = [
            "Verify inferred identity matches against original records.",
            "Review every cross-case path with its cited evidence before operational use.",
        ]
        hypotheses = []
        if linked_cases:
            hypotheses.append(
                InvestigationFinding(
                    status="Inferred",
                    statement=f"Shared graph entities may connect {case_id} with {', '.join(linked_cases)}.",
                    confidence=0.5,
                    citations=[self._citation(item) for item in case_evidence[:3]],
                )
            )
        overview = (
            f"{case_id} contains {len(entity_ids)} scoped entities, {len(graph.edges)} relationships, "
            f"and {len(case_evidence)} cited evidence records."
        )
        if case_node and case_node.metadata.get("crime_type"):
            overview += f" Recorded crime type: {case_node.metadata['crime_type']}."

        audit_service.record(actor, "GENERATE_CASE_BRIEF", case_id, {"evidence_count": len(case_evidence)})
        return CaseIntelligenceBrief(
            case_id=case_id,
            overview=overview,
            key_entities=entity_ids[:20],
            relationships=[f"{name}: {count}" for name, count in relationship_counts.most_common()],
            linked_cases=linked_cases,
            evidence=[self._citation(item) for item in case_evidence[:20]],
            timeline=timeline[:30],
            contradictions=contradictions,
            gaps=gaps,
            hypotheses=hypotheses,
            priorities=priorities,
            generated_by="grounded graph analysis",
            warnings=["This brief is analytical support and does not establish guilt."],
        )


investigator_service = InvestigationReasoningService()
