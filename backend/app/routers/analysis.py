from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.services.knowledge_graph import kg_service
from app.services.investigator import investigator_service
from app.security import READ_ROLES, Principal, get_principal, require_role
from app.config import settings
from app.models.schemas import (
    HiddenConnectionResponse, CrossCaseResponse, AssistantResponse,
    AssistantQueryRequest, CaseIntelligenceBrief
)

router = APIRouter(tags=["Graph Analysis & AI"])

@router.get("/connections/hidden", response_model=HiddenConnectionResponse)
def get_hidden_connection(start: str = Query(..., alias="start"), end: str = Query(..., alias="end")):
    """
    Finds hidden shortest connection path using Cypher / BFS.
    """
    return kg_service.find_hidden_connection(start, end)

@router.get("/connections/cross-case", response_model=CrossCaseResponse)
def get_cross_case_connections(caseIds: str = Query(..., alias="caseIds")):
    """
    Finds shared entities and cross-case links.
    """
    c_list = [c.strip() for c in caseIds.split(",") if c.strip()]
    return kg_service.find_cross_case_connections(c_list)

def _authorize(principal: Principal) -> None:
    if not settings.ENABLE_AI_INVESTIGATOR:
        raise HTTPException(status_code=503, detail="AI Investigator is disabled.")
    require_role(principal, READ_ROLES)


@router.get("/assistant", response_model=AssistantResponse)
def query_assistant(
    q: str = Query(..., alias="q", min_length=2, max_length=2000),
    principal: Principal = Depends(get_principal),
):
    """
    GraphRAG + LLM grounded investigator assistant query.
    """
    _authorize(principal)
    return investigator_service.answer(q, principal.user_id)


@router.post("/assistant/query", response_model=AssistantResponse)
def query_assistant_structured(
    payload: AssistantQueryRequest,
    principal: Principal = Depends(get_principal),
):
    """Grounded query endpoint used by the Investigation AI interface."""
    _authorize(principal)
    try:
        return investigator_service.answer(
            payload.question,
            principal.user_id,
            case_id=payload.case_id,
            sandbox_id=payload.sandbox_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sandbox session not found.") from exc


@router.get("/cases/{case_id}/intelligence-brief", response_model=CaseIntelligenceBrief)
def get_case_intelligence_brief(
    case_id: str,
    principal: Principal = Depends(get_principal),
):
    _authorize(principal)
    return investigator_service.brief(case_id, principal.user_id)


@router.get("/assistant/status")
def get_assistant_status(principal: Principal = Depends(get_principal)):
    _authorize(principal)
    return {
        "enabled": settings.ENABLE_AI_INVESTIGATOR,
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "apiKeyConfigured": bool(settings.GEMINI_API_KEY),
        "cloudFirProcessingAllowed": settings.ALLOW_CLOUD_FIR_PROCESSING,
        "sandboxEnabled": settings.ENABLE_INVESTIGATION_SANDBOX,
        "crossEncoderEnabled": settings.ENABLE_LOCAL_TRANSFORMERS,
    }
