from fastapi import APIRouter
from app.services.federated import federated_service

router = APIRouter(prefix="/federated", tags=["Federated Learning (Flower + FedProx)"])

@router.get("/status")
def get_federated_status():
    """
    Returns Flower + FedProx federated learning status.
    """
    return federated_service.get_status()

@router.post("/train")
def run_federated_round():
    """
    Executes a federated learning aggregation round across simulated police nodes.
    """
    return federated_service.trigger_training_round()
