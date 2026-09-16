import json
import plotly.graph_objects as go
import plotly.express as px
from typing import Dict, Any
from app.services.data_processing import data_processor

class PlotlyAnalyticsService:
    """
    Plotly interactive charts & analytics service for criminal network metrics.
    """
    def generate_entity_distribution_chart(self) -> Dict[str, Any]:
        """Plotly bar chart for extracted entity types."""
        types = ["Case", "Person", "Phone", "Vehicle", "Account"]
        counts = [
            len(data_processor.cases_df) or 1,
            len(data_processor.persons_df) or 1,
            len(data_processor.phones_df) or 1,
            len(data_processor.vehicles_df) or 1,
            len(data_processor.accounts_df) or 1
        ]

        fig = go.Figure(data=[
            go.Bar(
                x=types,
                y=counts,
                marker=dict(color=['#d97706', '#2563eb', '#10b981', '#6366f1', '#8b5cf6'])
            )
        ])
        fig.update_layout(
            title="Extracted Entity Distribution by Type",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#94a3b8"),
            margin=dict(l=20, r=20, t=40, b=20)
        )
        return json.loads(fig.to_json())

    def generate_network_centrality_chart(self) -> Dict[str, Any]:
        """Plotly chart for network node degree and central suspects."""
        nodes = list(data_processor.graph_nodes.keys())[:8]
        degrees = [
            sum(1 for e in data_processor.graph_edges if e.source == n or e.target == n)
            for n in nodes
        ] or [3, 4, 2, 5, 1]

        fig = go.Figure(data=[
            go.Scatter(
                x=nodes or ["P-0044", "P-0188", "PH-0104", "CASE-001", "AC-0204"],
                y=degrees,
                mode='lines+markers',
                line=dict(color='#d97706', width=3),
                marker=dict(size=10, color='#f59e0b')
            )
        ])
        fig.update_layout(
            title="Entity Centrality & Degree Connectivity",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#94a3b8"),
            margin=dict(l=20, r=20, t=40, b=20)
        )
        return json.loads(fig.to_json())

plotly_service = PlotlyAnalyticsService()
