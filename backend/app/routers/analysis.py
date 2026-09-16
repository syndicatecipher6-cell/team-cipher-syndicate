from fastapi import APIRouter, Query
from typing import List, Optional
from app.services.knowledge_graph import kg_service
from app.services.graph_rag import graph_rag_service
from app.models.schemas import (
    HiddenConnectionResponse, CrossCaseResponse, AssistantResponse
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

@router.get("/assistant", response_model=AssistantResponse)
def query_assistant(q: str = Query(..., alias="q")):
    """
    GraphRAG + LLM grounded investigator assistant query.
    """
    return graph_rag_service.answer_query(q)
