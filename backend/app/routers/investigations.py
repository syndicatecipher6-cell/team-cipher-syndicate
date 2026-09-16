from fastapi import APIRouter, Query
from typing import List, Optional
from app.services.data_processing import data_processor
from app.services.knowledge_graph import kg_service
from app.models.schemas import (
    DashboardStats, CaseRecord, Person, GraphData, Evidence, TimelineEvent,
    SearchResult, DataSource
)

router = APIRouter(tags=["Investigations"])

@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats():
    return data_processor.compute_stats()

@router.get("/cases", response_model=List[CaseRecord])
def get_cases():
    cases = []
    for _, row in data_processor.cases_df.iterrows():
        cases.append(CaseRecord(
            case_id=str(row.get("case_id", "")),
            fir_number=str(row.get("fir_number", "")),
            crime_type=str(row.get("crime_type", "")),
            district=str(row.get("district", "")),
            state=str(row.get("state", "")),
            date_filed=str(row.get("date_filed", "2026-09-01")),
            status=str(row.get("status", "Active")),
            summary=str(row.get("summary", ""))
        ))
    return cases

@router.get("/cases/{case_id}")
def get_case(case_id: str):
    cases = get_cases()
    for c in cases:
        if c.case_id == case_id:
            return c
    return None

@router.get("/persons", response_model=List[Person])
def get_persons():
    persons = []
    for _, row in data_processor.persons_df.iterrows():
        cids_raw = str(row.get("case_ids", ""))
        cids = [c.strip() for c in cids_raw.split(";") if c.strip()]
        persons.append(Person(
            person_id=str(row.get("person_id", "")),
            name=str(row.get("name", "")),
            role=str(row.get("role", "Person of Interest")),
            caseIds=cids,
            phoneIds=[],
            vehicleIds=[],
            accountIds=[],
            locationIds=[]
        ))
    return persons

@router.get("/persons/{person_id}")
def get_person(person_id: str):
    persons = get_persons()
    for p in persons:
        if p.person_id == person_id:
            return p
    return None

@router.get("/search", response_model=List[SearchResult])
def search_entities(q: str = Query("", alias="q"), type: Optional[str] = None):
    needle = q.strip().lower()
    results = data_processor.search_results
    filtered = []
    for item in results:
        matches_type = (not type or type == "all" or item.type == type)
        matches_q = (not needle or needle in f"{item.label} {item.secondary} {item.id}".lower())
        if matches_type and matches_q:
            filtered.append(item)
    return filtered

@router.get("/graph", response_model=GraphData)
def get_graph(caseIds: Optional[str] = Query(None)):
    c_list = [c.strip() for c in caseIds.split(",") if c.strip()] if caseIds else None
    return kg_service.get_graph(c_list)

@router.get("/evidence", response_model=List[Evidence])
def get_evidence(caseId: Optional[str] = None, priority: Optional[str] = None):
    ev_list = data_processor.evidence_list
    filtered = []
    for ev in ev_list:
        if caseId and ev.case_id != caseId:
            continue
        if priority and ev.priority != priority:
            continue
        filtered.append(ev)
    return filtered

@router.get("/timeline", response_model=List[TimelineEvent])
def get_timeline(caseId: Optional[str] = None, eventType: Optional[str] = None):
    events = []
    for _, row in data_processor.timeline_df.iterrows():
        cid = str(row.get("case_id", ""))
        etype = str(row.get("event_type", ""))
        if caseId and cid != caseId:
            continue
        if eventType and etype != eventType:
            continue
        events.append(TimelineEvent(
            event_id=str(row.get("event_id", "")),
            case_id=cid,
            person_id=str(row.get("person_id", "")),
            event_type=etype,
            timestamp=str(row.get("timestamp", "")),
            location=str(row.get("location", "")),
            notes=str(row.get("notes", "")),
            source=str(row.get("source", ""))
        ))
    return events

@router.get("/data-sources", response_model=List[DataSource])
def get_data_sources():
    return [
        DataSource(id="fir", name="FIR Police Reports (PDF/Text)", category="Document Ingestion", status="Backend connected"),
        DataSource(id="cdr", name="Call Detail Records (CDRs)", category="Telecom Ingestion", status="Backend connected"),
        DataSource(id="banking", name="Bank & Hawala Transaction Logs", category="Financial Ingestion", status="Backend connected"),
    ]
