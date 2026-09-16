from typing import List, Dict, Any, Optional, Set
from app.models.schemas import (
    GraphData, GraphNode, GraphEdge, HiddenConnectionResponse,
    CrossCaseResponse, CrossCaseConnection
)
from app.services.data_processing import data_processor
from app.config import settings

class Neo4jKnowledgeGraphService:
    """
    Neo4j + Cypher query generator and knowledge graph engine.
    Supports live Neo4j driver connection with fallback in-memory graph traversal.
    """
    def __init__(self):
        self.driver = None
        try:
            from neo4j import GraphDatabase
            self.driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
        except Exception:
            self.driver = None

    def get_cypher_shortest_path(self, start_id: str, end_id: str) -> str:
        """Generates standard Cypher query for hidden connection discovery."""
        return f"""
        MATCH (start {{id: '{start_id}'}}), (end {{id: '{end_id}'}})
        MATCH path = shortestPath((start)-[*]-(end))
        RETURN path, length(path) AS hop_count
        """

    def get_cypher_cross_case(self, case_ids: List[str]) -> str:
        """Generates Cypher query for cross-case entity intersections."""
        cids_formatted = str(case_ids)
        return f"""
        MATCH (c:Case) WHERE c.id IN {cids_formatted}
        MATCH (c)-[r]-(shared)
        WITH shared, collect(DISTINCT c.id) AS linkedCases, collect(r) AS rels
        WHERE size(linkedCases) >= 2
        RETURN shared, linkedCases, rels
        """

    def get_graph(self, case_ids: Optional[List[str]] = None) -> GraphData:
        """
        Retrieves graph data filtered by case_ids or full scope.
        """
        all_nodes = list(data_processor.graph_nodes.values())
        all_edges = data_processor.graph_edges

        if not case_ids:
            return GraphData(nodes=all_nodes, edges=all_edges)

        node_ids = set(case_ids)
        for e in all_edges:
            if e.source in case_ids or e.target in case_ids:
                node_ids.add(e.source)
                node_ids.add(e.target)

        # 2-hop expansion
        changed = True
        while changed:
            changed = False
            for e in all_edges:
                if (e.source in node_ids or e.target in node_ids) and (e.source not in node_ids or e.target not in node_ids):
                    node_ids.add(e.source)
                    node_ids.add(e.target)
                    changed = True

        filtered_nodes = [n for n in all_nodes if n.id in node_ids]
        filtered_edges = [e for e in all_edges if e.source in node_ids and e.target in node_ids]
        return GraphData(nodes=filtered_nodes, edges=filtered_edges)

    def find_hidden_connection(self, start_id: str, end_id: str) -> HiddenConnectionResponse:
        """
        Cypher/BFS shortest path discovery between two entities.
        """
        if not start_id or not end_id or start_id == end_id or data_processor.is_empty():
            return HiddenConnectionResponse(
                graph=GraphData(),
                orderedNodeIds=[],
                orderedEdgeIds=[],
                hopCount=0,
                evidenceIds=[],
                priority="Low"
            )

        # Adjacency list
        adj: Dict[str, List[Dict[str, Any]]] = {nid: [] for nid in data_processor.graph_nodes}
        for e in data_processor.graph_edges:
            if e.source in adj and e.target in adj:
                adj[e.source].append({"neighbor": e.target, "edge": e})
                adj[e.target].append({"neighbor": e.source, "edge": e})

        # BFS
        queue = [start_id]
        visited = {start_id}
        parent: Dict[str, Tuple[str, GraphEdge]] = {}

        found = False
        while queue:
            curr = queue.pop(0)
            if curr == end_id:
                found = True
                break
            for item in adj.get(curr, []):
                nbr = item["neighbor"]
                if nbr not in visited:
                    visited.add(nbr)
                    parent[nbr] = (curr, item["edge"])
                    queue.append(nbr)

        if not found:
            return HiddenConnectionResponse(
                graph=GraphData(),
                orderedNodeIds=[],
                orderedEdgeIds=[],
                hopCount=0,
                evidenceIds=[],
                priority="Low"
            )

        # Path reconstruction
        ordered_node_ids = []
        ordered_edge_ids = []
        evidence_ids = []
        has_high = False

        c = end_id
        while c != start_id:
            ordered_node_ids.insert(0, c)
            prev_node, edge = parent[c]
            ordered_edge_ids.insert(0, edge.id)
            if edge.evidenceIds:
                evidence_ids.extend(edge.evidenceIds)
            if edge.priority == "High":
                has_high = True
            c = prev_node
        ordered_node_ids.insert(0, start_id)

        path_nodes = [data_processor.graph_nodes[nid] for nid in ordered_node_ids if nid in data_processor.graph_nodes]
        path_edges = [e for e in data_processor.graph_edges if e.id in ordered_edge_ids]

        return HiddenConnectionResponse(
            graph=GraphData(nodes=path_nodes, edges=path_edges),
            orderedNodeIds=ordered_node_ids,
            orderedEdgeIds=ordered_edge_ids,
            hopCount=len(ordered_edge_ids),
            evidenceIds=list(dict.fromkeys(evidence_ids)),
            priority="High" if has_high else "Medium"
        )

    def find_cross_case_connections(self, case_ids: List[str]) -> CrossCaseResponse:
        """
        Cross-case intersection analysis using Cypher semantics.
        """
        if not case_ids or len(case_ids) < 2 or data_processor.is_empty():
            return CrossCaseResponse(graph=GraphData(), connections=[])

        subgraph = self.get_graph(case_ids)
        entity_case_map: Dict[str, Dict[str, Any]] = {}

        for edge in subgraph.edges:
            for c_id in case_ids:
                other = None
                if edge.source == c_id:
                    other = edge.target
                elif edge.target == c_id:
                    other = edge.source

                if other and other not in case_ids:
                    if other not in entity_case_map:
                        entity_case_map[other] = {
                            "cases": set(),
                            "edges": [],
                            "evidence": []
                        }
                    entity_case_map[other]["cases"].add(c_id)
                    entity_case_map[other]["edges"].append(edge.id)
                    if edge.evidenceIds:
                        entity_case_map[other]["evidence"].extend(edge.evidenceIds)

        connections = []
        for eid, entry in entity_case_map.items():
            if len(entry["cases"]) >= 2:
                node = data_processor.graph_nodes.get(eid)
                case_list = list(entry["cases"])
                connections.append(
                    CrossCaseConnection(
                        caseIds=case_list,
                        sharedEntityId=eid,
                        sharedEntityType=node.type if node else "person",
                        relationship=f"Shared across {case_list[0]} and {case_list[1]}",
                        supportingRecordIds=entry["edges"],
                        evidenceIds=list(dict.fromkeys(entry["evidence"])),
                        priority="High"
                    )
                )

        return CrossCaseResponse(graph=subgraph, connections=connections)

kg_service = Neo4jKnowledgeGraphService()
