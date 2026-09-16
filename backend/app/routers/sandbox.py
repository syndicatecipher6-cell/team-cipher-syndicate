from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.models.schemas import GraphData, SandboxCreateRequest, SandboxModificationInput, SandboxSession
from app.security import SANDBOX_ROLES, Principal, get_principal, require_role
from app.services.sandbox import sandbox_service


router = APIRouter(prefix="/sandbox", tags=["Investigation Sandbox"])


def _authorize(principal: Principal) -> None:
    if not settings.ENABLE_INVESTIGATION_SANDBOX:
        raise HTTPException(status_code=503, detail="Investigation Sandbox is disabled.")
    require_role(principal, SANDBOX_ROLES)


@router.post("/sessions", response_model=SandboxSession)
def create_session(payload: SandboxCreateRequest, principal: Principal = Depends(get_principal)):
    _authorize(principal)
    try:
        return sandbox_service.create(payload.base_case_id, principal.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sessions/{sandbox_id}", response_model=SandboxSession)
def get_session(sandbox_id: str, principal: Principal = Depends(get_principal)):
    _authorize(principal)
    try:
        return sandbox_service.get(sandbox_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sandbox session not found.") from exc


@router.post("/sessions/{sandbox_id}/modifications", response_model=SandboxSession)
def apply_modification(
    sandbox_id: str,
    payload: SandboxModificationInput,
    principal: Principal = Depends(get_principal),
):
    _authorize(principal)
    try:
        return sandbox_service.apply(sandbox_id, payload, principal.user_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sandbox session not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/sessions/{sandbox_id}/graph", response_model=GraphData)
def get_sandbox_graph(sandbox_id: str, principal: Principal = Depends(get_principal)):
    _authorize(principal)
    try:
        return sandbox_service.graph(sandbox_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sandbox session not found.") from exc


@router.post("/sessions/{sandbox_id}/close", response_model=SandboxSession)
def close_session(sandbox_id: str, principal: Principal = Depends(get_principal)):
    _authorize(principal)
    try:
        return sandbox_service.close(sandbox_id, principal.user_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sandbox session not found.") from exc
