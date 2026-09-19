from fastapi import APIRouter, Depends
from app.services.federated import federated_service
from app.security import ADMIN_ROLES, READ_ROLES, Principal, get_principal, require_role
from app.services.audit import audit_service

router = APIRouter(prefix="/federated", tags=["Federated Learning (Flower + FedProx)"])

@router.get("/status")
def get_federated_status(principal: Principal = Depends(get_principal)):
    """
    Returns Flower + FedProx federated learning status.
    """
    require_role(principal, READ_ROLES)
    return federated_service.get_status()

@router.post("/train")
def run_federated_round(principal: Principal = Depends(get_principal)):
    """
    Executes a federated learning aggregation round across simulated police nodes.
    """
    require_role(principal, ADMIN_ROLES)
    result = federated_service.trigger_training_round()
    audit_service.record(principal.user_id, "FEDERATED_TRAINING_STARTED", principal.station_id, {})
    return result
