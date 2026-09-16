from datetime import datetime, timezone
from threading import Lock
from typing import Dict, List, Tuple
from uuid import uuid4

import networkx as nx

from app.models.schemas import (
    GraphData,
    GraphEdge,
    GraphNode,
    Provenance,
    SandboxComparison,
    SandboxMetrics,
    SandboxModification,
    SandboxModificationInput,
    SandboxSession,
)
from app.services.audit import audit_service
from app.services.knowledge_graph import kg_service


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InvestigationSandboxService:
    """Modification-only what-if graph branches.

    Sessions store only metadata and an ordered modification log. Production
    graph nodes and relationships are copied at evaluation time and are never
    mutated or written back.
    """

    def __init__(self) -> None:
        self._sessions: Dict[str, SandboxSession] = {}
        self._lock = Lock()

    def create(self, base_case_id: str, actor: str) -> SandboxSession:
        if base_case_id not in {node.id for node in kg_service.get_graph().nodes if node.type == "case"}:
            raise ValueError(f"Unknown base case: {base_case_id}")
        now = _utc_now()
        session = SandboxSession(
            sandbox_id=f"SBX-{uuid4().hex[:12].upper()}",
            base_case_id=base_case_id,
            created_by=actor,
            created_at=now,
            updated_at=now,
        )
        session.comparison = self._compare(session)
        with self._lock:
            self._sessions[session.sandbox_id] = session
        audit_service.record(actor, "SANDBOX_CREATE", session.sandbox_id, {"base_case_id": base_case_id})
        return session.model_copy(deep=True)

    def get(self, sandbox_id: str) -> SandboxSession:
        with self._lock:
            session = self._sessions.get(sandbox_id)
        if not session:
            raise KeyError(sandbox_id)
        return session.model_copy(deep=True)

    def apply(self, sandbox_id: str, change: SandboxModificationInput, actor: str) -> SandboxSession:
        with self._lock:
            session = self._sessions.get(sandbox_id)
            if not session:
                raise KeyError(sandbox_id)
            if session.status != "active":
                raise ValueError("Sandbox session is closed")
            modification = SandboxModification(
                **change.model_dump(),
                modification_id=f"MOD-{uuid4().hex[:12].upper()}",
                created_at=_utc_now(),
                created_by=actor,
            )
            self._validate_modification(session, modification)
            session.modifications.append(modification)
            session.updated_at = _utc_now()
            session.comparison = self._compare(session)
            result = session.model_copy(deep=True)
        audit_service.record(
            actor,
            "SANDBOX_MODIFICATION",
            sandbox_id,
            {"operation": change.operation, "parameters": change.parameters, "rationale": change.rationale},
        )
        return result

    def close(self, sandbox_id: str, actor: str) -> SandboxSession:
        with self._lock:
            session = self._sessions.get(sandbox_id)
            if not session:
                raise KeyError(sandbox_id)
            session.status = "closed"
            session.updated_at = _utc_now()
            result = session.model_copy(deep=True)
        audit_service.record(actor, "SANDBOX_CLOSE", sandbox_id, {})
        return result

    def graph(self, sandbox_id: str) -> GraphData:
        session = self.get(sandbox_id)
        _, after = self._graphs(session)
        return after

    def _base_graph(self, session: SandboxSession) -> GraphData:
        return kg_service.get_graph([session.base_case_id]).model_copy(deep=True)

    def _validate_modification(self, session: SandboxSession, modification: SandboxModification) -> None:
        _, current = self._graphs(session)
        node_ids = {node.id for node in current.nodes}
        edge_ids = {edge.id for edge in current.edges}
        params = modification.parameters
        op = modification.operation

        if op == "IDENTITY_MERGE":
            required = {params.get("source_entity_id"), params.get("target_entity_id")}
            if None in required or not required.issubset(node_ids) or len(required) != 2:
                raise ValueError("IDENTITY_MERGE requires two different existing entity IDs")
        elif op == "RELATIONSHIP_ADD":
            if params.get("source") not in node_ids or params.get("target") not in node_ids:
                raise ValueError("RELATIONSHIP_ADD endpoints must exist in the sandbox graph")
            if not str(params.get("relationship", "")).strip():
                raise ValueError("RELATIONSHIP_ADD requires a relationship label")
        elif op == "RELATIONSHIP_REMOVE":
            if params.get("edge_id") not in edge_ids:
                raise ValueError("RELATIONSHIP_REMOVE requires an existing edge_id")
        elif op == "EVIDENCE_DISPUTE":
            if not params.get("evidence_id"):
                raise ValueError("EVIDENCE_DISPUTE requires evidence_id")
        elif op == "ENTITY_SPLIT":
            if params.get("entity_id") not in node_ids or not params.get("new_entity_id"):
                raise ValueError("ENTITY_SPLIT requires an existing entity_id and a new_entity_id")
            if params.get("new_entity_id") in node_ids:
                raise ValueError("new_entity_id already exists")
        elif op == "TIMELINE_CHANGE":
            if not params.get("event_id") or not params.get("timestamp"):
                raise ValueError("TIMELINE_CHANGE requires event_id and timestamp")

    def _graphs(self, session: SandboxSession) -> Tuple[GraphData, GraphData]:
        before = self._base_graph(session)
        after = before.model_copy(deep=True)
        for modification in session.modifications:
            self._apply_to_graph(after, modification)
        return before, after

    @staticmethod
    def _apply_to_graph(graph: GraphData, modification: SandboxModification) -> None:
        params = modification.parameters
        op = modification.operation
        if op == "IDENTITY_MERGE":
            source_id = str(params["source_entity_id"])
            target_id = str(params["target_entity_id"])
            graph.nodes = [node for node in graph.nodes if node.id != source_id]
            for edge in graph.edges:
                if edge.source == source_id:
                    edge.source = target_id
                if edge.target == source_id:
                    edge.target = target_id
            seen = set()
            deduped = []
            for edge in graph.edges:
                key = (edge.source, edge.target, edge.relationship)
                if edge.source != edge.target and key not in seen:
                    seen.add(key)
                    deduped.append(edge)
            graph.edges = deduped
        elif op == "RELATIONSHIP_ADD":
            graph.edges.append(
                GraphEdge(
                    id=f"SBX-EDGE-{modification.modification_id}",
                    source=str(params["source"]),
                    target=str(params["target"]),
                    relationship=str(params["relationship"]).upper(),
                    evidenceIds=list(modification.evidence_ids),
                    priority="Low",
                    provenance=Provenance(
                        sourceDataset="SANDBOX",
                        sourceRecordId=modification.modification_id,
                        recordType="HYPOTHETICAL / SANDBOX",
                    ),
                )
            )
        elif op == "RELATIONSHIP_REMOVE":
            graph.edges = [edge for edge in graph.edges if edge.id != params["edge_id"]]
        elif op == "EVIDENCE_DISPUTE":
            evidence_id = str(params["evidence_id"])
            for edge in graph.edges:
                edge.evidenceIds = [item for item in edge.evidenceIds if item != evidence_id]
        elif op == "ENTITY_SPLIT":
            original = next(node for node in graph.nodes if node.id == params["entity_id"])
            new_node = original.model_copy(deep=True)
            new_node.id = str(params["new_entity_id"])
            new_node.label = str(params.get("new_label") or f"{original.label} (hypothetical split)")
            new_node.metadata = {**new_node.metadata, "sandboxLabel": "HYPOTHETICAL / SANDBOX"}
            new_node.provenance = Provenance(
                sourceDataset="SANDBOX",
                sourceRecordId=modification.modification_id,
                recordType="HYPOTHETICAL / SANDBOX",
            )
            graph.nodes.append(new_node)
            selected_edge_ids = set(params.get("edge_ids", []))
            for edge in graph.edges:
                if edge.id in selected_edge_ids:
                    if edge.source == original.id:
                        edge.source = new_node.id
                    if edge.target == original.id:
                        edge.target = new_node.id
        # TIMELINE_CHANGE is retained in the modification log and reflected in
        # timeline metrics. It never edits production timeline records.

    @staticmethod
    def _metrics(graph: GraphData, timeline_change_count: int = 0) -> SandboxMetrics:
        nx_graph = nx.Graph()
        nx_graph.add_nodes_from(node.id for node in graph.nodes)
        nx_graph.add_edges_from((edge.source, edge.target) for edge in graph.edges)
        communities = []
        if nx_graph.number_of_nodes():
            communities = list(nx.algorithms.community.greedy_modularity_communities(nx_graph))
        centrality = nx.degree_centrality(nx_graph) if nx_graph.number_of_nodes() > 1 else {node: 0.0 for node in nx_graph}
        lpi = dict(sorted(
            ((node, round(score * 100, 2)) for node, score in centrality.items()),
            key=lambda item: item[1],
            reverse=True,
        )[:10])
        path_count = 0
        nodes = list(nx_graph.nodes)
        for index, source in enumerate(nodes):
            lengths = nx.single_source_shortest_path_length(nx_graph, source, cutoff=3)
            path_count += sum(1 for target in nodes[index + 1:] if target in lengths)
        case_ids = sorted(node.id for node in graph.nodes if node.type == "case")
        return SandboxMetrics(
            node_count=len(graph.nodes),
            relationship_count=len(graph.edges),
            community_count=len(communities),
            affected_cases=case_ids,
            multi_hop_path_count=path_count,
            lpi=lpi,
            timeline_change_count=timeline_change_count,
        )

    def _compare(self, session: SandboxSession) -> SandboxComparison:
        before_graph, after_graph = self._graphs(session)
        before_node_ids = {node.id for node in before_graph.nodes}
        after_node_ids = {node.id for node in after_graph.nodes}
        before_edge_ids = {edge.id for edge in before_graph.edges}
        after_edge_ids = {edge.id for edge in after_graph.edges}
        timeline_count = sum(1 for item in session.modifications if item.operation == "TIMELINE_CHANGE")
        before = self._metrics(before_graph)
        after = self._metrics(after_graph, timeline_count)
        impact = []
        relationship_delta = after.relationship_count - before.relationship_count
        community_delta = after.community_count - before.community_count
        path_delta = after.multi_hop_path_count - before.multi_hop_path_count
        impact.append(f"Relationship count changed by {relationship_delta:+d}.")
        impact.append(f"Reachable paths within three hops changed by {path_delta:+d}.")
        impact.append(f"Detected communities changed by {community_delta:+d}.")
        impact.append("All results are HYPOTHETICAL / SANDBOX and do not modify production data.")
        return SandboxComparison(
            before=before,
            after=after,
            added_nodes=sorted(after_node_ids - before_node_ids),
            removed_nodes=sorted(before_node_ids - after_node_ids),
            added_relationships=sorted(after_edge_ids - before_edge_ids),
            removed_relationships=sorted(before_edge_ids - after_edge_ids),
            impact_summary=impact,
        )


sandbox_service = InvestigationSandboxService()
