import unittest

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import Evidence, GraphEdge, GraphNode, Provenance, SandboxModificationInput
from app.services.data_processing import data_processor
from app.services.investigator import investigator_service
from app.services.sandbox import sandbox_service


class GroundedInvestigatorTests(unittest.TestCase):
    def setUp(self) -> None:
        data_processor.clear()
        data_processor.cases_df = pd.DataFrame([
            {"case_id": "CASE-101", "summary": "Person Alpha named in the uploaded FIR.", "crime_type": "Test"},
            {"case_id": "CASE-103", "summary": "Person Alpha appears in a second uploaded FIR.", "crime_type": "Test"},
        ])
        provenance = Provenance(sourceDataset="fir-test.txt", sourceRecordId="ROW-1", recordType="FIR")
        data_processor.graph_nodes = {
            "CASE-101": GraphNode(id="CASE-101", type="case", label="CASE-101", provenance=provenance),
            "CASE-103": GraphNode(id="CASE-103", type="case", label="CASE-103", provenance=provenance),
            "P-ALPHA": GraphNode(id="P-ALPHA", type="person", label="Person Alpha", provenance=provenance),
            "P-BETA": GraphNode(id="P-BETA", type="person", label="Person Beta", provenance=provenance),
        }
        data_processor.graph_edges = [
            GraphEdge(id="E-1", source="CASE-101", target="P-ALPHA", relationship="NAMED_AS_SUSPECT", evidenceIds=["EV-1"], provenance=provenance),
            GraphEdge(id="E-2", source="CASE-103", target="P-ALPHA", relationship="NAMED_AS_SUSPECT", evidenceIds=["EV-2"], provenance=provenance),
            GraphEdge(id="E-3", source="CASE-103", target="P-BETA", relationship="ASSOCIATED_WITH", evidenceIds=["EV-3"], provenance=provenance),
        ]
        data_processor.evidence_list = [
            Evidence(
                evidence_id="EV-1",
                relationship="NAMED_AS_SUSPECT",
                entityA="CASE-101",
                entityB="P-ALPHA",
                case_id="CASE-101",
                timestamp="",
                evidenceType="FIR",
                supportingData="Person Alpha is named in CASE-101.",
                priority="High",
                sourceReliability="Record verified",
                provenance=provenance,
            ),
            Evidence(
                evidence_id="EV-2",
                relationship="NAMED_AS_SUSPECT",
                entityA="CASE-103",
                entityB="P-ALPHA",
                case_id="CASE-103",
                timestamp="",
                evidenceType="FIR",
                supportingData="Person Alpha is named in CASE-103.",
                priority="High",
                sourceReliability="Record verified",
                provenance=provenance,
            ),
        ]

    def tearDown(self) -> None:
        data_processor.clear()

    def test_grounded_answer_contains_cited_findings(self) -> None:
        result = investigator_service.answer("How is Person Alpha connected?", "test-investigator")
        self.assertTrue(result.findings)
        self.assertTrue(set(result.evidenceIds).issubset({"EV-1", "EV-2"}))
        self.assertTrue(any(finding.citations for finding in result.findings))
        self.assertIn("AI output is investigative support", result.warnings[0])

    def test_sandbox_merge_does_not_mutate_production_graph(self) -> None:
        original_node_ids = set(data_processor.graph_nodes)
        session = sandbox_service.create("CASE-103", "test-investigator")
        updated = sandbox_service.apply(
            session.sandbox_id,
            SandboxModificationInput(
                operation="IDENTITY_MERGE",
                parameters={"source_entity_id": "P-BETA", "target_entity_id": "P-ALPHA"},
                rationale="Test a possible identity match.",
            ),
            "test-investigator",
        )
        self.assertEqual(set(data_processor.graph_nodes), original_node_ids)
        self.assertEqual(updated.label, "HYPOTHETICAL / SANDBOX")
        self.assertEqual(
            updated.comparison.after.node_count,
            updated.comparison.before.node_count - 1,
        )

    def test_all_sandbox_operations_remain_isolated(self) -> None:
        original_nodes = data_processor.graph_nodes.copy()
        original_edges = [edge.model_copy(deep=True) for edge in data_processor.graph_edges]
        changes = [
            SandboxModificationInput(
                operation="RELATIONSHIP_ADD",
                parameters={"source": "P-ALPHA", "target": "P-BETA", "relationship": "ASSOCIATED_WITH"},
                rationale="Test an unverified association.",
            ),
            SandboxModificationInput(
                operation="RELATIONSHIP_REMOVE",
                parameters={"edge_id": "E-3"},
                rationale="Test the graph without this link.",
            ),
            SandboxModificationInput(
                operation="EVIDENCE_DISPUTE",
                parameters={"evidence_id": "EV-2"},
                evidence_ids=["EV-2"],
                rationale="Test the impact of disputed evidence.",
            ),
            SandboxModificationInput(
                operation="ENTITY_SPLIT",
                parameters={
                    "entity_id": "P-BETA",
                    "new_entity_id": "P-BETA-2",
                    "new_label": "Person Beta (alternate identity)",
                    "edge_ids": ["E-3"],
                },
                rationale="Test a possible identity collision.",
            ),
            SandboxModificationInput(
                operation="TIMELINE_CHANGE",
                parameters={"event_id": "EVENT-1", "timestamp": "2026-01-02T10:00:00Z"},
                rationale="Test a corrected event time.",
            ),
        ]

        for change in changes:
            session = sandbox_service.create("CASE-103", "test-investigator")
            updated = sandbox_service.apply(session.sandbox_id, change, "test-investigator")
            self.assertEqual(updated.modifications[-1].operation, change.operation)
            self.assertIn("HYPOTHETICAL / SANDBOX", updated.comparison.impact_summary[-1])

        self.assertEqual(data_processor.graph_nodes, original_nodes)
        self.assertEqual(data_processor.graph_edges, original_edges)

    def test_api_query_and_sandbox_creation(self) -> None:
        client = TestClient(app)
        response = client.post(
            "/api/assistant/query",
            json={"question": "What evidence links Person Alpha?"},
            headers={"X-NexusNet-User": "tester", "X-NexusNet-Role": "investigator"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("findings", response.json())

        response = client.post(
            "/api/sandbox/sessions",
            json={"base_case_id": "CASE-101"},
            headers={"X-NexusNet-User": "tester", "X-NexusNet-Role": "investigator"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["label"], "HYPOTHETICAL / SANDBOX")


if __name__ == "__main__":
    unittest.main()
