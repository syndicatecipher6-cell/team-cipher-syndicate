from fastapi import APIRouter, Depends
from app.services.analytics import plotly_service
from app.security import READ_ROLES, Principal, get_principal, require_role

def _authorize_read(principal: Principal = Depends(get_principal)) -> None:
    require_role(principal, READ_ROLES)


router = APIRouter(prefix="/analytics", tags=["Plotly Analytics"], dependencies=[Depends(_authorize_read)])

@router.get("/charts")
def get_analytics_charts():
    """
    Returns Plotly interactive chart JSON specifications.
    """
    return {
        "entityDistribution": plotly_service.generate_entity_distribution_chart(),
        "networkCentrality": plotly_service.generate_network_centrality_chart()
    }
