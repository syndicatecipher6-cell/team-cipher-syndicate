import sys
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, UploadFile


ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.nlp_extractor import nlp_extractor  # noqa: E402


app = FastAPI(title="NexusNet FIR Extraction API")


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "modelLoaded": nlp_extractor.trained_model is not None,
    }


@app.post("/api/ingest/upload")
async def extract_uploaded_firs(files: List[UploadFile] = File(...)):
    processed = []
    for uploaded_file in files:
        content = (await uploaded_file.read()).decode("utf-8", errors="ignore")
        processed.append({
            "filename": uploaded_file.filename,
            "nodesCreated": 0,
            "edgesCreated": 0,
            "extractedNLP": nlp_extractor.extract_entities(content),
        })

    return {
        "status": "success",
        "processed": processed,
        "totalNodesCreated": 0,
        "totalEdgesCreated": 0,
    }
