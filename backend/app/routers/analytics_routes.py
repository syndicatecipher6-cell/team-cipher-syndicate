from fastapi import APIRouter
from app.services.analytics import plotly_service

router = APIRouter(prefix="/analytics", tags=["Plotly Analytics"])

@router.get("/charts")
def get_analytics_charts():
    """
    Returns Plotly interactive chart JSON specifications.
    """
    return {
        "entityDistribution": plotly_service.generate_entity_distribution_chart(),
        "networkCentrality": plotly_service.generate_network_centrality_chart()
    }
