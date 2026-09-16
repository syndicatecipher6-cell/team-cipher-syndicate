from fastapi import APIRouter, UploadFile, File, Form
from typing import List, Optional
from app.services.data_processing import data_processor
from app.services.nlp_extractor import nlp_extractor
from app.models.schemas import DashboardStats

router = APIRouter(prefix="/ingest", tags=["Data Ingestion Pipeline"])

@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Ingests raw files (CSV, JSON, PDF/text FIRs) using Pandas, NumPy, and spaCy.
    """
    total_nodes = 0
    total_edges = 0
    processed_files = []

    for file in files:
        content_bytes = await file.read()
        content_text = content_bytes.decode("utf-8", errors="ignore")
        
        # 1. Pandas & NumPy dataframe ingestion
        nodes, edges = data_processor.ingest_file_dataframe(file.filename, content_text)
        
        # 2. spaCy & NLP extraction for text/FIR content
        extracted_nlp = nlp_extractor.extract_entities(content_text)
        
        total_nodes += nodes
        total_edges += edges
        processed_files.append({
            "filename": file.filename,
            "nodesCreated": nodes,
            "edgesCreated": edges,
            "extractedNLP": extracted_nlp
        })

    return {
        "status": "success",
        "processed": processed_files,
        "totalNodesCreated": total_nodes,
        "totalEdgesCreated": total_edges,
        "stats": data_processor.compute_stats()
    }

@router.post("/sample")
def load_sample_dataset():
    """
    Loads verified SIH benchmark dataset (CDRs, FIRs, bank statements) via Pandas.
    """
    nodes, edges = data_processor.load_sih_training_dataset("training dataset")
    return {
        "status": "success",
        "message": "SIH training dataset loaded successfully",
        "nodesCreated": nodes,
        "edgesCreated": edges,
        "stats": data_processor.compute_stats()
    }

@router.post("/clear")
def clear_dataset():
    """
    Wipes all active datasets back to completely clean zero-data state.
    """
    data_processor.clear()
    return {
        "status": "success",
        "message": "Workspace wiped clean",
        "stats": data_processor.compute_stats()
    }
